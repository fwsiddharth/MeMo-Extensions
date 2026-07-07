async function check() {
    const r = await fetch("https://hubcloud.cx/drive/osvd0veokxsdyas", {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36" }
    });
    const text = await r.text();
    const aMatches = text.match(/<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*btn[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi) || [];
    console.log(aMatches);
}
check();
