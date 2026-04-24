const fs = require('fs');
const path = require('path');

// 1. Choose which extension to test
const EXTENSION_NAME = 'kickass.js'; // Change this to 'gojowtf.js' or 'animesalt.js'

console.log(`\n======================================`);
console.log(`🚀 Loading Extension: ${EXTENSION_NAME}`);
console.log(`======================================\n`);

// 2. Load the standalone extension
const extensionPath = path.join(__dirname, EXTENSION_NAME);
const extension = require(extensionPath);

// 3. Define a mock anime to test with
const testAnime = {
  title: 'One Piece',
  titleEnglish: 'One Piece',
  titleRomaji: 'One Piece',
  episodes: 1100, // Roughly
  seasonYear: 1999
};

// 4. Test Runner
async function runTest() {
  try {
    // --- TEST 1: SEARCH ---
    console.log(`[1] Testing search() for "${testAnime.title}"...`);
    const searchResults = await extension.search(testAnime.title);
    
    if (!searchResults || searchResults.length === 0) {
      console.log('❌ No search results found!');
      return;
    }
    
    console.log(`✅ Search Success! Found ${searchResults.length} results.`);
    console.log(`First result:`, searchResults[0]);
    console.log('\n--------------------------------------\n');


    // --- TEST 2: GET EPISODES ---
    console.log(`[2] Testing getEpisodes() for "${testAnime.title}"...`);
    // Pass the best match or the mock anime depending on how the extension is built
    // Usually, the extension resolves the show internally using the anime names/year.
    const episodesData = await extension.getEpisodes(testAnime);
    
    if (!episodesData || !episodesData.episodes || episodesData.episodes.length === 0) {
      console.log('❌ No episodes found!');
      return;
    }
    
    const episodes = episodesData.episodes;
    console.log(`✅ Episodes Success! Found ${episodes.length} episodes.`);
    console.log(`First Episode:`, episodes[0]);
    console.log('\n--------------------------------------\n');


    // --- TEST 3: GET STREAM ---
    const testEpisode = episodes[0];
    console.log(`[3] Testing getStream() for Episode 1 (ID: ${testEpisode.id})...`);
    
    const streamData = await extension.getStream(testAnime, testEpisode.id);
    
    if (!streamData || !streamData.url) {
      console.log('❌ Failed to extract stream URL!');
      return;
    }

    console.log(`✅ Stream Success! Video extracted:`);
    console.log(`Type: ${streamData.type}`);
    console.log(`URL: ${streamData.url}`);
    if (streamData.subtitles && streamData.subtitles.length > 0) {
      console.log(`Subtitles found: ${streamData.subtitles.length}`);
    }
    console.log(`Headers required for playback:`, streamData.headers);
    console.log('\n======================================');
    console.log(`🎉 EXTENSION IS WORKING PERFECTLY!`);
    console.log(`======================================\n`);

  } catch (error) {
    console.error(`\n❌ ERROR DURING TEST:`);
    console.error(error.message);
    if (error.stack) console.error(error.stack);
  }
}

// Run the engine
runTest();
