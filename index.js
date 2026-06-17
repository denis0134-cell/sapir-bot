require('dotenv').config();
const express = require('express');
const { handleIncomingMessage } = require('./messageHandler');
const { startFollowupScheduler } = require('./followup');

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok', service: 'Sapir Zisman Bot' }));

// Photo capture page - receives photo via hash fragment from Instagram
app.get('/capture-photo', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Denis Photo Capture</title></head>
<body style="background:#000;color:#fff;font-family:sans-serif;text-align:center;padding:50px">
<h2 id="msg">⏳ שומר תמונה...</h2>
<script>
const hash = window.location.hash.substring(1);
if (!hash) { document.getElementById('msg').textContent = '❌ אין מידע'; }
else {
  const params = new URLSearchParams(hash);
  const photo = params.get('photo');
  const phone = params.get('phone') || '972509698121';
  if (!photo) { document.getElementById('msg').textContent = '❌ אין תמונה'; }
  else {
    fetch('/save-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, photoUrl: photo })
    }).then(r => r.json()).then(d => {
      document.getElementById('msg').innerHTML = '✅ תמונה נשמרה!<br><small style="color:#888">סגור את הדף וחזור לווצאפ</small>';
    }).catch(e => {
      document.getElementById('msg').textContent = '❌ שגיאה: ' + e.message;
    });
  }
}
</script>
</body></html>`);
});

// Save Denis photo permanently via Netlify hosting
app.post('/save-photo', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  const { phone, photoUrl } = req.body;
  if (!phone || !photoUrl) {
    return res.status(400).json({ error: 'missing phone or photoUrl' });
  }

  let finalUrl = photoUrl;

  // If base64 image — upload to Netlify for permanent URL
  if (photoUrl.startsWith('data:image')) {
    try {
      const axios = require('axios');
      const crypto = require('crypto');
      const netlifyToken = process.env.NETLIFY_TOKEN;

      if (netlifyToken) {
        // Convert base64 to buffer
        const base64Data = photoUrl.split(',')[1];
        const imgBuffer = Buffer.from(base64Data, 'base64');
        const sha1 = crypto.createHash('sha1').update(imgBuffer).digest('hex');

        // Create/get site
        const siteName = 'denis-pol-photo';
        let siteId;
        try {
          const listRes = await axios.get('https://api.netlify.com/api/v1/sites',
            { headers: { Authorization: 'Bearer ' + netlifyToken } });
          const existing = listRes.data.find(s => s.name === siteName);
          siteId = existing ? existing.id : null;
        } catch {}

        if (!siteId) {
          const newSite = await axios.post('https://api.netlify.com/api/v1/sites',
            { name: siteName },
            { headers: { Authorization: 'Bearer ' + netlifyToken, 'Content-Type': 'application/json' } });
          siteId = newSite.data.id;
        }

        // Deploy photo
        const deployRes = await axios.post(
          'https://api.netlify.com/api/v1/sites/' + siteId + '/deploys',
          { files: { '/denis-photo.jpg': sha1 } },
          { headers: { Authorization: 'Bearer ' + netlifyToken, 'Content-Type': 'application/json' } });

        await axios.put(
          'https://api.netlify.com/api/v1/deploys/' + deployRes.data.id + '/files/denis-photo.jpg',
          imgBuffer,
          { headers: { Authorization: 'Bearer ' + netlifyToken, 'Content-Type': 'application/octet-stream' }, maxBodyLength: Infinity });

        finalUrl = 'https://' + siteName + '.netlify.app/denis-photo.jpg';
        console.log('[SavePhoto] Uploaded to Netlify:', finalUrl);
      }
    } catch (netErr) {
      console.error('[SavePhoto] Netlify upload failed:', netErr.message);
      // Keep base64 as fallback
    }
  }

  // Save to runtime
  const { upsertLead } = require('./leads');
  upsertLead(phone, { myPhotoUrl: finalUrl });
  console.log('[SavePhoto] Saved for', phone, ':', finalUrl.substring(0, 60));
  res.json({ ok: true, photoUrl: finalUrl });
});

// Handle OPTIONS preflight
app.options('/save-photo', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

// Webhook verification (same for Meta + 360dialog)
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === process.env.WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.status(403).send('Forbidden');
  }
});

// Receive messages from Meta Cloud API
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages;

    if (messages?.length) {
      for (const msg of messages) {
        if (msg.type === 'text') {
          await handleIncomingMessage({
            from: msg.from,
            text: { body: msg.text.body }
          });
        }
      }
    }
  } catch (err) {
    console.error('[Server] Error:', err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Sapir Zisman Bot running on port ${PORT}`);
  startFollowupScheduler();
});
