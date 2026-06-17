const axios = require('axios');
const archiver = require('archiver');
const { PassThrough } = require('stream');

const NETLIFY_API = 'https://api.netlify.com/api/v1';

// Create a ZIP buffer from HTML string
function createZipBuffer(htmlContent) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const passthrough = new PassThrough();
    passthrough.on('data', chunk => chunks.push(chunk));
    passthrough.on('end', () => resolve(Buffer.concat(chunks)));
    passthrough.on('error', reject);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', reject);
    archive.pipe(passthrough);
    archive.append(htmlContent, { name: 'index.html' });
    archive.finalize();
  });
}

// Deploy HTML to Netlify and return the public URL
async function deployProposal(htmlContent, clientName) {
  const token = process.env.NETLIFY_TOKEN;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Step 1: Create new site with a unique name
  // Only ASCII chars allowed in Netlify subdomain
  const slug = (clientName || 'lead')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 15) || 'lead';
  const siteName = `sapir-${slug}-${Date.now()}`;

  console.log(`[Netlify] Creating site: ${siteName}`);
  const siteRes = await axios.post(
    `${NETLIFY_API}/sites`,
    { name: siteName },
    { headers }
  );

  const siteId = siteRes.data.id;

  // Step 2: Build ZIP
  const zipBuffer = await createZipBuffer(htmlContent);

  // Step 3: Deploy ZIP
  console.log(`[Netlify] Deploying to site: ${siteId}`);
  await axios.post(
    `${NETLIFY_API}/sites/${siteId}/deploys`,
    zipBuffer,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/zip'
      },
      maxBodyLength: Infinity
    }
  );

  // Return URL (Netlify subdomain is the site name)
  const url = `https://${siteName}.netlify.app`;
  console.log(`[Netlify] Deployed successfully: ${url}`);
  return url;
}

module.exports = { deployProposal };
