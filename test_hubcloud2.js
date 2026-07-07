const fs = require('fs');
async function check() {
    const urls = [
        "https://hubcloud.cx/drive/osvd0veokxsdyas",
        "https://hubcloud.cx/drive/1obbegzyzeobddo"
    ];
    for (const url of urls) {
        const r = await fetch(url);
        const html = await r.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].toLowerCase() : '';
        let qStr = "1080p";
        if (title.match(/4k|2160p/)) qStr = "4K";
        else if (title.match(/1080p/)) qStr = "1080p";
        else if (title.match(/720p/)) qStr = "720p";
        
        console.log(title, "->", qStr);
    }
}
check();
