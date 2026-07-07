const searchUrl = `https://search.pingora.fyi/collections/post/documents/search?q=pritam`;
fetch(searchUrl).then(r => r.text()).then(console.log);
