const BASE_URL = "https://allmanga.to";
const API_URL = "https://api.allanime.day/api";

// Queries aligned with Tachiyomi AllAnime extension
const SEARCH_QUERY = `query($search:SearchInput,$limit:Int,$page:Int,$translationType:VaildTranslationTypeEnumType,$countryOrigin:VaildCountryOriginEnumType){shows(search:$search,limit:$limit,page:$page,translationType:$translationType,countryOrigin:$countryOrigin){edges{_id,name,thumbnail,englishName}}}`;
const DETAILS_QUERY = `query($_id:String!){show(_id:$_id){_id,name,thumbnail,description,genres,status,altNames,englishName}}`;
const EPISODES_QUERY = `query($id:String!,$start:Float!,$end:Float!){episodeInfos(showId:$id,episodeNumStart:$start,episodeNumEnd:$end){episodeIdNum,notes,uploadDates}}`;
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

async function decryptAesGcm(encoded) {
  const isNode = typeof window === 'undefined';
  const keyString = "Xot36i3lK3:v1";
  
  let atobFn = isNode ? (str) => Buffer.from(str, 'base64').toString('binary') : atob;
  
  const binaryString = atobFn(encoded);
  const data = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    data[i] = binaryString.charCodeAt(i);
  }
  
  const iv = data.slice(1, 13);
  const ciphertext = data.slice(13);
  
  if (isNode) {
    const crypto = require('crypto');
    const keyHash = crypto.createHash('sha256').update(keyString).digest();
    const authTag = ciphertext.slice(-16);
    const actualCiphertext = ciphertext.slice(0, -16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyHash, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(actualCiphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } else {
    // Web Crypto API for React Native WebView
    if (!window.crypto || !window.crypto.subtle) {
      if (window.forge) {
        const forgeStr = atob(encoded);
        const forgeIv = forgeStr.substring(1, 13);
        const forgeCiphertext = forgeStr.substring(13, forgeStr.length - 16);
        const forgeTag = forgeStr.substring(forgeStr.length - 16);
        
        const md = window.forge.md.sha256.create();
        md.update(keyString);
        const forgeKeyBytes = md.digest().getBytes();
        
        const decipher = window.forge.cipher.createDecipher('AES-GCM', forgeKeyBytes);
        decipher.start({
          iv: forgeIv,
          tag: window.forge.util.createBuffer(forgeTag)
        });
        decipher.update(window.forge.util.createBuffer(forgeCiphertext));
        const pass = decipher.finish();
        
        if (pass) {
          return decipher.output.toString('utf8');
        } else {
          throw new Error('Forge Decryption failed');
        }
      }
      
      console.log("CRITICAL: window.crypto.subtle and window.forge are NOT available!");
      throw new Error("Web Crypto API is not available.");
    }
    
    try {
      const encoder = new TextEncoder();
      const keyMaterial = encoder.encode(keyString);
      const keyHash = await window.crypto.subtle.digest("SHA-256", keyMaterial);
      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyHash,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );
      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        cryptoKey,
        ciphertext
      );
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(decrypted);
    } catch (e) {
      console.log("CRITICAL: Web Crypto Decryption Failed:", e.message, e.name);
      throw e;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gqlRequest(query, variables = {}, retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(API_URL, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ query, variables }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (attempt < retries) {
          await sleep(500 * (attempt + 1));
          continue;
        }
        throw new Error(`AllAnime HTTP ${response.status}`);
      }
      
      const json = await response.json();
      if (json.errors) throw new Error(json.errors[0]?.message || "GraphQL Error");
      
      let data = json.data;
      if (data && data.tobeparsed) {
        const decryptedString = await decryptAesGcm(data.tobeparsed);
        data = JSON.parse(decryptedString);
      }
      
      return data;
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError' || err.message.includes('timeout')) {
        console.log(`AllAnime Request Timeout (attempt ${attempt + 1})`);
      } else {
        console.error("AllAnime Request Failed:", err.message);
      }
      if (attempt < retries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
    }
  }
  throw lastError || new Error("AllAnime Request Failed after retries");
}

function titleToSlug(title) {
    return title.trim().toLowerCase().replace(/[^a-z\d]+/g, "-");
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
    console.log("allanime.getEpisodes called for anime:", JSON.stringify(anime));
    let showId = anime.id;
    
    // If the ID is an AniList/Kitsu ID (numeric), we need to search for it first
    if (!isNaN(showId) || String(showId).length < 8) {
      const title = anime.title?.english || anime.title?.romaji || anime.title;
      console.log(`allanime: Resolving Anilist ID ${showId} via search query: "${title}"`);
      const searchResults = await this.search(title);
      if (searchResults && searchResults.length > 0) {
        showId = searchResults[0].id;
        console.log(`allanime: Mapped AniList ${anime.id} to AllAnime ID ${showId}`);
      } else {
        throw new Error(`AllAnime: Could not find show matching title: ${title}`);
      }
    }
    
    const translationType = options.translationType || "sub";
    
    // Fetch episodes list using episodeInfos (aligned with Tachiyomi)
    console.log(`allanime: fetching episodes for showId=${showId}`);
    const epData = await gqlRequest(EPISODES_QUERY, { 
        id: showId,
        start: 0,
        end: 9999
    });
    
    const episodes = epData?.episodeInfos || [];
    console.log("allanime: found episodes count:", episodes.length);
    
    return {
      translationOptions: ["sub", "dub"],
      activeTranslation: translationType,
      episodes: episodes.sort((a, b) => parseFloat(b.episodeIdNum) - parseFloat(a.episodeIdNum)).map(ep => ({
        id: `allanime|${showId}|${ep.episodeIdNum}|${translationType}`,
        number: parseFloat(ep.episodeIdNum),
        title: ep.notes ? `Episode ${ep.episodeIdNum}: ${ep.notes}` : `Episode ${ep.episodeIdNum}`
      }))
    };
  },

  async getStream(_anime, episodeId) {
    console.log("allanime.getStream called for episodeId:", episodeId);
    const [_, showId, epNum, lang] = episodeId.split("|");
    
    console.log(`allanime: fetching stream for showId=${showId}, epNum=${epNum}, lang=${lang}`);
    const data = await gqlRequest(STREAM_QUERY, {
      showId: showId,
      translationType: lang,
      episodeString: epNum
    });

    console.log("allanime: stream data received:", JSON.stringify(data));
    const sources = data?.episode?.sourceUrls || [];
    console.log("allanime: stream sources count:", sources.length);
    if (!sources.length) throw new Error("No stream sources found for AllAnime.");

    const preferred = ["Yt-mp4", "Luf-mp4", "Default", "Limax", "Gogoanime", "Vidstreaming", "Mp4Upload"];
    
    // Sort sources by preferred list
    const bestSource = sources.sort((a, b) => {
      const indexA = preferred.indexOf(a.sourceName);
      const indexB = preferred.indexOf(b.sourceName);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    })[0] || sources[0];

    let streamUrl = bestSource.sourceUrl;
    if (streamUrl.startsWith("--")) {
        streamUrl = streamUrl.substring(2).match(/.{1,2}/g).map(hex => String.fromCharCode(parseInt(hex, 16) ^ 56)).join("");
    }

    if (streamUrl.startsWith("/clock?")) {
        streamUrl = `https://allmanga.to${streamUrl}`;
    }

    // Clean up any accidental double slashes in the path (e.g. //media3 -> /media3)
    streamUrl = streamUrl.replace(/([^:]\/)\/+/g, "$1");

    // "player" type from AllAnime usually means it's a direct HLS/MP4 stream
    // "iframe" means it's an embed
    const isNativeStream = bestSource.type === "player" || !streamUrl.includes("embed");

    return {
      type: isNativeStream ? (streamUrl.includes(".m3u8") ? "hls" : "mp4") : "embed",
      url: streamUrl,
      embedOrigin: "https://allmanga.to",
      headers: {
        "Referer": "https://allmanga.to/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    };
  }
};
