const hdhub = require('./hdhub.js');
const hdhub4u = require('./zoro_hdhub4u_extension.js');

async function testItem(name) {
  console.log(`\n=========================================`);
  console.log(`Testing: ${name}`);
  console.log(`=========================================`);
  
  let tmdbAnime = null;
  let hdhub4uAnime = null;

  // Search TMDB (Vidlink)
  try {
    const res = await hdhub.search(name);
    if (res && res.length > 0) {
      tmdbAnime = res[0];
      console.log(`[Vidlink] Found Match: ${tmdbAnime.title} (${tmdbAnime.format}) - ID: ${tmdbAnime.id}`);
      
      const eps = await hdhub.getEpisodes(tmdbAnime);
      if (eps.episodes && eps.episodes.length > 0) {
        console.log(`[Vidlink] Fetched Episodes. Testing Stream for: ${eps.episodes[0].title}`);
        const streamData = await hdhub.getStream(tmdbAnime, eps.episodes[0].id);
        console.log(`[Vidlink] Stream Results:`);
        if (streamData) {
            (streamData.servers || streamData).forEach(s => console.log(`- ${s.name} | ${s.quality} | ${s.language} | ${s.size} | ${s.url}`));
        } else {
            console.log("No streams returned from Vidlink.");
        }
      } else if (eps.seasons && eps.seasons.length > 0) {
        const firstEp = eps.seasons[0].episodes[0];
        console.log(`[Vidlink] Fetched Seasons. Testing Stream for: S${eps.seasons[0].season} E${firstEp.number}`);
        const streamData = await hdhub.getStream(tmdbAnime, firstEp.id);
        console.log(`[Vidlink] Stream Results:`);
        if (streamData) {
            (streamData.servers || streamData).forEach(s => console.log(`- ${s.name} | ${s.quality} | ${s.language} | ${s.size} | ${s.url}`));
        } else {
            console.log("No streams returned from Vidlink.");
        }
      }
    } else {
      console.log(`[Vidlink] No Match found for ${name}`);
    }
  } catch(e) { console.error("[Vidlink] Error:", e.message); }

  console.log(`\n-----------------------------------------`);

  // Search HDHub4u
  try {
    const res = await hdhub4u.search(name);
    if (res && res.length > 0) {
      hdhub4uAnime = res[0];
      console.log(`[HDHub4u] Found Match: ${hdhub4uAnime.title} - URL: ${hdhub4uAnime.id}`);
      
      const eps = await hdhub4u.getEpisodes(hdhub4uAnime);
      if (eps.episodes && eps.episodes.length > 0) {
        console.log(`[HDHub4u] Fetched Episodes. Testing Stream for EP 1...`);
        const streamData = await hdhub4u.getStream(hdhub4uAnime, eps.episodes[0].id);
        console.log(`[HDHub4u] Stream Results:`);
        if (streamData) {
            (streamData.servers || streamData).forEach(s => console.log(`- ${s.name} | ${s.quality} | ${s.language} | ${s.size} | ${s.url}`));
        } else {
            console.log("No streams returned from HDHub4u.");
        }
      } else if (eps.seasons && eps.seasons.length > 0) {
        const firstEp = eps.seasons[0].episodes[0];
        console.log(`[HDHub4u] Fetched Seasons. Testing Stream for S1 E1...`);
        const streamData = await hdhub4u.getStream(hdhub4uAnime, firstEp.id);
        console.log(`[HDHub4u] Stream Results:`);
        if (streamData) {
            (streamData.servers || streamData).forEach(s => console.log(`- ${s.name} | ${s.quality} | ${s.language} | ${s.size} | ${s.url}`));
        } else {
            console.log("No streams returned from HDHub4u.");
        }
      } else {
        console.log("[HDHub4u] No episodes returned.");
      }
    } else {
      console.log(`[HDHub4u] No Match found for ${name}`);
    }
  } catch(e) { console.error("[HDHub4u] Error:", e.message); }
}

async function run() {
  await testItem("Alpha 2026");
  await testItem("Teach you a lesson");
}

run();
