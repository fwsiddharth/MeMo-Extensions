const BASE_URL = "https://animetsu.net";
const API_BASE = `${BASE_URL}/v2/api/anime`;
const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);
const EXTRA_VARIANT_TERMS = [
  "movie", "special", "final season", "the final chapters", "part 2", "part 3",
  "season 2", "season 3", "picture drama", "ova", "oad", "chronicle", "lost girls",
  "junior high", "no regrets", "compilation", "recap", "side story", "reawakening",
];

function buildHeaders(referer = BASE_URL) {
  return {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Referer: referer,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 OPR/128.0.0.0",
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getAnimeNames(anime) {
  return uniqueStrings([
    anime?.titleEnglish, anime?.titleRomaji, anime?.titleNative, anime?.title,
    ...(Array.isArray(anime?.synonyms) ? anime.synonyms : []),
  ]);
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).map((v) => String(v || "").trim()).filter(Boolean)));
}

function scoreNameMatch(candidate, target) {
  if (!candidate || !target) return 0;
  if (candidate === target) return 100;
  if (candidate.startsWith(target) || target.startsWith(candidate)) return 85;
  if (candidate.includes(target) || target.includes(candidate)) return 70;
  return 0;
}

function hasExtraVariantTerm(show, anime) {
  const sourceText = normalizeText(
    [show?.title?.english, show?.title?.romaji, show?.title?.native].filter(Boolean).join(" "),
  );
  const animeText = normalizeText(getAnimeNames(anime).join(" "));
  return EXTRA_VARIANT_TERMS.some((term) => {
    const normalized = normalizeText(term);
    return sourceText.includes(normalized) && !animeText.includes(normalized);
  });
}

function scoreShowMatch(show, anime) {
  const showNames = uniqueStrings([show?.title?.english, show?.title?.romaji, show?.title?.native]).map(normalizeText);
  const animeNames = getAnimeNames(anime).map(normalizeText);
  let best = 0;
  for (const showName of showNames) {
    for (const animeName of animeNames) {
      best = Math.max(best, scoreNameMatch(showName, animeName));
    }
  }
  const animeYear = Number(anime?.seasonYear || anime?.year);
  const showYear = Number(show?.year);
  if (Number.isFinite(animeYear) && Number.isFinite(showYear) && animeYear === showYear) best += 6;
  const animeEpisodes = Number(anime?.episodes);
  const showEpisodes = Number(show?.total_eps);
  if (Number.isFinite(animeEpisodes) && Number.isFinite(showEpisodes)) {
    if (animeEpisodes === showEpisodes) best += 4;
    else if (Math.abs(animeEpisodes - showEpisodes) <= 2) best += 2;
  }
  const animeFormat = String(anime?.format || "").toUpperCase().trim();
  const showFormat = String(show?.format || "").toUpperCase().trim();
  if (animeFormat && showFormat && animeFormat === showFormat) best += 3;
  if (hasExtraVariantTerm(show, anime)) best -= 18;
  return best;
}

async function gojoRequestJson(url, { referer, timeoutMs = 10000, retries = 2 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { headers: buildHeaders(referer), signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        if (RETRYABLE_STATUSES.has(response.status) && attempt < retries) {
          await sleep(300 * (attempt + 1));
          continue;
        }
        throw new Error(`GojoWtf HTTP ${response.status}`);
      }
      const text = await response.text();
      return JSON.parse(text);
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt < retries) { await sleep(300 * (attempt + 1)); continue; }
    }
  }
  throw lastError || new Error("GojoWtf request failed.");
}

function normalizeSearchQuery(query) {
  const extras = ["EXTRA PART","OVA","SPECIAL","RECAP","FINAL SEASON","BONUS","SIDE STORY","PART\\s*\\d+","EPISODE\\s*\\d+"];
  const pattern = new RegExp(`\\b(${extras.join("|")})\\b`, "gi");
  const normalized = String(query || "")
    .replace(/\b(\d+)(st|nd|rd|th)\b/gi, "$1")
    .replace(/(\d+)\s*Season/gi, "$1")
    .replace(/Season\s*(\d+)/gi, "$1")
    .replace(pattern, "")
    .replace(/-.*?-/g, "")
    .replace(/\bThe(?=\s+Movie\b)/gi, "")
    .replace(/~/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const specialChar = normalized.match(/[^a-zA-Z0-9 ]/);
  if (!specialChar) return normalized;
  return normalized.slice(0, specialChar.index).trim();
}

function buildQueryVariants(...values) {
  const variants = [];
  for (const value of values) {
    const raw = String(value || "").trim();
    if (!raw) continue;
    variants.push(raw);
    const normalized = normalizeSearchQuery(raw);
    if (normalized && normalized !== raw) variants.push(normalized);
    const seasonless = raw
      .replace(/\b(\d+)(st|nd|rd|th)\s+season\b/gi, "")
      .replace(/\bseason\s*(\d+)\b/gi, "")
      .replace(/\bpart\s*\d+\b/gi, "")
      .replace(/\b(final season|the final chapters)\b/gi, "")
      .replace(/\s+/g, " ").trim();
    if (seasonless && seasonless !== raw && seasonless !== normalized) {
      variants.push(seasonless);
      const normalizedSeasonless = normalizeSearchQuery(seasonless);
      if (normalizedSeasonless && normalizedSeasonless !== seasonless) variants.push(normalizedSeasonless);
    }
  }
  return uniqueStrings(variants);
}

async function searchGojo(query, year = "any") {
  const url = `${API_BASE}/search?query=${encodeURIComponent(query)}&page=1&year=${encodeURIComponent(year)}`;
  const data = await gojoRequestJson(url);
  return Array.isArray(data?.results) ? data.results : [];
}

function mapSearchResult(show) {
  return {
    id: String(show?.id || ""),
    title: show?.title?.english || show?.title?.romaji || show?.title?.native || "Untitled",
    titleEnglish: show?.title?.english || show?.title?.romaji || null,
    titleRomaji: show?.title?.romaji || show?.title?.english || null,
    provider: "gojowtf",
    episodes: Number(show?.total_eps) || null,
    seasonYear: Number(show?.year) || null,
  };
}

async function resolveShow(anime) {
  const names = buildQueryVariants(...getAnimeNames(anime));
  const year = Number(anime?.seasonYear || anime?.year) || "any";
  const byId = new Map();
  const errors = [];
  for (const name of names) {
    if (name.length < 2) continue;
    try {
      const results = await searchGojo(name, year);
      for (const item of results) {
        if (!item?.id || byId.has(item.id)) continue;
        byId.set(item.id, item);
      }
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }
  const candidates = Array.from(byId.values());
  if (!candidates.length) throw new Error(errors[0] || "GojoWtf show not found for this anime.");
  let best = null;
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = scoreShowMatch(candidate, anime);
    if (score > bestScore) { best = candidate; bestScore = score; }
  }
  if (!best?.id) throw new Error("No suitable GojoWtf show match found.");
  return best;
}

function sortEpisodes(list) {
  return [...(list || [])].sort((left, right) => {
    const leftNumber = Number(left?.ep_num);
    const rightNumber = Number(right?.ep_num);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
    return String(left?.id || "").localeCompare(String(right?.id || ""), undefined, { numeric: true });
  });
}

function parseEpisodeId(episodeId) {
  const [prefix, animeId, remoteEpisodeId, language, episodeNumber] = String(episodeId || "").split("|");
  if (prefix !== "gojowtf" || !animeId || !remoteEpisodeId || !language || !episodeNumber) return null;
  const parsedNumber = Number(episodeNumber);
  if (!Number.isFinite(parsedNumber)) return null;
  return { animeId, remoteEpisodeId, language, episodeNumber: parsedNumber };
}

module.exports = {
  name: "gojowtf",

  async search(query) {
    const normalized = normalizeSearchQuery(query) || String(query || "").trim();
    const results = await searchGojo(normalized || query, "any");
    return results.map(mapSearchResult);
  },

  async getEpisodes(anime, options = {}) {
    const show = await resolveShow(anime);
    const episodes = await gojoRequestJson(`${API_BASE}/eps/${encodeURIComponent(show.id)}`);
    const requestedTranslation = String(options.translationType || "").trim().toLowerCase();
    const translationType = requestedTranslation === "dub" ? "dub" : "sub";

    return {
      translationOptions: ["sub", "dub"],
      activeTranslation: translationType,
      episodes: sortEpisodes(episodes).map((episode, index) => {
        const episodeNumber = Number(episode?.ep_num) || index + 1;
        return {
          id: `gojowtf|${show.id}|${episode.id}|${translationType}|${episodeNumber}`,
          number: episodeNumber,
          title: translationType === "sub"
            ? episode?.name || `Episode ${episodeNumber}`
            : `${episode?.name || `Episode ${episodeNumber}`} (DUB)`,
        };
      }),
    };
  },

  async getStream(_anime, episodeId) {
    const parsed = parseEpisodeId(episodeId);
    if (!parsed) throw new Error("Invalid GojoWtf episode id.");

    const { animeId, episodeNumber, language } = parsed;
    const watchUrl = `${BASE_URL}/watch/${animeId}?ep=${episodeNumber}&lang=${language === "dub" ? "en" : "ja"}`;

    // Aggressive cleanup script that wipes the site and replaces it with our player
    const AGGRESSIVE_PLAYER_JS = `
(function() {
    // 1. Block ads and popups immediately
    window.open = function() { return null; };
    window.alert = function() {};
    
    // 2. Hide everything until we are ready
    const style = document.createElement('style');
    style.innerHTML = 'html, body { background: #000 !important; overflow: hidden !important; } #root, .navbar, footer, aside, .ad-container { display: none !important; opacity: 0 !important; pointer-events: none !important; }';
    document.head.appendChild(style);

    function post(type, data) {
        if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, data || {})));
        }
    }

    // 3. Wait for the player element to appear, then isolate it
    let attempts = 0;
    const interval = setInterval(function() {
        const video = document.querySelector('video');
        const playerContainer = document.querySelector('[class*="player"], [id*="player"]');
        
        if (video && playerContainer) {
            clearInterval(interval);
            
            // WIPE the entire body and move the player into a clean container
            const videoClone = video.cloneNode(true);
            videoClone.style.cssText = 'width: 100vw; height: 100vh; position: fixed; top: 0; left: 0; background: #000; z-index: 99999;';
            videoClone.controls = true;
            
            document.body.innerHTML = '';
            document.body.appendChild(videoClone);
            
            post('LOG', { message: 'Player isolated successfully' });
            videoClone.play().catch(function(e) { post('LOG', { message: 'Autoplay prevented' }); });
        }
        
        if (++attempts > 50) {
            clearInterval(interval);
            post('LOG', { message: 'Failed to isolate player after 50 attempts' });
        }
    }, 200);
})();
`;

    return {
      type: "embed",
      url: watchUrl,
      embedOrigin: BASE_URL,
      injectedJavaScript: AGGRESSIVE_PLAYER_JS,
      subtitles: [],
      headers: {
        Referer: BASE_URL,
        Origin: BASE_URL,
      },
    };
  },
};
