const scraper = require('./zoro_hdhub4u_extension.js');

async function test() {
  const anime = {
    id: '243206',
    title: 'Pritam and Pedro',
    titleEnglish: 'Pritam and Pedro',
    format: 'TV',
    seasonYear: 2026
  };
  
  console.log("Getting stream for Pritam and Pedro Ep 2...");
  try {
    const stream = await scraper.getStream(anime, "null:1:2");
    console.log("Stream count:", stream.servers.length);
    console.log("Qualities:", stream.servers.map(s => s.quality + " " + s.size));
  } catch(e) {
    console.log("Error:", e);
  }
}
test();
