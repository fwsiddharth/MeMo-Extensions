const TMDB_API_KEY = "3b0fa3c43dea59ff255ee83f04849655";
const TMDB_BASE = "https://api.themoviedb.org/3";

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

module.exports = {
  name: "flixhub",

  async search(query) {
    // Only focus on movies as requested
    const data = await tmdbFetch("/search/movie", { query, include_adult: false });
    return (data.results || []).map((item) => ({
      id: String(item.id),
      title: item.title || item.original_title,
      titleEnglish: item.title,
      titleRomaji: item.original_title,
      provider: "flixhub",
      seasonYear: item.release_date ? parseInt(item.release_date.split("-")[0]) : null,
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
      format: "MOVIE"
    }));
  },

  async getEpisodes(anime, options = {}) {
    // Movies only have 1 episode
    return {
      translationOptions: ["sub", "dub"],
      activeTranslation: "dub", // Default to dub for Hindi
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
    
    // The user requested: "only focus hindi and rest server should be english okay"
    // So we provide Hindi as the primary servers, and English as fallbacks.
    
    const servers = [];

    // --- HINDI (DUB) SERVERS ---
    
    // FlixScape Hindi
    servers.push({
      type: "embed",
      name: "FlixScape (Hindi)",
      url: `https://flix.screenscape.me/embed?tmdb=${tmdbId}&type=movie&lan=hindi`
    });

    // Peachify Hindi
    servers.push({
      type: "embed",
      name: "Peachify (Hindi)",
      url: `https://peachify.top/embed/movie/${tmdbId}?server=iron&dub=hindi&autoPlay=true&accent=B54666`
    });
    
    // Videasy Hindi
    servers.push({
      type: "embed",
      name: "Videasy (Hindi)",
      url: `https://player.videasy.net/movie/${tmdbId}?color=8B5CF6&nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true&dub=true`
    });
    
    // VersePlay Hindi
    servers.push({
      type: "embed",
      name: "VersePlay (Hindi)",
      url: `https://verseplay.site/movie/${tmdbId}?dub=hindi&autoPlay=true`
    });

    // Nxsha Hindi
    servers.push({
      type: "embed",
      name: "Nxsha (Hindi)",
      url: `https://nxsha.site/movie/${tmdbId}?dub=hindi&autoPlay=true`
    });

    // --- ENGLISH (SUB/DEFAULT) SERVERS ---

    // FlixScape English
    servers.push({
      type: "embed",
      name: "FlixScape (English)",
      url: `https://flix.screenscape.me/embed?tmdb=${tmdbId}&type=movie`
    });

    // Peachify English
    servers.push({
      type: "embed",
      name: "Peachify (English)",
      url: `https://peachify.top/embed/movie/${tmdbId}?server=iron&autoPlay=true&accent=B54666`
    });

    // Videasy English
    servers.push({
      type: "embed",
      name: "Videasy (English)",
      url: `https://player.videasy.net/movie/${tmdbId}?color=8B5CF6&nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true`
    });

    // Vidnest English
    servers.push({
      type: "embed",
      name: "VIDNEST (English)",
      url: `https://vidnest.fun/embed/movie/${tmdbId}`
    });

    // NetOut English
    servers.push({
      type: "embed",
      name: "NetOut (English)",
      url: `https://netout.site/movie/${tmdbId}?autoPlay=true`
    });

    return {
      servers: servers,
      // If the app expects a single URL at the root level, we provide the best one
      type: "embed",
      url: servers[0].url
    };
  }
};
