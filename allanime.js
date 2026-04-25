const BASE_URL = "https://allmanga.to";
const API_URL = "https://api.allanime.day/api";

// Minified queries to avoid parsing issues in some environments
const SEARCH_QUERY = `query($search:SearchInput,$limit:Int,$page:Int,$translationType:VaildTranslationTypeEnumType,$countryOrigin:VaildCountryOriginEnumType){shows(search:$search,limit:$limit,page:$page,translationType:$translationType,countryOrigin:$countryOrigin){edges{_id,name,thumbnail,englishName}}}`;
const DETAILS_QUERY = `query($_id:String!){show(_id:$_id){_id,name,englishName,nativeName,thumbnail,description,genres,status,availableLanguages}}`;
const EPISODES_QUERY = `query($showId:String!){show(_id:$showId){availableEpisodesDetail}}`;
const STREAM_QUERY = `query($showId:String!,$translationType:VaildTranslationTypeEnumType!,$episodeString:String!){episode(showId:$showId,translationType:$translationType,episodeString:$episodeString){sourceUrls}}`;

function buildHeaders() {
  return {
    "Accept": "*/*",
    "Content-Type": "application/json",
    "Origin": BASE_URL,
    "Referer": `${BASE_URL}/`,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
  };
}

async function gqlRequest(query, variables = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({ query, variables })
    });
    
    const json = await response.json();
    if (json.errors) throw new Error(json.errors[0]?.message || "GraphQL Error");
    return json.data;
  } catch (err) {
    console.error("AllAnime Request Failed:", err.message);
    throw err;
  }
}

function mapShow(show) {
  const thumbnail = show.thumbnail || "";
  return {
    id: show._id,
    title: show.englishName || show.name || "Unknown",
    thumbnail: thumbnail.startsWith("http") ? thumbnail : `https://wp.youtube-anime.com/aln.youtube-anime.com/${thumbnail}?w=250`,
    provider: "allanime"
  };
}

module.exports = {
  name: "allanime",

  async search(query, options = {}) {
    const data = await gqlRequest(SEARCH_QUERY, {
      search: {
        query: query,
        allowAdult: true,
        allowUnknown: false
      },
      limit: 26,
      page: 1,
      translationType: options.translationType || "sub"
    });

    return (data?.shows?.edges || []).map(mapShow);
  },

  async getDiscover() {
    const data = await gqlRequest(SEARCH_QUERY, {
      search: {
        sortBy: "Recent_Update_ASC",
        allowAdult: true
      },
      limit: 26,
      page: 1,
      translationType: "sub"
    });

    return {
      sections: [
        {
          id: "trending",
          title: "Trending on AllAnime",
          items: (data?.shows?.edges || []).map(mapShow)
        }
      ]
    };
  },

  async getEpisodes(anime, options = {}) {
    const showId = anime.id;
    const details = await gqlRequest(DETAILS_QUERY, { _id: showId });
    const epData = await gqlRequest(EPISODES_QUERY, { showId });
    
    const show = details?.show || {};
    const translationType = options.translationType || "sub";
    const availableEps = epData?.show?.availableEpisodesDetail?.[translationType] || [];
    
    return {
      translationOptions: show.availableLanguages || ["sub", "dub"],
      activeTranslation: translationType,
      episodes: availableEps.sort((a, b) => parseFloat(b) - parseFloat(a)).map(ep => ({
        id: `allanime|${showId}|${ep}|${translationType}`,
        number: parseFloat(ep),
        title: `Episode ${ep}`
      }))
    };
  },

  async getStream(_anime, episodeId) {
    const [_, showId, epNum, lang] = episodeId.split("|");
    
    const data = await gqlRequest(STREAM_QUERY, {
      showId: showId,
      translationType: lang,
      episodeString: epNum
    });

    const sources = data?.episode?.sourceUrls || [];
    if (!sources.length) throw new Error("No stream sources found for AllAnime.");

    // Pick best source (prefer common reliable ones)
    const preferred = ["Limax", "Gogoanime", "Vidstreaming", "Mp4Upload"];
    const bestSource = sources.find(s => preferred.includes(s.sourceName)) || sources[0];

    let streamUrl = bestSource.sourceUrl;
    
    // Hex decode if necessary
    if (streamUrl.startsWith("--")) {
        streamUrl = streamUrl.substring(2).match(/.{1,2}/g).map(hex => String.fromCharCode(parseInt(hex, 16))).join("");
    }

    if (streamUrl.startsWith("/clock?")) {
        streamUrl = `https://allmanga.to${streamUrl}`;
    }

    return {
      type: "embed",
      url: streamUrl,
      embedOrigin: "https://allmanga.to",
      headers: {
        "Referer": "https://allmanga.to/",
        "User-Agent": "Mozilla/5.0"
      }
    };
  }
};

