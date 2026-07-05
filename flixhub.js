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
    provider: "flixhub",
    seasonYear: (item.release_date || item.first_air_date) ? parseInt((item.release_date || item.first_air_date).split("-")[0]) : null,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
    coverImage: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
    rating: item.vote_average ? item.vote_average.toFixed(1) : "0.0",
    format: item.media_type === "tv" || item.first_air_date ? "TV" : "MOVIE"
  };
}

module.exports = {
  name: "flixhub",

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
