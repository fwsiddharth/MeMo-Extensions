/**
 * HDHub4u Extension for Gear 5
 * Type: Zoro (Movies & TV)
 * 
 * Uses TMDB for metadata + pingora search for HDHub4u content.
 * Supports: Movies, TV Series (multi-season), Pack downloads, Individual episodes.
 */

const TMDB_API_KEY = "3b0fa3c43dea59ff255ee83f04849655";
const TMDB_BASE = "https://api.tmdb.org/3";

// ─── TMDB Helpers ─────────────────────────────────────────

async function tmdbFetch(path, params = {}) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" }
  });
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  return res.json();
}

function mapTmdbToAnime(item) {
  const isTV = item.media_type === "tv" || !!item.first_air_date;
  return {
    id: String(item.id),
    title: item.title || item.original_title || item.name || item.original_name,
    titleEnglish: item.title || item.name,
    titleRomaji: item.original_title || item.original_name,
    description: item.overview || "",
    provider: "hdhub4u",
    seasonYear: (item.release_date || item.first_air_date)
      ? parseInt((item.release_date || item.first_air_date).split("-")[0])
      : null,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
    coverImage: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
    rating: item.vote_average ? item.vote_average.toFixed(1) : "0.0",
    format: isTV ? "TV" : "MOVIE",
    type: isTV ? "tv" : "movie",
  };
}

// ─── HDHub4u Scraper Core ─────────────────────────────────

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
  } catch (e) { return url; }
}

async function hubCloudExtractor(url) {
  try {
    let currentUrl = url;
    let pageData = "";

    // 1. If it's hblinks, extract the hubcloud link
    if (currentUrl.includes('hblinks')) {
      const res = await fetch(currentUrl, { headers: HEADERS });
      pageData = await res.text();
      const hubMatch = pageData.match(/href=["'](https?:\/\/[^"']*(?:hubcloud|hubdrive|hubcdn)[^"']*\/(?:drive|file)\/[^"']+)["']/i);
      if (hubMatch) {
        currentUrl = hubMatch[1];
      } else {
        return [];
      }
    }

    // 2. Fetch the hubcloud/hubdrive page
    const res2 = await fetch(currentUrl, { headers: HEADERS });
    pageData = await res2.text();

    // 3. Follow secondary redirects
    if (!currentUrl.includes('hubcloud.cx') && !currentUrl.includes('gamerxyt')) {
      const hubcloudCxMatch = pageData.match(/href=["'](https?:\/\/hubcloud\.cx\/drive\/[^"']+)["']/i);
      if (hubcloudCxMatch) {
        currentUrl = hubcloudCxMatch[1];
        const res2b = await fetch(currentUrl, { headers: HEADERS });
        pageData = await res2b.text();
      }
    }

    // Extract file size
    const sizeMatchHtml = pageData.match(/<i[^>]*id=["']size["'][^>]*>([\s\S]*?)<\/i>/i);
    let size = sizeMatchHtml ? sizeMatchHtml[1].replace(/<[^>]+>/g, '').trim() : '';
    let sizeInBytes = 0;
    if (size) {
      const sMatch = size.match(/([\d.]+)\s*(GB|MB|KB)/i);
      if (sMatch) {
        const val = parseFloat(sMatch[1]);
        if (sMatch[2].toUpperCase() === 'GB') sizeInBytes = val * 1024 * 1024 * 1024;
        if (sMatch[2].toUpperCase() === 'MB') sizeInBytes = val * 1024 * 1024;
      }
    }

    // Follow "Generate Link" if present
    const generateLinkMatch = pageData.match(/<a[^>]+id=["']download["'][^>]+href=["']([^"']+)["']/i)
      || pageData.match(/<a[^>]+href=["']([^"']+)["'][^>]+id=["']download["']/i);
    if (generateLinkMatch) {
      const res3 = await fetch(generateLinkMatch[1], { headers: HEADERS });
      pageData = await res3.text();
    }

    // Extract page title for quality detection
    const titleMatch = pageData.match(/<title>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1] : "";

    // Extract server links (only elements with btn class)
    const links = [];
    const aMatches = pageData.match(/<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*btn[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi) || [];

    for (const aTag of aMatches) {
      const hrefMatch = aTag.match(/href=["']([^"']+)["']/i);
      const href = hrefMatch ? hrefMatch[1] : null;
      if (!href) continue;
      const text = aTag.replace(/<[^>]+>/g, '').trim();

      // Skip samples and tiny files
      if (text.toLowerCase().includes('sample')) continue;
      if (sizeInBytes > 0 && sizeInBytes < 100 * 1024 * 1024) continue;

      // Detect quality
      let qStr = "1080p";
      const searchString = (pageTitle + " " + text).toLowerCase();
      if (searchString.match(/4k|2160p/)) qStr = "4K";
      else if (searchString.match(/1080p/)) qStr = "1080p";
      else if (searchString.match(/720p/)) qStr = "720p";
      else if (searchString.match(/480p|360p/)) continue;

      if (text.includes("FSL")) {
        links.push({ url: href, quality: qStr, source: "Server 1 (Fastest)", size: sizeInBytes });
      } else if (text.includes("S3 Server")) {
        links.push({ url: href, quality: qStr, source: "Server 3 (Backup)", size: sizeInBytes });
      } else if (text.includes("10Gbps")) {
        let finalLink = href;
        try {
          const r = await fetch(href);
          if (r.url && r.url.includes("link=")) {
            finalLink = r.url.substring(r.url.indexOf("link=") + 5);
          } else if (r.url) {
            finalLink = r.url;
          }
        } catch (e) {}
        links.push({ url: finalLink, quality: qStr, source: "Server 2 (High Speed)", size: sizeInBytes });
      } else if (text.includes("PixelServer") || text.includes("Pixeldrain")) {
        let finalLink = href;
        if (finalLink.includes("pixeldrain.com/u/")) finalLink = finalLink.replace("/u/", "/api/file/");
        else if (finalLink.includes("pixeldrain.dev/u/")) finalLink = finalLink.replace("/u/", "/api/file/");
        links.push({ url: finalLink, quality: qStr, source: "Server 4", size: sizeInBytes });
      }
    }
    return links;
  } catch (e) { return []; }
}

async function loadExtractor(url) {
  try {
    if (url.includes("?id=") || url.includes("techyboy4u") || url.includes("gadgetsweb")) {
      // gadgetsweb and techyboy4u redirect to hubcloud via encoded links
      // First try following the redirect chain
      try {
        const res = await fetch(url, { headers: HEADERS });
        const finalUrl = res.url;
        const body = await res.text();
        
        // If we got redirected to hubcloud/hblinks directly, use that
        if (finalUrl.includes('hubcloud') || finalUrl.includes('hblinks') || finalUrl.includes('hubdrive') || finalUrl.includes('hubcdn') || finalUrl.includes('hubstream')) {
          return await hubCloudExtractor(finalUrl);
        }
        
        // If the response body contains hubcloud links, extract them
        const hubMatch = body.match(/href=["'](https?:\/\/[^"']*(?:hubcloud|hubdrive|hblinks|hubcdn|hubstream)[^"']*)["']/i);
        if (hubMatch) {
          return await hubCloudExtractor(hubMatch[1]);
        }
        
        // Try the old cookie-based decode
        const regex = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;
        let combinedString = '';
        let match;
        while ((match = regex.exec(body)) !== null) {
          if (match[1] || match[2]) combinedString += (match[1] || match[2]);
        }
        if (combinedString) {
          const decodedString = atob(rot13(atob(atob(combinedString))));
          const jsonObject = JSON.parse(decodedString);
          if (jsonObject.o) {
            const decodedUrl = atob(jsonObject.o).trim();
            if (decodedUrl.includes('hubcloud') || decodedUrl.includes('hblinks') || decodedUrl.includes('hubdrive') || decodedUrl.includes('hubstream')) {
              return await hubCloudExtractor(decodedUrl);
            }
            return [{ url: decodedUrl, quality: "1080p", source: "Server 1 (Fastest)", size: 0 }];
          }
        }
      } catch (e) {}
      
      // Fallback: try original getRedirectLinks approach
      const redirected = await getRedirectLinks(url);
      if (redirected !== url) {
        if (redirected.includes('hubcloud') || redirected.includes('hblinks') || redirected.includes('hubdrive') || redirected.includes('hubcdn') || redirected.includes('hubstream')) {
          return await hubCloudExtractor(redirected);
        }
      }
      return [];
    }
    if (url.includes('hubcloud') || url.includes('hblinks') || url.includes('hubdrive') || url.includes('hubcdn') || url.includes('hubstream')) {
      return await hubCloudExtractor(url);
    }
    if (url.includes('pixeldrain')) {
      let finalUrl = url;
      if (finalUrl.includes("/u/")) finalUrl = finalUrl.replace("/u/", "/api/file/");
      return [{ url: finalUrl, quality: "1080p", source: 'Pixeldrain', size: 0 }];
    }
    // hdstream4u.com/file/ links are direct download links
    if (url.includes('hdstream4u')) {
      return [{ url, quality: "1080p", source: "Server 1 (Fastest)", size: 0 }];
    }
    return [];
  } catch (e) { return []; }
}

// ─── HDHub4u Search & Stream Extraction ───────────────────

async function searchHDHub(query) {
  const today = new Date().toISOString().split('T')[0];
  const searchUrl = `https://search.pingora.fyi/collections/post/documents/search?q=${encodeURIComponent(query)}&query_by=post_title,category&query_by_weights=4,2&sort_by=sort_by_date:desc&limit=15&highlight_fields=none&use_cache=true&page=1&analytics_tag=${today}`;
  const res = await fetch(searchUrl, { headers: HEADERS });
  const data = await res.json();
  if (!data || !data.hits) return [];
  return data.hits.map(hit => {
    const doc = hit.document;
    const yearMatch = doc.post_title.match(/\b(19\d{2}|20\d{2})\b/);
    return {
      title: doc.post_title,
      url: doc.permalink.startsWith('/') ? `${MAIN_URL}${doc.permalink}` : doc.permalink,
      year: yearMatch ? parseInt(yearMatch[1]) : null
    };
  });
}

function isTitleMatch(searchTitle, targetTitle, searchYear, targetYear, sNum) {
  let cleanSearch = searchTitle.split(/\(|\[/)[0].trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
  let cleanTarget = targetTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '');

  let isNameMatch = cleanSearch === cleanTarget;
  if (!isNameMatch) {
    if (cleanSearch.startsWith(cleanTarget + " season") || cleanSearch.startsWith(cleanTarget + " part")) {
      isNameMatch = true;
    }
  }

  if (isNameMatch) {
    // Validate season number if specified
    if (sNum) {
      const titleLower = searchTitle.toLowerCase();
      const match = titleLower.match(/season\s*(\d+)/);
      if (match) {
        const foundSeason = parseInt(match[1]);
        if (foundSeason !== parseInt(sNum)) return false;
      }
    }
    // Validate year (allow ±1 year tolerance)
    if (searchYear && targetYear) {
      if (Math.abs(searchYear - targetYear) > 1) return false;
    }
    return true;
  }
  return false;
}

async function getHDHubStreams(tmdbId, mediaType, mediaInfo, sNum, eNum) {
  // Search with season number for TV shows
  const searchQuery = mediaType === "tv" && sNum
    ? `${mediaInfo.title} Season ${sNum}`
    : mediaInfo.title;

  const searchResults = await searchHDHub(searchQuery);
  const validResults = searchResults.filter(res =>
    isTitleMatch(res.title, mediaInfo.title, res.year, mediaInfo.year, sNum)
  );

  if (!validResults.length) {
    // Fallback: try without season number
    if (mediaType === "tv" && sNum > 1) {
      const fallbackResults = await searchHDHub(mediaInfo.title);
      const fallbackValid = fallbackResults.filter(res =>
        isTitleMatch(res.title, mediaInfo.title, res.year, mediaInfo.year, sNum)
      );
      if (!fallbackValid.length) return [];
      validResults.push(...fallbackValid);
    } else {
      return [];
    }
  }

  // Fetch the best match page
  const bestMatch = validResults[0];
  const res = await fetch(bestMatch.url, { headers: HEADERS });
  const html = await res.text();

  let targetHtml = html;
  if (mediaType === "tv" && eNum) {
    // Try to isolate the specific episode section
    // Common patterns: "Episode 5", "Ep 05", "EP-5", "E05", ">EP 5<"
    const epRegex = new RegExp(`(?:>\\s*(?:Episode|Ep|EP)[\\s\\-\\.]*0?${eNum}\\b)`, 'i');
    const nextEpRegex = new RegExp(`(?:>\\s*(?:Episode|Ep|EP)[\\s\\-\\.]*0?${eNum + 1}\\b)`, 'i');

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
    // If no episode marker found, use the full page (pack download)
  }

  // Extract download links
  let initialLinks = [];
  const aTags = targetHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi) || [];
  for (const aTag of aTags) {
    const hrefMatch = aTag.match(/href=["']([^"']+)["']/i);
    if (hrefMatch) {
      const href = hrefMatch[1];
      if (href.includes('techyboy4u') || href.includes('gadgetsweb') ||
        href.includes('hblinks') || href.includes('hubcloud') ||
        href.includes('hubdrive') || href.includes('hubcdn') || 
        href.includes('pixeldrain') || href.includes('hdstream4u') ||
        href.includes('hubstream')) {
        initialLinks.push({ url: href });
      }
    }
  }

  // Cap to prevent timeout (process max 10 links)
  initialLinks = initialLinks.slice(0, 10);

  // Extract streams in parallel batches of 3
  const streams = [];
  const BATCH_SIZE = 3;
  for (let i = 0; i < initialLinks.length; i += BATCH_SIZE) {
    const batch = initialLinks.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(link => loadExtractor(link.url).catch(() => []))
    );
    for (const extracted of results) {
      for (const ext of extracted) {
        streams.push({
          type: "mkv",
          name: ext.source,
          quality: ext.quality,
          language: "Dual Audio",
          size: formatBytes(ext.size),
          url: ext.url
        });
      }
    }
  }

  // Deduplicate: group by quality, keep top servers
  const grouped = {};
  for (const stream of streams) {
    if (!grouped[stream.quality]) grouped[stream.quality] = [];
    grouped[stream.quality].push(stream);
  }

  const finalStreams = [];
  const serverOrder = ["Server 1 (Fastest)", "Server 2 (High Speed)", "Server 3 (Backup)", "Server 4"];
  for (const [quality, streamList] of Object.entries(grouped)) {
    const seenSources = new Set();
    for (const targetSource of serverOrder) {
      const found = streamList.find(s => s.name === targetSource);
      if (found && !seenSources.has(targetSource)) {
        finalStreams.push(found);
        seenSources.add(targetSource);
      }
    }
  }

  return finalStreams;
}

// ─── Module Exports (Extension API) ───────────────────────

module.exports = {
  name: "hdhub4u",
  type: "zoro",

  async search(query, options = {}) {
    const data = await tmdbFetch("/search/multi", {
      query,
      include_adult: false,
      page: options.page || 1
    });
    return (data.results || [])
      .filter(i => i.media_type !== "person")
      .map(mapTmdbToAnime);
  },

  async browse(options = {}) {
    let path = "/movie/popular";
    const params = { page: options.page || 1, watch_region: "IN" };

    switch (options.platform) {
      // Movies
      case "in_theatres":
        path = "/movie/now_playing"; params.region = "IN"; break;
      case "trending_movies":
        path = "/trending/movie/week"; break;
      case "top_movies":
        path = "/movie/top_rated"; break;
      case "upcoming":
        path = "/movie/upcoming"; params.region = "IN"; break;
      case "popular_movies":
        path = "/movie/popular"; break;

      // TV Shows
      case "trending_tv":
        path = "/trending/tv/week"; break;
      case "popular_tv":
        path = "/tv/popular"; break;
      case "top_tv":
        path = "/tv/top_rated"; break;
      case "airing_today":
        path = "/tv/airing_today"; break;
      case "on_the_air":
        path = "/tv/on_the_air"; break;

      // OTT / Platform specific
      case "netflix":
        path = "/discover/movie";
        params.with_watch_providers = "8";
        params.sort_by = "popularity.desc"; break;
      case "netflix_tv":
        path = "/discover/tv";
        params.with_watch_providers = "8";
        params.sort_by = "popularity.desc"; break;
      case "prime":
        path = "/discover/movie";
        params.with_watch_providers = "9";
        params.watch_region = "US";
        params.sort_by = "popularity.desc"; break;
      case "prime_tv":
        path = "/discover/tv";
        params.with_watch_providers = "9";
        params.watch_region = "US";
        params.sort_by = "popularity.desc"; break;
      case "hotstar":
        path = "/discover/tv";
        params.with_watch_providers = "122";
        params.sort_by = "popularity.desc"; break;
      case "jiocinema":
        path = "/discover/movie";
        params.with_watch_providers = "220";
        params.sort_by = "popularity.desc"; break;

      // Indian content
      case "bollywood":
        path = "/discover/movie";
        params.with_original_language = "hi";
        params.sort_by = "popularity.desc"; break;
      case "bollywood_new":
        path = "/discover/movie";
        params.with_original_language = "hi";
        params.sort_by = "primary_release_date.desc";
        params["primary_release_date.lte"] = new Date().toISOString().split('T')[0]; break;

      // Trending all
      case "trending_now":
        path = "/trending/all/day"; break;

      default:
        path = "/movie/popular"; break;
    }

    const data = await tmdbFetch(path, params);
    return (data.results || []).map(mapTmdbToAnime);
  },

  async getDiscover() {
    const fetchSection = async (title, platform) => {
      try {
        const items = await this.browse({ platform, page: 1 });
        return { title, platform, items: items.slice(0, 20) };
      } catch (e) { return null; }
    };

    const sections = (await Promise.all([
      fetchSection("🔥 Trending Now", "trending_now"),
      fetchSection("🎬 In Theatres", "in_theatres"),
      fetchSection("📺 Popular TV Shows", "popular_tv"),
      fetchSection("⭐ Top Rated Movies", "top_movies"),
      fetchSection("🏆 Top Rated Shows", "top_tv"),
      fetchSection("🆕 New Releases", "upcoming"),
      fetchSection("📡 Currently Airing", "on_the_air"),
      fetchSection("🎥 Bollywood", "bollywood"),
      fetchSection("🟥 Netflix", "netflix"),
      fetchSection("🔵 Prime Video", "prime"),
    ])).filter(Boolean);

    return {
      filters: {
        platforms: [
          { label: "Movies", value: "popular_movies" },
          { label: "TV Shows", value: "popular_tv" },
          { label: "Trending", value: "trending_now" },
        ]
      },
      sections
    };
  },

  async getEpisodes(anime, options = {}) {
    if (anime.format === "MOVIE" || anime.type === "movie") {
      return {
        episodes: [{ id: String(anime.id || anime.tmdbId), number: 1, title: "Full Movie" }]
      };
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
          overview: e.overview || "",
          image: e.still_path ? `https://image.tmdb.org/t/p/w300${e.still_path}` : null,
          season: s.season_number,
          imdbId
        }));
        return { season: s.season_number, name: `Season ${s.season_number}`, episodes: eps };
      } catch (e) { return null; }
    });

    result.seasons = (await Promise.all(promises)).filter(Boolean);
    return result;
  },

  async getStream(anime, episodeId) {
    let streamId = String(episodeId);
    let type = "movie";
    let sNum = 1, eNum = 1;

    if (streamId.includes(":")) {
      type = "tv";
      const p = streamId.split(":");
      sNum = parseInt(p[1]);
      eNum = parseInt(p[2]);
    }

    const mediaInfo = {
      title: anime.title || anime.titleEnglish,
      year: anime.seasonYear
    };

    const servers = await getHDHubStreams(
      anime.tmdbId || anime.id, type, mediaInfo, sNum, eNum
    );

    if (!servers || servers.length === 0) {
      throw new Error("No streams found on HDHub4u. Try another server.");
    }

    return {
      servers: servers,
      type: "mp4",
      url: servers[0].url,
      subtitles: [],
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Referer": `${MAIN_URL}/`
      }
    };
  }
};
