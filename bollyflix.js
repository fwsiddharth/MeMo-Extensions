module.exports = {
  name: "Bollyflix",
  shortName: "bollyflix",
  description: "Hindi Movies & Series (Custom Scraper)",
  isMovieProvider: true,
  baseUrl: "https://bollyflix.ind.in",

  async getDiscover() {
    return []; // Bollyflix doesn't have a clean discover API without heavy scraping
  },

  async search(query) {
    try {
      const url = `${this.baseUrl}/search/${encodeURIComponent(query)}`;
      console.log(`[Bollyflix] Fetching: ${url}`);
      
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36'
        }
      });
      
      if (!res.ok) {
        if (res.status === 403) throw new Error("Cloudflare blocked the request.");
        throw new Error(`HTTP Error: ${res.status}`);
      }

      const html = await res.text();
      const results = [];
      
      // Simple regex to extract basic post data (Title and Link)
      // Usually Bollyflix wraps posts in <a href="url"> or <h2 class="title">
      const regex = /<a href="(https:\/\/bollyflix\.ind\.in\/[^"]+)"[^>]*title="([^"]+)"/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        const link = match[1];
        const title = match[2];
        
        // Filter out junk
        if (!title.toLowerCase().includes(query.toLowerCase())) continue;

        results.push({
          id: link,
          title: title,
          image: "https://via.placeholder.com/150?text=Bollyflix", // Placeholder since extracting images via regex is flaky
          type: "MOVIE"
        });
      }

      // De-duplicate results
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
  },

  async getEpisodes(anime, options = {}) {
    // Return a single episode representing the full movie link
    return {
      episodes: [
        {
          id: anime.id, // The post URL
          number: 1,
          title: "Full Movie (Bollyflix)"
        }
      ]
    };
  },

  async getStream(episodeId) {
    // Here we would need to fetch the episodeId (which is the post URL)
    // and parse out the GDrive/HubCloud links inside it.
    // However, since those links are hidden behind multiple layers of obfuscation,
    // a pure regex scraper will likely fail. 
    
    // Instead of throwing an error, we can attempt to fetch the page and extract
    // the first obvious link we find, or we can just redirect the user to the web browser.
    
    try {
      console.log(`[Bollyflix] Extracting streams from: ${episodeId}`);
      const res = await fetch(episodeId, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
        }
      });
      
      if (!res.ok) throw new Error("Cloudflare block on post page.");
      const html = await res.text();
      
      // Attempt to find any HubCloud or PixelDrain link in the raw HTML
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
  }
};
