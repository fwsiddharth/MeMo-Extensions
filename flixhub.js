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
    title: item.title || item.original_title,
    titleEnglish: item.title,
    titleRomaji: item.original_title,
    description: item.overview || "",
    provider: "flixhub",
    seasonYear: item.release_date ? parseInt(item.release_date.split("-")[0]) : null,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
    coverImage: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
    format: "MOVIE"
  };
}

module.exports = {
  name: "flixhub",

  async search(query, options = {}) {
    const data = await tmdbFetch("/search/movie", { query, include_adult: false, page: options.page || 1 });
    return (data.results || []).map(mapTmdbToAnime);
  },

  async browse(options = {}) {
    let path = "/movie/popular";
    const params = { page: options.page || 1 };

    if (options.platform === "trending") path = "/trending/movie/day";
    else if (options.platform === "top_rated") path = "/movie/top_rated";
    else if (options.platform === "bollywood") {
      path = "/discover/movie";
      params.with_original_language = "hi";
    } else if (options.platform === "action") {
      path = "/discover/movie";
      params.with_genres = "28";
    }

    const data = await tmdbFetch(path, params);
    return (data.results || []).map(mapTmdbToAnime);
  },

  async getDiscover() {
    const fetchSection = async (title, platform) => {
      try {
        const items = await this.browse({ platform, page: 1 });
        return { title, platform, items: items.slice(0, 15) }; // Show top 15 in row
      } catch (e) {
        return null;
      }
    };

    const sections = (await Promise.all([
      fetchSection("🔥 Trending Movies Today", "trending"),
      fetchSection("🍿 Popular Bollywood", "bollywood"),
      fetchSection("⭐ Top Rated Movies", "top_rated"),
      fetchSection("💥 Action Packed", "action")
    ])).filter(Boolean);

    return {
      filters: {},
      sections
    };
  },

  async getEpisodes(anime, options = {}) {
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
    const servers = [];

    // --- HINDI (DUB) SERVERS ---
    servers.push({ type: "embed", name: "FlixScape (Hindi)", url: `https://flix.screenscape.me/embed?tmdb=${tmdbId}&type=movie&lan=hindi` });
    servers.push({ type: "embed", name: "Peachify (Hindi)", url: `https://peachify.top/embed/movie/${tmdbId}?server=iron&dub=hindi&autoPlay=true&accent=B54666` });
    servers.push({ type: "embed", name: "Videasy (Hindi)", url: `https://player.videasy.net/movie/${tmdbId}?color=8B5CF6&nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true&dub=true` });
    servers.push({ type: "embed", name: "VersePlay (Hindi)", url: `https://verseplay.site/movie/${tmdbId}?dub=hindi&autoPlay=true` });
    servers.push({ type: "embed", name: "Nxsha (Hindi)", url: `https://nxsha.site/movie/${tmdbId}?dub=hindi&autoPlay=true` });

    // --- ENGLISH (SUB/DEFAULT) SERVERS ---
    servers.push({ type: "embed", name: "FlixScape (English)", url: `https://flix.screenscape.me/embed?tmdb=${tmdbId}&type=movie` });
    servers.push({ type: "embed", name: "Peachify (English)", url: `https://peachify.top/embed/movie/${tmdbId}?server=iron&autoPlay=true&accent=B54666` });
    servers.push({ type: "embed", name: "Videasy (English)", url: `https://player.videasy.net/movie/${tmdbId}?color=8B5CF6&nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true` });
    servers.push({ type: "embed", name: "VIDNEST (English)", url: `https://vidnest.fun/embed/movie/${tmdbId}` });
    servers.push({ type: "embed", name: "NetOut (English)", url: `https://netout.site/movie/${tmdbId}?autoPlay=true` });

    return {
      servers: servers,
      type: "embed",
      url: servers[0].url
    };
  }
};
