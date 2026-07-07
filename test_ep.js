const html = `
    <h1>House of the Dragon</h1>
    <h3>1080p Links</h3>
    <p>Episode 1 <a href="https://hubcloud.cx/1">1080p E1</a></p>
    <p>Episode 2 <a href="https://hubcloud.cx/2">1080p E2</a></p>
    <h3>4K Links</h3>
    <p>Episode 1 <a href="https://hubcloud.cx/3">4K E1</a></p>
    <p>Episode 2 <a href="https://hubcloud.cx/4">4K E2</a></p>
`;

const mediaType = "tv";
const eNum = 1;
const initialLinks = [];

let currentQuality = "1080p";
let currentEpisode = null;

const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
let lastIndex = 0;
let match;

while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const innerText = match[2];
    const textBeforeLink = html.substring(lastIndex, match.index);
    lastIndex = linkRegex.lastIndex;
    
    const qMatch = textBeforeLink.match(/(480p|720p|1080p|2160p|4K)/gi);
    if (qMatch) {
        const lastQ = qMatch[qMatch.length - 1].toLowerCase();
        if (lastQ === '2160p' || lastQ === '4k') currentQuality = '4K';
        else if (lastQ === '1080p') currentQuality = '1080p';
        else if (lastQ === '720p') currentQuality = '720p';
        else if (lastQ === '480p') currentQuality = '480p';
    }
    
    if (mediaType === "tv") {
        const epRegexStr = /(?:Episode|Ep|E)[\s\-]*0?(\d+)(?!\d)/gi;
        let epMatch;
        while ((epMatch = epRegexStr.exec(textBeforeLink)) !== null) {
            currentEpisode = parseInt(epMatch[1]);
        }
        
        const innerEpMatch = innerText.match(/(?:Episode|Ep|E)[\s\-]*0?(\d+)(?!\d)/i);
        if (innerEpMatch) currentEpisode = parseInt(innerEpMatch[1]);
        
        if (currentEpisode !== eNum) continue;
    }
    
    let linkQuality = currentQuality;
    const innerTextLower = innerText.toLowerCase();
    if (innerTextLower.match(/4k|2160p/)) linkQuality = '4K';
    else if (innerTextLower.includes('1080p')) linkQuality = '1080p';
    else if (innerTextLower.includes('720p')) linkQuality = '720p';
    else if (innerTextLower.includes('480p')) linkQuality = '480p';
    
    initialLinks.push({ url: href, quality: linkQuality });
}
console.log(initialLinks);
