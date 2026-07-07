const fs = require('fs');
const html = fs.readFileSync('pritam.html', 'utf8');

const eNum = 2;
const epRegex = new RegExp(`(?:>|\\s)(?:Episode|Ep|E)[\\s\\-]*0?${eNum}(?!\\d)`, 'i');
const nextEpRegex = new RegExp(`(?:>|\\s)(?:Episode|Ep|E)[\\s\\-]*0?${eNum + 1}(?!\\d)`, 'i');

let startIdx = html.search(epRegex);
let targetHtml = html;
if (startIdx !== -1) {
    let tagIdx = html.lastIndexOf('<', startIdx);
    if (tagIdx !== -1) startIdx = tagIdx;
    
    let remainder = html.substring(startIdx + 5);
    let endIdx = remainder.search(nextEpRegex);
    
    if (endIdx !== -1) {
        targetHtml = html.substring(startIdx, startIdx + 5 + endIdx);
    } else {
        targetHtml = html.substring(startIdx);
    }
}

const aTags = targetHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi) || [];
for (let aTag of aTags) {
    const hrefMatch = aTag.match(/href=["']([^"']+)["']/i);
    if (hrefMatch) {
        const href = hrefMatch[1];
        if (href.includes('techyboy4u') || href.includes('gadgetsweb') || 
            href.includes('hblinks') || href.includes('hubcloud') || 
            href.includes('hubdrive') || href.includes('hubcdn') || href.includes('pixeldrain') ||
            href.includes('linksbnao') || href.includes('linksfire')) { // adding more if any
            console.log("Found:", href);
        } else {
            console.log("Other link:", href);
        }
    }
}
