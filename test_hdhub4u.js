const scraper = require('./zoro_hdhub4u_extension.js');

async function test() {
  const query = "pritam";
  console.log("Searching for:", query);
  const results = await scraper.search(query);
  console.log("Search Results:", results);

  // Then try to getStream
}
test();
