require('dotenv').config();
const express = require('express');
const { handleIncomingMessage } = require('./messageHandler');
const { startFollowupScheduler } = require('./followup');
const { startProactiveScheduler } = require('./proactiveBot');
const { sendMessage } = require('./whatsapp');
const { getLeadsForFollowup } = require('./leads');

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok', service: 'Sapir Zisman Bot' }));

// Photo capture page
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

app.post('/save-photo', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  const { phone, photoUrl } = req.body;
  if (!phone || !photoUrl) return res.status(400).json({ error: 'missing phone or photoUrl' });
  let finalUrl = photoUrl;
  if (photoUrl.startsWith('data:image')) {
    try {
      const axios = require('axios');
      const crypto = require('crypto');
      const netlifyToken = process.env.NETLIFY_TOKEN;
      if (netlifyToken) {
        const base64Data = photoUrl.split(',')[1];
        const imgBuffer = Buffer.from(base64Data, 'base64');
        const sha1 = crypto.createHash('sha1').update(imgBuffer).digest('hex');
        const siteName = 'denis-pol-photo';
        let siteId;
        try {
          const listRes = await axios.get('https://api.netlify.com/api/v1/sites', { headers: { Authorization: 'Bearer ' + netlifyToken } });
          const existing = listRes.data.find(s => s.name === siteName);
          siteId = existing ? existing.id : null;
        } catch {}
        if (!siteId) {
          const newSite = await axios.post('https://api.netlify.com/api/v1/sites', { name: siteName }, { headers: { Authorization: 'Bearer ' + netlifyToken, 'Content-Type': 'application/json' } });
          siteId = newSite.data.id;
        }
        const deployRes = await axios.post('https://api.netlify.com/api/v1/sites/' + siteId + '/deploys', { files: { '/denis-photo.jpg': sha1 } }, { headers: { Authorization: 'Bearer ' + netlifyToken, 'Content-Type': 'application/json' } });
        await axios.put('https://api.netlify.com/api/v1/deploys/' + deployRes.data.id + '/files/denis-photo.jpg', imgBuffer, { headers: { Authorization: 'Bearer ' + netlifyToken, 'Content-Type': 'application/octet-stream' }, maxBodyLength: Infinity });
        finalUrl = 'https://' + siteName + '.netlify.app/denis-photo.jpg';
      }
    } catch (netErr) { console.error('[SavePhoto] Netlify upload failed:', netErr.message); }
  }
  const { upsertLead } = require('./leads');
  upsertLead(phone, { myPhotoUrl: finalUrl });
  res.json({ ok: true, photoUrl: finalUrl });
});

app.options('/save-photo', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

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
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages;
    if (messages?.length) {
      for (const msg of messages) {
        if (msg.type === 'text') {
          await handleIncomingMessage({ from: msg.from, text: { body: msg.text.body } });
        } else if (['audio', 'voice', 'image', 'video', 'document', 'sticker'].includes(msg.type)) {
          if (msg.from !== process.env.DENIS_PHONE) {
            await sendMessage(msg.from, 'היי 😊 אני עובד רק עם הודעות טקסט כרגע. כתוב/י לי ואשמח לעזור!');
          }
        }
      }
    }
  } catch (err) { console.error('[Server] Error:', err); }
});


// ── Denis Lead Intake Form ──
app.get('/lead-form', (req, res) => {
  const fs = require('fs'), path = require('path');
  res.sendFile(path.join(__dirname, 'denis-lead-form.html'));
});

app.options('/add-lead', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

app.post('/add-lead', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  try {
    const { upsertLead } = require('./leads');
    const { generateFollowupSequence } = require('./salesAnalysis');
    const { sendMessage } = require('./whatsapp');
    const DENIS = process.env.DENIS_PHONE || '972509698121';
    const d = req.body;
    if (!d.name || !d.phone) return res.status(400).json({ error: 'name and phone required' });

    upsertLead(d.phone, {
      name: d.name, phone: d.phone,
      profession: d.profession || null, source: d.source || 'form',
      painPoints: d.painPoints || [], goal: d.goal || null,
      currentRevenue: d.currentRevenue || null, targetRevenue: d.targetRevenue || null,
      proposalProgram: d.program || null, proposalPrice: d.price || null,
      lastNote: d.reaction || null, lastObjection: d.objection || null,
      temperature: d.temperature || null,
      closingProbability: d.closingProbability || null,
      nextFollowupDate: d.nextFollowupDate || null,
      nextFollowupAction: d.nextFollowupAction || 'whatsapp',
      notes: d.notes || null, status: 'diagnosed',
      lastMessageAt: new Date().toISOString()
    });
    upsertLead(DENIS, { lastDiscussedPhone: d.phone });

    const prob = d.closingProbability || 0;
    const icon = prob >= 70 ? '\uD83D\uDD25' : prob >= 50 ? '\u26A1' : '\uD83D\uDFE1';
    let notif = '\uD83D\uDCCB *ליד חדש נשמר!*\n\n';
    notif += '*' + d.name + '*' + (d.profession ? ' \u2014 ' + d.profession : '') + '\n';
    if (d.painPoints && d.painPoints[0]) notif += 'כאב: ' + d.painPoints[0] + '\n';
    if (d.goal) notif += 'מטרה: ' + d.goal + '\n';
    if (prob) notif += icon + ' סיכוי: ' + prob + '%\n';
    if (d.objection) notif += 'התנגדות: ' + d.objection + '\n';
    if (d.nextFollowupDate) notif += '\uD83D\uDDD3 פולואפ: ' + d.nextFollowupDate;
    await sendMessage(DENIS, notif);

    if (d.autoSequence) {
      try {
        const seq = await generateFollowupSequence({
          name: d.name, profession: d.profession,
          painPoints: d.painPoints, goal: d.goal,
          proposalProgram: d.program, proposalPrice: d.price,
          lastObjection: d.objection
        });
        if (seq) {
          upsertLead(d.phone, { followupSequence: seq });
          let seqMsg = '\uD83D\uDD01 *רצף פולואפ הופעל:*\n\n';
          seq.forEach(m => {
            seqMsg += '\uD83D\uDCC5 יום ' + m.day + ' (' + m.scheduledDate + '):\n"' +
              m.message.substring(0, 70) + (m.message.length > 70 ? '..."' : '"') + '\n\n';
          });
          await sendMessage(DENIS, seqMsg);
        }
      } catch(e) { console.error('[AutoSeq]', e.message); }
    }
    res.json({ ok: true, lead: d.name });
  } catch (err) {
    console.error('[AddLead]', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Sapir Zisman Bot running on port ${PORT}`);
  startFollowupScheduler();
  // Start proactive scheduler — morning/evening check-ins + follow-up reminders
  const DENIS_PHONE = process.env.DENIS_PHONE || '972509698121';
  startProactiveScheduler(
    sendMessage,
    () => DENIS_PHONE,
    getLeadsForFollowup
  );
});
