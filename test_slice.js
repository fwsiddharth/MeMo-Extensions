const fs = require('fs');
const html = fs.readFileSync('pritam.html', 'utf8');
const idx = html.indexOf('EPiSODE 2');
console.log(html.substring(Math.max(0, idx - 100), idx + 500));
