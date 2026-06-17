require('dotenv').config();
const express = require('express');
const { handleIncomingMessage } = require('./messageHandler');
const { startFollowupScheduler } = require('./followup');

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok', service: 'Sapir Zisman Bot' }));

// Save Denis photo - called from browser setup page
app.post('/save-photo', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  const { phone, photoUrl } = req.body;
  if (!phone || !photoUrl || !photoUrl.startsWith('http')) {
    return res.status(400).json({ error: 'missing phone or photoUrl' });
  }
  const { upsertLead } = require('./leads');
  upsertLead(phone, { myPhotoUrl: photoUrl });
  console.log('[SavePhoto] Saved for', phone, ':', photoUrl.substring(0, 60));
  res.json({ ok: true, saved: photoUrl.substring(0, 80) });
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
