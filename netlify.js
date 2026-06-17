const axios = require('axios');
const crypto = require('crypto');

// Deploy HTML to Netlify using File Digest API (synchronous, reliable)
async function deployProposal(htmlContent, clientName) {
  const token = process.env.NETLIFY_TOKEN;

  // Clean site name — ASCII only
  const slug = (clientName || 'lead')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 15) || 'lead';
  const siteName = `sapir-${slug}-${Date.now()}`;

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Step 1: Create site
  console.log(`[Netlify] Creating site: ${siteName}`);
  const siteRes = await axios.post(
    'https://api.netlify.com/api/v1/sites',
    { name: siteName },
    { headers }
  );
  const siteId = siteRes.data.id;

  // Step 2: Compute SHA1 of HTML content
  const htmlBuffer = Buffer.from(htmlContent, 'utf8');
  const sha1 = crypto.createHash('sha1').update(htmlBuffer).digest('hex');

  // Step 3: Create deploy with file digest
  console.log(`[Netlify] Creating deploy for site: ${siteId}`);
  const deployRes = await axios.post(
    `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
    { files: { '/index.html': sha1 } },
    { headers }
  );
  const deployId = deployRes.data.id;

  // Step 4: Upload the file
  console.log(`[Netlify] Uploading index.html to deploy: ${deployId}`);
  await axios.put(
    `https://api.netlify.com/api/v1/deploys/${deployId}/files/index.html`,
    htmlBuffer,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream'
      },
      maxBodyLength: Infinity
    }
  );

  const url = `https://${siteName}.netlify.app`;
  console.log(`[Netlify] Deployed: ${url}`);
  return url;
}

module.exports = { deployProposal };
