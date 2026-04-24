# MeMo Extensions

This repository contains official streaming extensions for the MeMo V2 application. 

MeMo Extensions are JavaScript scrapers that run entirely locally on the user's device. They fetch metadata, search for anime, and extract raw video streaming links without the need for a centralized backend server.

## Available Extensions

- **KickAss (`kaa-manifest`)**: High-quality streams and multi-language subtitles from KickAss.
- **Gojo (`gojowtf`)**: Fast streams from the Kaido/Gojo network.
- **AnimeSalt (`animesalt`)**: Reliable alternative streams from AnimeSalt.

## How to Install in MeMo

1. Open your MeMo App.
2. Navigate to **Profile > Settings > Extensions**.
3. Click **+ Import**.
4. Paste the URL of the `.js` file from this repository (click the file, then click "Raw" to get the URL).
   - Example: `https://raw.githubusercontent.com/fwsiddharth/MeMo-Extensions/main/kickass.js`
5. The extension will automatically download and register itself in your local Sandbox Engine!

## Creating Your Own Extensions

All extensions must implement the standard MeMo Extension API.

```javascript
module.exports = {
  name: "your-source-id",
  
  async search(query) {
    // Return array of search results
  },
  
  async getEpisodes(anime) {
    // Return available episodes for an anime
  },
  
  async getStream(anime, episodeId) {
    // Extract and return raw HLS stream URL and subtitles
  }
}
```
