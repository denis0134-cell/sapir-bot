const { sendMessage, notifyDenis } = require('./whatsapp');
const { getLead, upsertLead, findLeadsByName, getNamedLeads } = require('./leads');
const { summarizeClient, summarizeFromHistory } = require('./claude');
const { generateAndSendProposal } = require('./proposalHelper');
const { detectAdminIntent } = require('./adminIntent');
const { parseNaturalCommand } = require('./commandParser');

async function handleDenisAdmin(denisPhone, text) {

  // ── Denis photo update: תמונה | [URL] ──
  if (text.startsWith('תמונה |') || text.startsWith('תמונה שלי |') || text.startsWith('עדכן תמונה |')) {
    const photoUrl = text.split('|').slice(1).join('|').trim();
    if (!photoUrl.startsWith('http')) {
      await sendMessage(denisPhone, '❌ שלח URL ישיר לתמונה. לדוגמה: תמונה | https://example.com/photo.jpg');
      return;
    }
    upsertLead(denisPhone, { myPhotoUrl: photoUrl });
    await sendMessage(denisPhone, '✅ תמונה נשמרה! תופיע בכל ההצעות הבאות 📸\n\n' + photoUrl);
    return;
  }

  // ── Form command: deploy client form and return URL ──
  if (/^(טופס|תשלח טופס|שלח טופס|form)/i.test(text)) {
    await sendMessage(denisPhone, '⏳ מכין טופס...');
    try {
      const fs = require('fs');
      const path = require('path');
      const axios = require('axios');
      const crypto = require('crypto');
      
      const formPath = path.join(__dirname, 'client-form.html');
      const htmlBytes = fs.readFileSync(formPath);
      const sha1 = crypto.createHash('sha1').update(htmlBytes).digest('hex');
      const token = process.env.NETLIFY_TOKEN;
      const siteName = 'sapir-client-form';
      
      // Check if site exists, create if not
      let siteId;
      try {
        const existing = await axios.get('https://api.netlify.com/api/v1/sites?filter=owner&name=' + siteName, {
          headers: { Authorization: 'Bearer ' + token }
        });
        const found = existing.data.find(s => s.name === siteName);
        siteId = found ? found.id : null;
      } catch {}
      
      if (!siteId) {
        const siteRes = await axios.post('https://api.netlify.com/api/v1/sites', { name: siteName }, {
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
        });
        siteId = siteRes.data.id;
      }
      
      const deployRes = await axios.post('https://api.netlify.com/api/v1/sites/' + siteId + '/deploys',
        { files: { '/index.html': sha1 } },
        { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }
      );
      
      await axios.put('https://api.netlify.com/api/v1/deploys/' + deployRes.data.id + '/files/index.html',
        htmlBytes,
        { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/octet-stream' }, maxBodyLength: Infinity }
      );
      
      const formUrl = 'https://' + siteName + '.netlify.app';
      await sendMessage(denisPhone, '📋 הנה הטופס:\n\n' + formUrl + '\n\nמלא ← לחץ "שלח לבוט" ← הבוט יבנה דף נחיתה ⚡');
    } catch (err) {
      console.error('[Form] Deploy error:', err.message);
      await sendMessage(denisPhone, '❌ שגיאה בפרסום הטופס: ' + err.message);
    }
    return;
  }

  // ── Formatted command: הצעה | number | program | price ──
  const parts = text.split('|').map(p => p.trim());
  if (parts[0] === 'הצעה' && parts.length >= 4) {
    const leadPhone = parts[1];
    const program = parts[2];
    const rawPrice = parts[3];
    const price = rawPrice.replace(/[^0-9]/g, '');

    // Parse optional extra fields
    const extras = {};
    parts.slice(4).forEach(p => {
      const [k, ...v] = p.split('=');
      if (k && v.length) extras[k.trim()] = v.join('=').trim();
    });
    if (extras.name || extras.prof) {
      upsertLead(leadPhone, {
        name: extras.name,
        profession: extras.prof,
        currentRevenue: extras.rev,
        goal: extras.goal,
        lastMessageAt: new Date().toISOString()
      });
    }

    await sendMessage(denisPhone, `⏳ מייצר הצעה ל-${leadPhone}...`);
    try {
      const url = await generateAndSendProposal(leadPhone, program.toUpperCase().replace(' ', ''), price);
      await sendMessage(denisPhone, `✅ הצעה נשלחה ל-${leadPhone}\n${url}`);
    } catch (err) {
      await sendMessage(denisPhone, `❌ שגיאה: ${err.message}`);
    }
    return;
  }

  // ── Summary command ──
  if (parts[0] === 'סיכום' && parts.length === 2) {
    const lead = getLead(parts[1]);
    if (!lead) { await sendMessage(denisPhone, `❌ לא נמצא ליד ${parts[1]}`); return; }
    await sendMessage(denisPhone, `⏳ מושך סיכום...`);
    const summary = await summarizeFromHistory(lead);
    upsertLead(denisPhone, { lastDiscussedPhone: lead.phone });
    await sendMessage(denisPhone, summary);
    return;
  }

  // ── Landing Page command: דף נחיתה | phone | businessName | ... ──
  if (parts[0] === 'דף נחיתה' && parts.length >= 3) {
    await sendMessage(denisPhone, '⏳ בונה דף נחיתה... (30-60 שניות)');
    try {
      const { generateLandingPage } = require('./landingPageBuilder');
      const { deployProposal } = require('./netlify');

      const phone = parts[1];
      const businessName = parts[2];

      // Parse all optional params
      const extras = {};
      parts.slice(3).forEach(p => {
        const [k, ...v] = p.split('=');
        if (k && v.length) extras[k.trim()] = v.join('=').trim();
      });

      const businessData = {
        businessName,
        ownerName: extras.owner || '',
        botDescription: extras.desc || 'בוט WhatsApp חכם לניהול לקוחות',
        targetAudience: extras.audience || 'בעלי עסקים קטנים ובינוניים',
        features: extras.features ? extras.features.split(',').map(f=>f.trim()) : [],
        phone: phone,
        price: extras.price || '',
        calendarLink: extras.calendar || process.env.CALENDAR_LINK,
        results: extras.results ? extras.results.split(',').map(r=>r.trim()) : [],
        painPoints: extras.pains ? extras.pains.split(',').map(p=>p.trim()) : [],
        chatMockup: { userMsg: extras.msgUser || '', botMsg: extras.msgBot || '' }
      };

      const html = await generateLandingPage(businessData);
      const url = await deployProposal(html, businessName);

      await sendMessage(denisPhone, '✅ דף נחיתה מוכן!\n\n' + url + '\n\nשלח ללקוח 🚀');
    } catch (err) {
      console.error('[LandingPage] Error:', err.message);
      await sendMessage(denisPhone, '❌ שגיאה: ' + err.message);
    }
    return;
  }

  // ── All other messages: use Claude to detect intent ──
  const denisData = getLead(denisPhone) || {};
  const lastPhone = denisData.lastDiscussedPhone;
  const namedLeads = getNamedLeads();

  await sendMessage(denisPhone, '⏳...');

  const intent = await detectAdminIntent(text, lastPhone, namedLeads);
  console.log('[Admin] Intent detected:', JSON.stringify(intent));

  // LOOKUP: find client by name
  if (intent.intent === 'lookup' && intent.clientName) {
    const matches = findLeadsByName(intent.clientName);
    if (matches.length === 0) {
      await sendMessage(denisPhone, `❌ לא מצאתי לקוח בשם "${intent.clientName}" במערכת.`);
      return;
    }
    const lead = matches[0];
    upsertLead(denisPhone, { lastDiscussedPhone: lead.phone });
    const summary = await summarizeFromHistory(lead);
    await sendMessage(denisPhone, summary);
    return;
  }

  // SUMMARIZE NEW: summarize raw client info
  if (intent.intent === 'summarize_new') {
    const summary = await summarizeClient(text);
    await sendMessage(denisPhone, summary);
    // If phone detected, save as new lead
    if (intent.phone) {
      upsertLead(intent.phone, {
        phone: intent.phone,
        name: intent.clientName,
        lastMessageAt: new Date().toISOString()
      });
      upsertLead(denisPhone, { lastDiscussedPhone: intent.phone });
    }
    return;
  }

  // UPDATE LEAD: add phone/info to last discussed client
  if (intent.intent === 'update_lead') {
    const targetPhone = intent.phone && intent.phone !== denisPhone ? intent.phone : lastPhone;
    if (!targetPhone) {
      await sendMessage(denisPhone, '❓ לא ברור לאיזה לקוח. אמור קודם שם לקוח.');
      return;
    }
    const updates = {};
    if (intent.newPhone) updates.phone = intent.newPhone;
    if (intent.clientName) updates.name = intent.clientName;
    if (intent.extraInfo) updates.notes = intent.extraInfo;
    
    if (Object.keys(updates).length > 0) {
      upsertLead(targetPhone, updates);
      const msgs = Object.entries(updates)
        .map(([k,v]) => `${k === 'phone' ? '📱 טלפון' : k === 'name' ? '👤 שם' : '📝 הערה'}: ${v}`)
        .join('\n');
      const lead = getLead(updates.phone || targetPhone);
      await sendMessage(denisPhone, `✅ עודכן${lead && lead.name ? ' ל-' + lead.name : ''}:\n${msgs}`);
    } else {
      await sendMessage(denisPhone, '❓ לא הבנתי מה לעדכן. נסה שוב.');
    }
    return;
  }

  // PROPOSAL: natural language proposal
  if (intent.intent === 'proposal') {
    const nlResult = parseNaturalCommand(text);
    if (nlResult) {
      await sendMessage(denisPhone, `⏳ מייצר הצעה (${nlResult.program} | ₪${nlResult.price}) ל-${nlResult.phone}...`);
      try {
        await generateAndSendProposal(nlResult.phone, nlResult.program, nlResult.price);
        await sendMessage(denisPhone, `✅ הצעה נשלחה ל-${nlResult.phone}`);
      } catch (err) {
        await sendMessage(denisPhone, `❌ שגיאה: ${err.message}`);
      }
      return;
    }
  }

  // FALLBACK: if message is long — always summarize it
  if (text.length > 60) {
    const summary = await summarizeClient(text);
    await sendMessage(denisPhone, summary);
    return;
  }

  // SHORT message with proposal keywords — ask for client details
  const proposalKeywords = ['הצעת מחיר', 'הצעה', 'לבנות הצעה', 'proposal'];
  if (proposalKeywords.some(k => text.includes(k))) {
    await sendMessage(denisPhone,
      'כדי לבנות הצעה, שלח/י פרטי הלקוח בפורמט חופשי, לדוגמה:\n\n' +
      'שם: יוסי כהן\n' +
      'עסק: מספרה תל אביב\n' +
      'מצב: עובד לבד, אין לקוחות חדשים\n' +
      'רוצה: להגדיל הכנסה\n' +
      'עצר אותו: אין זמן ללמוד\n' +
      'נייד: 05XXXXXXXX\n' +
      'מחיר שדיברנו: 13,900\n\n' +
      'ואני אבנה את הסיכום + הצעה תוך שניות ⚡'
    );
    return;
  }

  // SHORT unknown message — show help
  await sendMessage(denisPhone,
    '📖 פקודות:\n\nהצעה | [מספר] | [מסלול] | [מחיר]\nסכם | [פרטי לקוח]\n[שם לקוח] — חיפוש היסטוריה'
  );
}

module.exports = { handleDenisAdmin };
