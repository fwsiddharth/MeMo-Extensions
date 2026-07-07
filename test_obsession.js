const scraper = require('./zoro_hdhub4u_extension.js');

async function test() {
  const anime = {
    id: '12345',
    title: 'Obsession',
    titleEnglish: 'Obsession',
    format: 'MOVIE',
    seasonYear: 2026
  };
  
  console.log("Getting stream for Obsession...");
  try {
    const stream = await scraper.getStream(anime, "12345");
    console.log("Stream count:", stream.servers.length);
    console.log("Qualities:", stream.servers.map(s => s.quality + " " + s.size));
  } catch(e) {
    console.log("Error:", e);
  }
}
test();
