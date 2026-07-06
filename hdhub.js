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
    provider: "hdhub",
    seasonYear: (item.release_date || item.first_air_date) ? parseInt((item.release_date || item.first_air_date).split("-")[0]) : null,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
    coverImage: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
    rating: item.vote_average ? item.vote_average.toFixed(1) : "0.0",
    format: item.media_type === "tv" || item.first_air_date ? "TV" : "MOVIE"
  };
}
async function getVidlinkStream(tmdbId, mediaType, s, e) {
  try {
    const encRes = await fetch(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`);
    const encData = await encRes.json();
    if (!encData.result) return null;
    
    const encryptedId = encData.result;
    let url = "";
    if (mediaType === "tv") {
       url = `https://vidlink.pro/api/b/tv/${encryptedId}/${s}/${e}`;
    } else {
       url = `https://vidlink.pro/api/b/movie/${encryptedId}`;
    }

    const res = await fetch(url, {
       headers: {
         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
         "Referer": "https://vidlink.pro/",
         "Origin": "https://vidlink.pro"
       }
    });
    
    const data = await res.json();
    if (!data.stream) return null;
    
    // Attempt to extract all qualities
    let vidlinkServers = [];
    
    function formatBytes(bytes) {
      if (!bytes) return "Unknown Size";
      const b = parseInt(bytes, 10);
      if (isNaN(b) || b === 0) return "Unknown Size";
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(b) / Math.log(k));
      return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    if (data.stream.qualities) {
      for (const [res, obj] of Object.entries(data.stream.qualities)) {
         if (obj && obj.url) {
           vidlinkServers.push({
             type: "mp4",
             name: `Vidlink - ${res}p`,
             quality: `${res}p`,
             language: "Multi",
             size: formatBytes(obj.size),
             url: obj.url
           });
         }
      }
      // Sort highest quality first
      vidlinkServers.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
    }
    
    if (data.stream.playlist && vidlinkServers.length === 0) {
      vidlinkServers.push({
         type: "hls",
         name: "Vidlink - Auto",
         quality: "Auto",
         language: "Multi",
         size: "Unknown Size",
         url: data.stream.playlist
      });
    } else if (data.url && vidlinkServers.length === 0) {
      vidlinkServers.push({
         type: "mp4",
         name: "Vidlink - Auto",
         quality: "Auto",
         language: "Multi",
         size: "Unknown Size",
         url: data.url
      });
    }

    let subs = [];
    if (data.stream.captions) {
      subs = data.stream.captions
        .filter(c => c.type === 'srt' || c.type === 'vtt')
        .map(c => ({
          label: c.language,
          url: c.url,
          lang: c.language ? c.language.substring(0, 3).toLowerCase() : 'unk'
        }));
    }

    return {
       servers: vidlinkServers,
       subtitles: subs
    };
  } catch (err) {
    console.error("Vidlink extraction failed", err);
    return null;
  }
}

module.exports = {
  name: "hdhub",
  type: "zoro",

  async search(query, options = {}) {
    const data = await tmdbFetch("/search/multi", { query, include_adult: false, page: options.page || 1 });
    return (data.results || []).filter(i => i.media_type !== "person").map(mapTmdbToAnime);
  },

  async browse(options = {}) {
    let path = "/movie/popular";
    const params = { page: options.page || 1, watch_region: "IN" };

    switch (options.platform) {
      case "latest":
        path = "/movie/now_playing";
        break;
      case "trending_now":
        path = "/trending/all/day";
        break;
      case "new_indian":
        path = "/discover/movie";
        params.with_original_language = "hi";
        params.region = "IN";
        params.sort_by = "primary_release_date.desc";
        params["primary_release_date.lte"] = new Date().toISOString().split("T")[0];
        break;
      case "bollywood_ott":
        path = "/discover/movie";
        params.with_original_language = "hi";
        params.with_watch_providers = "8|119|122"; // Netflix, Prime, Hotstar
        params.sort_by = "primary_release_date.desc";
        params["primary_release_date.lte"] = new Date().toISOString().split("T")[0];
        break;
      case "imdb_top10":
        path = "/trending/all/week";
        break;
      case "fan_favorites":
        path = "/tv/top_rated";
        break;
      case "top_tv_movies":
        path = "/trending/all/week";
        break;
      case "popular":
        path = "/movie/popular";
        break;
      case "popular_tv":
        path = "/tv/popular";
        break;
      case "kdramas":
        path = "/discover/tv";
        params.with_original_language = "ko";
        params.sort_by = "popularity.desc";
        break;
      case "upcoming":
        path = "/movie/upcoming";
        break;
      // PLATFORMS (Support both TV and Movie by using discover/tv for a specific one, or relying on multi search later, but for now just discover/movie)
      case "netflix":
        path = "/discover/tv";
        params.with_watch_providers = "8";
        params.sort_by = "popularity.desc";
        break;
      case "prime":
        path = "/discover/tv";
        params.with_watch_providers = "119";
        params.sort_by = "popularity.desc";
        break;
      case "jiohotstar":
        path = "/discover/tv";
        params.with_watch_providers = "122";
        params.sort_by = "popularity.desc";
        break;
    }

    const data = await tmdbFetch(path, params);
    return (data.results || []).map(mapTmdbToAnime);
  },

  async getDiscover() {
    const fetchSection = async (title, platform) => {
      try {
        const items = await this.browse({ platform, page: 1 });
        return { title, platform, items: items.slice(0, 15) };
      } catch (e) {
        return null;
      }
    };

    const sections = (await Promise.all([
      fetchSection("Latest Release", "latest"),
      fetchSection("Trending Now", "trending_now"),
      fetchSection("Popular TV Shows", "popular_tv"),
      fetchSection("New Indian Movies", "new_indian"),
      fetchSection("Bollywood OTT Releases", "bollywood_ott"),
      fetchSection("Top 10 on IMDb this week", "imdb_top10"),
      fetchSection("Top Rated TV", "fan_favorites"),
      fetchSection("Popular Movies", "popular"),
      fetchSection("Popular K-Dramas", "kdramas"),
      fetchSection("Top Upcoming", "upcoming")
    ])).filter(Boolean);

    return {
      filters: {
        platforms: [
          { value: 'netflix', label: 'Netflix' },
          { value: 'prime', label: 'Prime Video' },
          { value: 'jiohotstar', label: 'JioHotstar' }
        ]
      },
      sections
    };
  },

  async getEpisodes(anime, options = {}) {
    if (anime.format === "MOVIE" || anime.type === "movie") {
      return {
        episodes: [
          {
            id: String(anime.id || anime.tmdbId),
            number: 1,
            title: "Full Movie"
          }
        ]
      };
    }

    // Series logic
    const tmdbId = String(anime.id || anime.tmdbId);
    let imdbId = null;
    let seasonsData = [];
    
    try {
      // 1. Fetch TV Details (to get number of seasons)
      const tvData = await tmdbFetch(`/tv/${tmdbId}`);
      // 2. Fetch external IDs
      const extData = await tmdbFetch(`/tv/${tmdbId}/external_ids`);
      imdbId = extData.imdb_id;
      
      seasonsData = tvData.seasons || [];
    } catch (e) {
      console.error("Failed to fetch TMDB TV details", e);
    }

    if (!imdbId) throw new Error("Could not find IMDb ID for this series.");
    
    const validSeasons = seasonsData.filter(s => s.season_number > 0);
    const result = { seasons: [] };
    
    const promises = validSeasons.map(async (s) => {
      try {
        const sData = await tmdbFetch(`/tv/${tmdbId}/season/${s.season_number}`);
        const eps = (sData.episodes || []).map(e => ({
          id: `${imdbId}:${s.season_number}:${e.episode_number}`,
          number: e.episode_number,
          title: e.name || `Episode ${e.episode_number}`,
          overview: e.overview,
          image: e.still_path ? `https://image.tmdb.org/t/p/w300${e.still_path}` : null,
          season: s.season_number,
          imdbId
        }));
        return {
          season: s.season_number,
          name: s.name || `Season ${s.season_number}`,
          episodes: eps
        };
      } catch(e) { return null; }
    });
    
    const resolved = await Promise.all(promises);
    result.seasons = resolved.filter(Boolean);
    
    return result;
  },

  async getStream(anime, episodeId) {
    let streamId = String(episodeId);
    let type = "movie";
    
    // Check if it's a series ID (e.g., tt123:1:1)
    if (streamId.includes(":")) {
      type = "series";
      // streamId is already correctly formatted as ttId:s:e
    } else {
      // It's a movie, need to convert TMDB to IMDB if not already tt...
      if (!streamId.startsWith("tt")) {
        try {
          const tmdbData = await tmdbFetch(`/movie/${streamId}/external_ids`);
          streamId = tmdbData.imdb_id;
        } catch (e) {
          console.error("Failed to fetch IMDb ID", e);
        }
      }
    }

    if (!streamId || !streamId.startsWith("tt")) throw new Error("Could not find valid IMDb ID for this title.");

    let hdhubServers = [];
    let hdhubError = null;

    try {
      const addonUrl = `https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9`;
      const req = await fetch(`${addonUrl}/stream/${type}/${streamId}.json`);
      const data = await req.json();

      if (data.streams && data.streams.length > 0) {
        let filteredStreams = data.streams;
        const expectedYear = anime.seasonYear;
        if (expectedYear) {
          filteredStreams = filteredStreams.filter(s => {
            const textToSearch = (s.name || "") + " " + (s.description || "") + " " + (s.title || "");
            const yearMatches = textToSearch.match(/\b(19\d{2}|20\d{2})\b/g);
            if (yearMatches && yearMatches.length > 0) {
              const streamYear = parseInt(yearMatches[0]);
              if (Math.abs(streamYear - expectedYear) > 1) { 
                return false;
              }
            }
            return true;
          });
        }
        hdhubServers = filteredStreams;
      }
    } catch(err) {
      hdhubError = err.message;
    }

    let servers = hdhubServers.map((s, idx) => {
      let quality = "Unknown";
      if (s.name.includes("2160") || s.name.includes("4K")) quality = "4K";
      else if (s.name.includes("1080")) quality = "1080p";
      else if (s.name.includes("720")) quality = "720p";
      else if (s.name.includes("480")) quality = "480p";
      
      let size = "Unknown Size";
      let lang = "Unknown Audio";
      
      if (s.description) {
        const sizeMatch = s.description.match(/💾\s*([^\]]+)\]/);
        if (sizeMatch) size = sizeMatch[1].trim();
        
        const lines = s.description.split('\n');
        if (lines.length >= 2) {
           lang = lines[1].trim();
        }
      }
      
      return {
        type: "mp4",
        name: `HDHub - ${quality}`,
        quality,
        language: lang,
        size,
        url: s.url,
      };
    });

    // Try Vidlink Native Fallback
    const tmdbIdForVidlink = String(anime.tmdbId || anime.id || streamId.replace('tt', ''));
    let sNum = 1;
    let eNum = 1;
    if (type === "series") {
       const p = String(episodeId).split(":");
       if (p.length >= 3) {
         sNum = p[1];
         eNum = p[2];
       }
    }
    const vidlinkData = await getVidlinkStream(tmdbIdForVidlink, type === "series" ? "tv" : "movie", sNum, eNum);
    
    let finalType = servers.length > 0 ? "mp4" : "mp4";
    let subtitles = [];

    if (vidlinkData && vidlinkData.servers.length > 0) {
      // Put Vidlink servers at the top!
      servers = [...vidlinkData.servers, ...servers];
      finalType = vidlinkData.servers[0].type;
      subtitles = vidlinkData.subtitles || [];
    }

    if (servers.length === 0) {
      throw new Error(`No streams found. HDHub Error: ${hdhubError}`);
    }

    // Only fetch opensubtitles if Vidlink didn't provide enough
    if (subtitles.length === 0) {
      try {
        const subReq = await fetch(`https://opensubtitles-v3.strem.io/subtitles/${type}/${streamId}.json`);
        const subData = await subReq.json();
        if (subData.subtitles) {
          const allowedLangs = { 'eng': 'English', 'hin': 'Hindi', 'spa': 'Spanish', 'ara': 'Arabic' };
          let subsRaw = subData.subtitles
            .filter(s => allowedLangs[s.lang])
            .map(s => ({
              label: allowedLangs[s.lang],
              url: s.url,
              lang: s.lang
            }));
          
          subsRaw.sort((a, b) => {
            if (a.lang === 'eng') return -1;
            if (b.lang === 'eng') return 1;
            return 0;
          });

          const uniqueSubs = [];
          const seenLangs = new Set();
          for (let sub of subsRaw) {
            if (!seenLangs.has(sub.lang)) {
              seenLangs.add(sub.lang);
              uniqueSubs.push(sub);
            }
          }
          subtitles = uniqueSubs;
        }
      } catch (e) {
        console.error("Failed to fetch subtitles from OpenSubtitles", e);
      }
    }

    return {
      servers: servers,
      type: finalType,
      url: servers[0].url,
      subtitles: subtitles
    };
  }
};
