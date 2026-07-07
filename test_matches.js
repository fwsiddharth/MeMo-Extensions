const fs = require('fs');
const html = fs.readFileSync('pritam.html', 'utf8');
const epRegex = new RegExp(`(?:>|\\s)(?:Episode|Ep|E)[\\s\\-]*0?2(?!\\d)`, 'gi');
let match;
while ((match = epRegex.exec(html)) !== null) {
    console.log(`Match at ${match.index}: ${match[0]}`);
    console.log("Context:", html.substring(match.index - 30, match.index + 30));
}
