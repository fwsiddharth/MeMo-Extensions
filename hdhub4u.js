const TMDB_API_KEY = "3b0fa3c43dea59ff255ee83f04849655";
const TMDB_BASE = "https://api.tmdb.org/3";
async function tmdbFetch(path, params = {}) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" }
  });
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  return res.json();
}
function mapTmdbToAnime(item) {
  return {
    id: String(item.id),
    title: item.title || item.original_title || item.name || item.original_name,
    titleEnglish: item.title || item.name,
    titleRomaji: item.original_title || item.original_name,
    description: item.overview || "",
    provider: "hdhub4u",
    seasonYear: (item.release_date || item.first_air_date) ? parseInt((item.release_date || item.first_air_date).split("-")[0]) : null,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
    coverImage: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
    rating: item.vote_average ? item.vote_average.toFixed(1) : "0.0",
    format: item.media_type === "tv" || item.first_air_date ? "TV" : "MOVIE"
  };
}
// ---- NUVIO HDHUB4U SCRAPER LOGIC INJECTED HERE ---- //
const cheerio = require('cheerio-without-node-native');
const CryptoJS = require('crypto-js');
let MAIN_URL = "https://new2.hdhub4u.cl";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": `${MAIN_URL}/`,
};
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return 'Unknown Size';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
function atob(value) {
    if (!value) return '';
    let input = String(value).replace(/=+$/, '');
    let output = '';
    const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let bc = 0, bs, buffer, idx = 0;
    while ((buffer = input.charAt(idx++))) {
        buffer = BASE64_CHARS.indexOf(buffer);
        if (~buffer) {
            bs = bc % 4 ? bs * 64 + buffer : buffer;
            if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
        }
    }
    return output;
}
function rot13(value) {
    return value.replace(/[a-zA-Z]/g, function (c) {
        return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
    });
}
function extractServerName(source) {
    if (!source) return 'Unknown';
    if (source.startsWith('HubCloud')) {
        const serverMatch = source.match(/HubCloud(?:\s*-\s*([^[\]]+))?/);
        return serverMatch ? (serverMatch[1] || 'Download') : 'HubCloud';
    }
    if (source.startsWith('Pixeldrain')) return 'Pixeldrain';
    if (source.startsWith('HubCdn')) return 'HubCdn';
    return source.replace(/^www\./, '').split('.')[0];
}
async function getRedirectLinks(url) {
    try {
        const response = await fetch(url, { headers: HEADERS });
        const doc = await response.text();
        const regex = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;
        let combinedString = '';
        let match;
        while ((match = regex.exec(doc)) !== null) {
            if (match[1] || match[2]) combinedString += (match[1] || match[2]);
        }
        if (!combinedString) return url;
        const decodedString = atob(rot13(atob(atob(combinedString))));
        const jsonObject = JSON.parse(decodedString);
        if (jsonObject.o) return atob(jsonObject.o).trim();
        return url;
    } catch(e) { return url; }
}
async function hubCloudExtractor(url) {
    try {
        const currentUrl = url.replace("hubcloud.ink", "hubcloud.dad");
        const res = await fetch(currentUrl, { headers: HEADERS });
        let pageData = await res.text();
        const $ = cheerio.load(pageData);
        const header = $('div.card-header').text().trim();
        const qualityMatch = header.match(/(\d{3,4})[pP]/);
        const quality = qualityMatch ? parseInt(qualityMatch[1]) : 1080;
        
        let size = $('i#size').text().trim();
        let sizeInBytes = 0;
        if(size) {
            const sizeMatch = size.match(/([\d.]+)\s*(GB|MB|KB)/i);
            if(sizeMatch) {
                const val = parseFloat(sizeMatch[1]);
                if(sizeMatch[2].toUpperCase() === 'GB') sizeInBytes = val * 1024 * 1024 * 1024;
                if(sizeMatch[2].toUpperCase() === 'MB') sizeInBytes = val * 1024 * 1024;
            }
        }
        
        const links = [];
        const elements = $('div.card-body h2 a.btn').get();
        for (const el of elements) {
            const link = $(el).attr('href');
            const text = $(el).text();
            
            if (text.includes("FSL Server")) links.push({ url: link, quality, source: "HubCloud - FSL", size: sizeInBytes });
            else if (text.includes("S3 Server")) links.push({ url: link, quality, source: "HubCloud - S3", size: sizeInBytes });
            else if (text.includes("10Gbps")) {
                let finalLink = link;
                try {
                    const r = await fetch(link, { redirect: 'manual' });
                    const loc = r.headers.get('location');
                    if(loc && loc.includes("link=")) finalLink = loc.substring(loc.indexOf("link=")+5);
                } catch(e) {}
                links.push({ url: finalLink, quality, source: "HubCloud - 10Gbps", size: sizeInBytes });
            }
            else if (link && link.includes("pixeldrain")) links.push({ url: link, quality, source: "Pixeldrain", size: sizeInBytes });
        }
        return links;
    } catch(e) { return []; }
}
async function loadExtractor(url) {
    try {
        if (url.includes("?id=") || url.includes("techyboy4u")) {
            url = await getRedirectLinks(url);
        }
        if (url.includes('hubcloud')) return await hubCloudExtractor(url);
        if (url.includes('pixeldrain')) return [{ url, quality: 1080, source: 'Pixeldrain' }];
        return [];
    } catch(e) { return []; }
}
async function searchHDHub(query) {
    const today = new Date().toISOString().split('T')[0];
    const searchUrl = `https://search.pingora.fyi/collections/post/documents/search?q=${encodeURIComponent(query)}&query_by=post_title,category&query_by_weights=4,2&sort_by=sort_by_date:desc&limit=15&highlight_fields=none&use_cache=true&page=1&analytics_tag=${today}`;
    const res = await fetch(searchUrl, { headers: HEADERS });
    const data = await res.json();
    if (!data || !data.hits) return [];
    return data.hits.map(hit => {
        const doc = hit.document;
        const yearMatch = doc.post_title.match(/\((\d{4})\)|\b(\d{4})\b/);
        return {
            title: doc.post_title,
            url: doc.permalink.startsWith('/') ? `${MAIN_URL}${doc.permalink}` : doc.permalink,
            year: yearMatch ? parseInt(yearMatch[1] || yearMatch[2]) : null
        };
    });
}
async function getHDHubStreams(tmdbId, mediaType, mediaInfo, sNum, eNum) {
    const searchQuery = mediaType === "tv" && sNum ? `${mediaInfo.title} Season ${sNum}` : mediaInfo.title;
    const searchResults = await searchHDHub(searchQuery);
    if (!searchResults.length) return [];
    
    // Find best match
    let bestMatch = searchResults[0];
    const res = await fetch(bestMatch.url, { headers: HEADERS });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    let initialLinks = [];
    if (mediaType === "movie") {
        $('h3 a, h4 a').filter((i, el) => $(el).text().match(/480|720|1080|2160|4K/i))
            .each((i, el) => initialLinks.push({ url: $(el).attr('href') }));
    } else {
        // TV Shows - Find episode specific links
        $('h3, h4').each((i, el) => {
            const text = $(el).text();
            if (text.match(/480|720|1080|2160|4K/i) && $(el).find('a').length) {
                $(el).find('a').each((_, a) => {
                    const href = $(a).attr('href');
                    if(href && href.includes('techyboy4u')) initialLinks.push({ url: href });
                });
            }
        });
    }
    
    const streams = [];
    for (const link of initialLinks) {
        if(!link.url) continue;
        const extracted = await loadExtractor(link.url);
        for(const ext of extracted) {
            let qStr = "1080p";
            if (ext.quality >= 2160) qStr = "4K";
            else if (ext.quality >= 1080) qStr = "1080p";
            else if (ext.quality >= 720) qStr = "720p";
            else if (ext.quality >= 480) qStr = "480p";
            
            streams.push({
                type: "mp4",
                name: `HDHub4u - ${ext.source}`,
                quality: qStr,
                language: "Native",
                size: formatBytes(ext.size),
                url: ext.url
            });
        }
    }
    return streams;
}
// ---- END NUVIO LOGIC ---- //
module.exports = {
  name: "hdhub4u",
  type: "zoro",
  async search(query, options = {}) {
    const data = await tmdbFetch("/search/multi", { query, include_adult: false, page: options.page || 1 });
    return (data.results || []).filter(i => i.media_type !== "person").map(mapTmdbToAnime);
  },
  async browse(options = {}) {
    let path = "/movie/popular";
    const params = { page: options.page || 1, watch_region: "IN" };
    switch (options.platform) {
      case "latest": path = "/movie/now_playing"; break;
      case "trending_now": path = "/trending/all/day"; break;
      case "new_indian":
        path = "/discover/movie";
        params.with_original_language = "hi"; params.region = "IN";
        params.sort_by = "primary_release_date.desc";
        break;
      case "popular": path = "/movie/popular"; break;
      case "popular_tv": path = "/tv/popular"; break;
      case "upcoming": path = "/movie/upcoming"; break;
    }
    const data = await tmdbFetch(path, params);
    return (data.results || []).map(mapTmdbToAnime);
  },
  async getDiscover() {
    const fetchSection = async (title, platform) => {
      try {
        const items = await this.browse({ platform, page: 1 });
        return { title, platform, items: items.slice(0, 15) };
      } catch (e) { return null; }
    };
    const sections = (await Promise.all([
      fetchSection("Latest Release", "latest"),
      fetchSection("Trending Now", "trending_now"),
      fetchSection("Popular TV Shows", "popular_tv")
    ])).filter(Boolean);
    return { filters: {}, sections };
  },
  async getEpisodes(anime, options = {}) {
    if (anime.format === "MOVIE" || anime.type === "movie") {
      return { episodes: [{ id: String(anime.id || anime.tmdbId), number: 1, title: "Full Movie" }] };
    }
    const tmdbId = String(anime.id || anime.tmdbId);
    let imdbId = null;
    let seasonsData = [];
    try {
      const tvData = await tmdbFetch(`/tv/${tmdbId}`);
      const extData = await tmdbFetch(`/tv/${tmdbId}/external_ids`);
      imdbId = extData.imdb_id;
      seasonsData = tvData.seasons || [];
    } catch (e) {}
    const validSeasons = seasonsData.filter(s => s.season_number > 0);
    const result = { seasons: [] };
    const promises = validSeasons.map(async (s) => {
      try {
        const sData = await tmdbFetch(`/tv/${tmdbId}/season/${s.season_number}`);
        const eps = (sData.episodes || []).map(e => ({
          id: `${imdbId}:${s.season_number}:${e.episode_number}`,
          number: e.episode_number,
          title: e.name || `Episode ${e.episode_number}`,
          season: s.season_number,
          imdbId
        }));
        return { season: s.season_number, name: `Season ${s.season_number}`, episodes: eps };
      } catch(e) { return null; }
    });
    
    result.seasons = (await Promise.all(promises)).filter(Boolean);
    return result;
  },
  async getStream(anime, episodeId) {
    let streamId = String(episodeId);
    let type = "movie";
    let sNum = 1, eNum = 1;
    
    if (streamId.includes(":")) {
      type = "series";
      const p = streamId.split(":");
      sNum = parseInt(p[1]); eNum = parseInt(p[2]);
    }
    
    const mediaInfo = { title: anime.title || anime.titleEnglish, year: anime.seasonYear };
    const tmdbId = anime.tmdbId || anime.id;
    
    const servers = await getHDHubStreams(tmdbId, type, mediaInfo, sNum, eNum);
    if (!servers || servers.length === 0) throw new Error("No streams found on HDHub4u");
    
    return {
      servers: servers,
      type: "mp4",
      url: servers[0].url,
      subtitles: []
    };
  }
};
