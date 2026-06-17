const axios = require('axios');

// Extract profile photo from social media URL via OpenGraph meta tags
async function fetchSocialPhoto(url) {
  if (!url || !url.startsWith('http')) return null;
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept': 'text/html'
      }
    });
    const html = res.data;
    
    // Try og:image first
    const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
                    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    if (ogMatch && ogMatch[1]) return ogMatch[1];
    
    // Try twitter:image
    const twMatch = html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i);
    if (twMatch && twMatch[1]) return twMatch[1];
    
    return null;
  } catch (err) {
    console.error('[SocialPhoto] Error fetching', url, err.message);
    return null;
  }
}

module.exports = { fetchSocialPhoto };
