async function check() {
    const r = await fetch("https://hubdrive.tips/file/1804604559", {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36" }
    });
    const text = await r.text();
    const links = text.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi);
    console.log(links);
}
check();
