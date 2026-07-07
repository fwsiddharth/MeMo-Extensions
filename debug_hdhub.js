const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
};

async function search(query) {
    const url = `https://search.pingora.fyi/collections/post/documents/search?q=${encodeURIComponent(query)}&query_by=post_title,category&query_by_weights=4,2&sort_by=sort_by_date:desc&limit=15&highlight_fields=none&use_cache=true&page=1&analytics_tag=foo`;
    const res = await fetch(url, { headers: HEADERS });
    try {
        const text = await res.text();
        console.log("Raw response length:", text.length);
        if (text.includes("Cloudflare")) { console.log("Cloudflare blocked"); return; }
        const data = JSON.parse(text);
        console.log(data.hits.map(h => h.document.post_title));
    } catch(e) { console.log(e); }
}

search("pritam and pedro");
