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

// ---- NUVIO HDHUB4U SCRAPER LOGIC (REGEX ONLY) ---- //
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
        let currentUrl = url;
        let pageData = "";
        
        // 1. If it's hblinks.co, extract the hubcloud.cx link
        if (currentUrl.includes('hblinks')) {
            console.log("Fetching hblinks:", currentUrl);
            const res = await fetch(currentUrl, { headers: HEADERS });
            pageData = await res.text();
            console.log("hblinks HTML length:", pageData.length);
            const hubcloudCxMatch = pageData.match(/href=["'](https?:\/\/hubcloud\.cx\/drive\/[^"']+)["']/i);
            const hubMatch = hubcloudCxMatch || pageData.match(/href=["'](https?:\/\/[^"']*(?:hubcloud|hubdrive|hubcdn)[^"']*\/(?:drive|file)\/[^"']+)["']/i);
            if (hubMatch) {
                currentUrl = hubMatch[1];
                console.log("Found Hubcloud Link:", currentUrl);
            } else {
                console.log("Failed to find hubcloud link in hblinks HTML!");
                return [];
            }
        }
        
        // 2. Fetch the hubcloud.cx/hubdrive link
        console.log("Fetching hubcloud:", currentUrl);
        const res2 = await fetch(currentUrl, { headers: HEADERS });
        pageData = await res2.text();
        
        // 3. Follow secondary redirects if we landed on a hubdrive/hubcdn page instead of hubcloud.cx
        if (!currentUrl.includes('hubcloud.cx') && !currentUrl.includes('gamerxyt')) {
            const hubcloudCxMatch = pageData.match(/href=["'](https?:\/\/hubcloud\.cx\/drive\/[^"']+)["']/i);
            if (hubcloudCxMatch) {
                currentUrl = hubcloudCxMatch[1];
                console.log("Redirecting to hubcloud.cx:", currentUrl);
                const res2b = await fetch(currentUrl, { headers: HEADERS });
                pageData = await res2b.text();
            }
        }
        
        // Extract size
        const sizeMatchHtml = pageData.match(/<i[^>]*id=["']size["'][^>]*>([\s\S]*?)<\/i>/i);
        let size = sizeMatchHtml ? sizeMatchHtml[1].replace(/<[^>]+>/g, '').trim() : '';
        let sizeInBytes = 0;
        if(size) {
            const sMatch = size.match(/([\d.]+)\s*(GB|MB|KB)/i);
            if(sMatch) {
                const val = parseFloat(sMatch[1]);
                if(sMatch[2].toUpperCase() === 'GB') sizeInBytes = val * 1024 * 1024 * 1024;
                if(sMatch[2].toUpperCase() === 'MB') sizeInBytes = val * 1024 * 1024;
            }
        }
        
        // Check if it's the "Generate Link" page (redirects to gamerxyt.com)
        const generateLinkMatch = pageData.match(/<a[^>]+id=["']download["'][^>]+href=["']([^"']+)["']/i) || pageData.match(/<a[^>]+href=["']([^"']+)["'][^>]+id=["']download["']/i);
        
        if (generateLinkMatch) {
            const generateUrl = generateLinkMatch[1];
            const res3 = await fetch(generateUrl, { headers: HEADERS });
            pageData = await res3.text();
        }
        
        // Now extract the actual FSL/10Gbps/Pixeldrain links!
        const links = [];
        const aMatches = pageData.match(/<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*btn[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi) || [];
        
        for (const aTag of aMatches) {
            const hrefMatch = aTag.match(/href=["']([^"']+)["']/i);
            const href = hrefMatch ? hrefMatch[1] : null;
            if (!href) continue;
            const text = aTag.replace(/<[^>]+>/g, '').trim();
            
            let finalLink = href;
            try {
                const r = await fetch(href, { method: 'HEAD', headers: HEADERS });
                if (r.url && r.url.includes("link=")) {
                    finalLink = r.url.substring(r.url.indexOf("link=") + 5);
                } else if (r.url && r.url.includes("pixeldrain.com/u/")) {
                    finalLink = r.url.replace("/u/", "/api/file/");
                } else if (r.url) {
                    finalLink = r.url;
                }
            } catch(e) {}
            
            // FSL, S3, 10Gbps, Pixeldrain matches
            if (text.includes("FSL")) links.push({ url: finalLink, quality: 1080, source: "HubCloud - FSL", size: sizeInBytes });
            else if (text.includes("S3 Server")) links.push({ url: finalLink, quality: 1080, source: "HubCloud - S3", size: sizeInBytes });
            else if (text.includes("10Gbps")) links.push({ url: finalLink, quality: 1080, source: "HubCloud - 10Gbps", size: sizeInBytes });
            else if (text.includes("PixelServer")) links.push({ url: finalLink, quality: 1080, source: "Pixeldrain", size: sizeInBytes });
        }
        return links;
    } catch(e) { return []; }
}

async function loadExtractor(url) {
    try {
        if (url.includes("?id=") || url.includes("techyboy4u")) {
            url = await getRedirectLinks(url);
        }
        if (url.includes('hubcloud') || url.includes('hblinks') || url.includes('hubdrive') || url.includes('hubcdn')) return await hubCloudExtractor(url);
        if (url.includes('pixeldrain')) return [{ url, quality: 1080, source: 'Pixeldrain', size: 0 }];
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
    
    let targetHtml = html;
    if (mediaType === "tv" && eNum) {
        const epRegex = new RegExp(`(?:Episode|Ep|E)[\\s\\-]*0?${eNum}(?!\\d)`, 'i');
        const nextEpRegex = new RegExp(`(?:Episode|Ep|E)[\\s\\-]*0?${eNum + 1}(?!\\d)`, 'i');
        
        let startIdx = html.search(epRegex);
        if (startIdx !== -1) {
            let remainder = html.substring(startIdx + 5);
            let endIdx = remainder.search(nextEpRegex);
            if (endIdx !== -1) {
                targetHtml = html.substring(startIdx, startIdx + 5 + endIdx);
            } else {
                targetHtml = html.substring(startIdx);
            }
        }
    }
    
    let initialLinks = [];
    const aTags = targetHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi) || [];
    for (let aTag of aTags) {
        const hrefMatch = aTag.match(/href=["']([^"']+)["']/i);
        if (hrefMatch) {
            const href = hrefMatch[1];
            if (href.includes('techyboy4u') || href.includes('gadgetsweb') || 
                href.includes('hblinks') || href.includes('hubcloud') || 
                href.includes('hubdrive') || href.includes('hubcdn') || href.includes('pixeldrain')) {
                initialLinks.push({ url: href });
            }
        }
    }
    
    // Prevent timeouts by capping the number of links we fetch concurrently or sequentially
    initialLinks = initialLinks.slice(0, 12);
    
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
