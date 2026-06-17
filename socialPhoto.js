const axios = require('axios');

// Extract profile photo URL from social media page
// Works best when called from a browser context (needs cookies)
// For server-side: works with LinkedIn, sometimes Instagram via CDN
async function fetchSocialPhoto(url) {
  if (!url || !url.startsWith('http')) return null;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8',
  };

  try {
    const res = await axios.get(url, { timeout: 10000, headers });
    const html = res.data;

    // Try og:image
    const og = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
             || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    if (og && og[1] && !og[1].includes('instagram.com/static')) return og[1];

    // Twitter image
    const tw = html.match(/<meta[^>]+name="twitter:image(?::src)?"[^>]+content="([^"]+)"/i);
    if (tw && tw[1]) return tw[1];

    return null;
  } catch (err) {
    console.error('[SocialPhoto] Error:', url, err.message);
    return null;
  }
}

// Parse Instagram username from URL
function parseInstagramUsername(url) {
  const match = url.match(/instagram\.com\/([^/?#]+)/i);
  return match ? match[1].replace(/\/$/, '') : null;
}

module.exports = { fetchSocialPhoto, parseInstagramUsername };
