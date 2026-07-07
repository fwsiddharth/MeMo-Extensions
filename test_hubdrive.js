async function check() {
    const r = await fetch("https://hubdrive.tips/file/1804604559", {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36" }
    });
    console.log("Status:", r.status);
    console.log("Redirected URL:", r.url);
    const text = await r.text();
    console.log("Contains hubcloud links:", text.includes("hubcloud"));
}
check();
