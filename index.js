require('dotenv').config();
const express = require('express');
const { handleIncomingMessage } = require('./messageHandler');
const { startFollowupScheduler } = require('./followup');

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok', service: 'Sapir Zisman Bot' }));

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === process.env.WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.status(403).send('Forbidden');
  }
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const messages = req.body?.entry?.[0]?.changes?.[0]?.value?.messages;
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
