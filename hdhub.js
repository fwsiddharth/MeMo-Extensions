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

    // 2. Fetch Stremio Addon Streams
    const addonUrl = `https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9`;
    
    const req = await fetch(`${addonUrl}/stream/${type}/${streamId}.json`);
    const data = await req.json();

    if (!data.streams || data.streams.length === 0) {
      throw new Error("No streams found on HdHub.");
    }

    // Filter out streams that clearly belong to a different year (fixes Alpha 2026 vs 2018 mismatch)
    const expectedYear = anime.seasonYear;
    if (expectedYear) {
      data.streams = data.streams.filter(s => {
        const textToSearch = (s.name || "") + " " + (s.description || "") + " " + (s.title || "");
        const yearMatches = textToSearch.match(/\b(19\d{2}|20\d{2})\b/g);
        if (yearMatches && yearMatches.length > 0) {
          // If we find a year in the torrent title (usually the first 4-digit number after the title)
          // and it doesn't match our expected year, discard it to prevent playing the wrong movie.
          const streamYear = parseInt(yearMatches[0]);
          if (Math.abs(streamYear - expectedYear) > 1) { 
            return false;
          }
        }
        return true;
      });
    }

    if (data.streams.length === 0) {
      throw new Error("No matching streams found for this release year.");
    }

    const servers = data.streams.map((s, idx) => {
      let quality = "Unknown";
      if (s.name.includes("2160") || s.name.includes("4K")) quality = "4K";
      else if (s.name.includes("1080")) quality = "1080p";
      else if (s.name.includes("720")) quality = "720p";
      else if (s.name.includes("480")) quality = "480p";
      
      let size = "Unknown Size";
      let lang = "Unknown Audio";
      
      if (s.description) {
        // e.g. "[Download] [💾 7.07 GB] Inception...mkv\nHindi\nDownload | HdHub"
        const sizeMatch = s.description.match(/💾\s*([^\]]+)\]/);
        if (sizeMatch) size = sizeMatch[1].trim();
        
        const lines = s.description.split('\n');
        if (lines.length >= 2) {
           lang = lines[1].trim();
        }
      }
      
      return {
        type: "mp4", // This tells Gear5 to use Native VideoPlayer
        name: s.name.split(' ')[0] || `Server ${idx+1}`, // e.g. HdHub
        quality,
        language: lang,
        size,
        url: s.url,
      };
    });

    let subtitles = [];
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

    return {
      servers: servers,
      type: "mp4",
      url: servers[0].url,
      subtitles: subtitles
    };
  }
};
