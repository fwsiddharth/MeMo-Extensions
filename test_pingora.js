async function test() {
    try {
        const res = await fetch("https://search.pingora.fyi/collections/post/documents/search?q=Moana&query_by=post_title,category&query_by_weights=4,2&sort_by=sort_by_date:desc&limit=15&highlight_fields=none&use_cache=true&page=1");
        const data = await res.json();
        console.log(JSON.stringify(data.hits.map(h => h.document.post_title), null, 2));
    } catch(e) {
        console.error(e);
    }
}
test();
