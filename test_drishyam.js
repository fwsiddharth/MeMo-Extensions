const fetch = require("node:fetch");

async function run() {
    const res = await fetch("https://search.pingora.fyi/collections/post/documents/search?q=Drishyam&query_by=post_title,category&query_by_weights=4,2&sort_by=sort_by_date:desc&limit=3&use_cache=true&page=1");
    const data = await res.json();
    console.log("Pingora Hits:", data.hits.map(h => h.document.post_title));
}
run();
