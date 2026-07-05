module.exports.name = "Bollyflix";
module.exports.shortName = "bollyflix";
module.exports.description = "Hindi Movies & Series (Custom Scraper)";
module.exports.isMovieProvider = true;
module.exports.baseUrl = "https://bollyflix.ind.in";

module.exports.getDiscover = async function() {
  return []; // Bollyflix doesn't have a clean discover API without heavy scraping
};

module.exports.search = async function(query) {
  try {
    const url = module.exports.baseUrl + "/search/" + encodeURIComponent(query);
    console.log("[Bollyflix] Fetching: " + url);
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36'
      }
    });
    
    if (!res.ok) {
      if (res.status === 403) throw new Error("Cloudflare blocked the request.");
      throw new Error("HTTP Error: " + res.status);
    }

    const html = await res.text();
    const results = [];
    
    // Simple regex to extract basic post data (Title and Link)
    const regex = /<a href="(https:\/\/bollyflix\.ind\.in\/[^"]+)"[^>]*title="([^"]+)"/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const link = match[1];
      const title = match[2];
      
      if (!title.toLowerCase().includes(query.toLowerCase())) continue;

      results.push({
        id: link,
        title: title,
        image: "https://via.placeholder.com/150?text=Bollyflix",
        type: "MOVIE"
      });
    }

    const uniqueResults = [];
    const seen = new Set();
    for (const r of results) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        uniqueResults.push(r);
      }
    }

    return uniqueResults;
  } catch (e) {
    console.error("[Bollyflix Search Error]", e.message);
    return [];
  }
};

module.exports.getEpisodes = async function(anime, options = {}) {
  return {
    episodes: [
      {
        id: anime.id,
        number: 1,
        title: "Full Movie (Bollyflix)"
      }
    ]
  };
};

module.exports.getStream = async function(episodeId) {
  try {
    console.log("[Bollyflix] Extracting streams from: " + episodeId);
    const res = await fetch(episodeId, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
      }
    });
    
    if (!res.ok) throw new Error("Cloudflare block on post page.");
    const html = await res.text();
    
    const streamRegex = /(https:\/\/(hubcloud\.cx|hdstream4u\.com|morencius\.com|pixeldrain\.com)\/[^"'\s<]+)/gi;
    const streams = [];
    let match;
    while ((match = streamRegex.exec(html)) !== null) {
      streams.push({
        name: "Bollyflix Server",
        url: match[1],
        quality: "Auto"
      });
    }

    if (streams.length === 0) {
      throw new Error("No direct stream links found in HTML.");
    }

    return streams;
  } catch (e) {
    console.error("[Bollyflix Stream Error]", e);
    throw new Error("Failed to extract streams: " + e.message);
  }
};
