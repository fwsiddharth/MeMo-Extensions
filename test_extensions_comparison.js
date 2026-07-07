const hdhub = require('./hdhub.js');
const hdhub4u = require('./zoro_hdhub4u_extension.js');

async function test() {
  console.log("=== Testing hdhub.js (Vidlink) ===");
  // Pritam and Pedro isn't on TMDB easily? Let's use a known TMDB ID.
  // Deadpool & Wolverine TMDB ID: 533535 (Movie)
  const dpAnime = {
    id: "533535",
    format: "MOVIE",
    title: "Deadpool & Wolverine"
  };
  try {
    const stream1 = await hdhub.getStream(dpAnime, "533535");
    console.log("hdhub.js Deadpool Streams:", JSON.stringify(stream1, null, 2));
  } catch(e) { console.error(e); }

  console.log("\n=== Testing zoro_hdhub4u_extension.js ===");
  try {
    // We need to use HDHub4u's search or just browse to get an ID.
    const res = await hdhub4u.search("Deadpool");
    if (res && res.length > 0) {
      const dpId = res[0].id;
      console.log("Found HDHub4u ID:", dpId);
      const eps = await hdhub4u.getEpisodes(res[0]);
      if (eps && eps.episodes && eps.episodes.length > 0) {
        const stream2 = await hdhub4u.getStream(res[0], eps.episodes[0].id);
        console.log("hdhub4u.js Deadpool Streams:");
        stream2.forEach(s => console.log(`- ${s.name} | ${s.quality} | ${s.language} | ${s.size} | ${s.url}`));
      } else {
        console.log("No episodes found on HDHub4u");
      }
    } else {
      console.log("Not found on HDHub4u");
    }
  } catch(e) { console.error(e); }
}

test();
