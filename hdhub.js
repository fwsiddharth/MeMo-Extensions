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
        path = "/trending/movie/week";
        break;
      case "fan_favorites":
        path = "/movie/top_rated";
        break;
      case "top_tv_movies":
        path = "/trending/all/week";
        break;
      case "popular":
        path = "/movie/popular";
        break;
      case "kdramas":
        path = "/discover/tv";
        params.with_original_language = "ko";
        params.sort_by = "popularity.desc";
        break;
      case "upcoming":
        path = "/movie/upcoming";
        break;
      // PLATFORMS
      case "netflix":
        path = "/discover/movie";
        params.with_watch_providers = "8";
        params.sort_by = "popularity.desc";
        break;
      case "prime":
        path = "/discover/movie";
        params.with_watch_providers = "119";
        params.sort_by = "popularity.desc";
        break;
      case "jiohotstar":
        path = "/discover/movie";
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
      fetchSection("New Indian Movies", "new_indian"),
      fetchSection("Bollywood OTT Releases", "bollywood_ott"),
      fetchSection("Top 10 on IMDb this week", "imdb_top10"),
      fetchSection("Fan favorites", "fan_favorites"),
      fetchSection("This week's top TV and movies", "top_tv_movies"),
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
    return {
      translationOptions: ["sub", "dub"],
      activeTranslation: "dub",
      episodes: [
        {
          id: String(anime.id || anime.tmdbId),
          number: 1,
          title: "Full Movie"
        }
      ]
    };
  },

  async getStream(anime, episodeId) {
    const tmdbId = String(episodeId);
    let imdbId = null;
    
    // 1. Fetch IMDb ID from TMDB
    try {
      const type = (anime.format === "TV" || anime.type === "TV") ? "tv" : "movie";
      const tmdbData = await tmdbFetch(`/${type}/${tmdbId}/external_ids`);
      imdbId = tmdbData.imdb_id;
    } catch (e) {
      console.error("Failed to fetch IMDb ID", e);
    }

    if (!imdbId) throw new Error("Could not find IMDb ID for this title.");

    // 2. Fetch Stremio Addon Streams
    const addonUrl = `https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9`;
    
    // Determine stream id (movie vs series)
    let streamId = imdbId;
    let type = "movie";
    if (anime.format === "TV" || anime.type === "TV") {
      type = "series";
      streamId = `${imdbId}:${anime.season || 1}:${anime.episode || 1}`;
    }

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

    return {
      servers: servers,
      type: "mp4",
      url: servers[0].url
    };
  }
};
