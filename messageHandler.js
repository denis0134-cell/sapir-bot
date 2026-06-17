const { sendMessage, notifyDenis } = require('./whatsapp');
const { generateResponse, extractLeadInfo, summarizeClient, summarizeFromHistory } = require('./claude');
const { getLead, upsertLead, addMessage, getConversation, findLeadsByName, getNamedLeads } = require('./leads');
const { deployProposal } = require('./netlify');
const { generateProposalHTML } = require('./proposal');

async function handleIncomingMessage(message) {
  const phone = message.from;
  const text = message.text?.body?.trim();
  if (!text) return;

  console.log(`[Handler] ${phone}: "${text}"`);

  if (phone === process.env.DENIS_PHONE) {
    await handleDenisAdmin(phone, text);
    return;
  }

  await handleLeadMessage(phone, text);
}

async function handleDenisCommand(denisPhone, text) {
  const parts = text.split('|').map(p => p.trim());

  // ── Formatted command: הצעה | number | program | price ──
  if (parts[0] === 'הצעה' && parts.length >= 4) {
    const leadPhone = parts[1];
    const program = parts[2];
    const rawPrice = parts[3];

    // Parse optional extra fields: name=X | prof=X | rev=X | goal=X
    const extras = {};
    parts.slice(4).forEach(p => {
      const [k, ...v] = p.split('=');
      if (k && v.length) extras[k.trim()] = v.join('=').trim();
    });

    // Pre-populate lead data if extras provided
    if (extras.name || extras.prof) {
      const existing = getLead(leadPhone) || {};
      upsertLead(leadPhone, {
        ...existing,
        name: extras.name || existing.name,
        profession: extras.prof || existing.profession,
        currentRevenue: extras.rev || existing.currentRevenue,
        goal: extras.goal || existing.goal,
        lastMessageAt: new Date().toISOString()
      });
    }
    const price = rawPrice.replace(/[^0-9]/g, '');
    await sendMessage(denisPhone, `⏳ מייצר הצעה ל-${leadPhone}...`);
    try {
      await generateAndSendProposal(leadPhone, program.toUpperCase().replace(' ', ''), price);
      await sendMessage(denisPhone, `✅ הצעה נשלחה ל-${leadPhone}`);
    } catch (err) {
      await sendMessage(denisPhone, `❌ שגיאה: ${err.message}`);
    }
    return;
  }

  // ── Lead summary ──
  if (parts[0] === 'סיכום' && parts.length === 2) {
    const lead = getLead(parts[1]);
    if (!lead) { await sendMessage(denisPhone, `❌ לא נמצא ליד ${parts[1]}`); return; }
    await sendMessage(denisPhone,
      `📊 ${parts[1]}:\nשם: ${lead.name || '-'}\nמקצוע: ${lead.profession || '-'}\nסטטוס: ${lead.status}\nפולואפים: ${lead.followupCount}/6\nהצעה: ${lead.proposalUrl || 'לא נשלחה'}`
    );
    return;
  }

  // ── Client summary command ──
  // Supports: "סכם | [text]" OR "סכם [text]" OR long descriptive messages about clients
  const isSummaryRequest = (
    parts[0] === 'סכם' ||
    text.startsWith('סכם ') ||
    text.startsWith('תסכם') ||
    text.startsWith('סיכום') ||
    text.includes('תשלחי לי סיכום') ||
    text.includes('תשלח לי סיכום') ||
    text.includes('בקשה סיכום') ||
    (text.length > 60 && (text.includes('לקוח') || text.includes('לקוחה')) && !text.includes('|'))
  );

  if (isSummaryRequest) {
    // Extract the raw text - remove trigger words
    let rawText = text
      .replace(/^סכם\s*\|?\s*/,'')
      .replace(/^תסכם\s*לי\s*/,'')
      .replace(/^סיכום\s*\|?\s*/,'')
      .trim();
    
    // If message was "היי תשלחי לי סיכום מפורט לפי כל המידע שארשום לך על לקוחה"
    // wait for the actual info in next message — store state
    if (rawText.length < 20) {
      await sendMessage(denisPhone, '📝 בסדר, שלח/י את הפרטים על הלקוח ואני אסכם.');
      // Store pending summary state
      const { upsertLead } = require('./leads');
      upsertLead(denisPhone, { pendingSummary: true });
      return;
    }

    await sendMessage(denisPhone, '⏳ מסכם...');
    const summary = await summarizeClient(rawText);
    await sendMessage(denisPhone, summary);
    return;
  }

  // ── Update last discussed client (תוסיפי, עדכן, הוסף) ──
  const isUpdateCmd = /^(תוסיפי|תוסיף|עדכן|עדכני|הוסיפי|הוסף|שמור|שמרי)/i.test(text);
  if (isUpdateCmd) {
    const denisData = getLead(denisPhone);
    const lastPhone = denisData && denisData.lastDiscussedPhone;
    
    // Extract phone number from message if present
    const phoneMatch = text.match(/(?:97[2]|0)([5][0-9]{8})/);
    const newPhone = phoneMatch ? ('972' + (phoneMatch[0].startsWith('0') ? phoneMatch[0].slice(1) : phoneMatch[0].replace('972',''))) : null;
    
    // Extract name if mentioned
    const nameMatch = text.match(/שם[: ]+([^\d,]+)/);
    const newName = nameMatch ? nameMatch[1].trim().substring(0, 30) : null;
    
    if (lastPhone && (newPhone || newName)) {
      const updates = {};
      if (newPhone) updates.phone = newPhone;
      if (newName) updates.name = newName;
      upsertLead(lastPhone, updates);
      const lead = getLead(newPhone || lastPhone);
      const updateMsg = Object.entries(updates).map(([k,v]) => `${k === 'phone' ? '📱 טלפון' : '👤 שם'}: ${v}`).join(', ');
      await sendMessage(denisPhone, `✅ עודכן ל-${lead.name || lastPhone}: ${updateMsg}`);
      return;
    }
    
    if (!lastPhone) {
      await sendMessage(denisPhone, '❓ לא ברור לאיזה לקוח להוסיף. אמור קודם שם לקוח ואז עדכן.');
      return;
    }
  }

  // ── Client lookup by name: Denis types a client name to get their history ──
  const isLookupByName = (
    text.length < 40 &&
    !text.includes('|') &&
    !isSummaryRequest &&
    (text.startsWith('מה עם') || text.startsWith('סיכום') ||
     text.startsWith('תן לי') || text.startsWith('מי') ||
     // Check if text matches a saved lead name
     findLeadsByName(text.replace(/^(מה עם|סיכום|תן לי|מי)\s*/,'')).length > 0)
  );

  if (isLookupByName) {
    const query = text.replace(/^(מה עם|סיכום על|סיכום|תן לי|מי)\s*/,'').trim();
    const matches = findLeadsByName(query);
    
    if (matches.length === 0) {
      await sendMessage(denisPhone, '❌ לא מצאתי לקוח בשם "' + query + '" במערכת.');
      return;
    }
    
    if (matches.length > 1) {
      const list = matches.map(l => '• ' + l.name + ' (' + l.phone + ')').join('\n');
      await sendMessage(denisPhone, 'נמצאו ' + matches.length + ' לקוחות:\n' + list + '\n\nשלח את המספר הספציפי לסיכום.');
      return;
    }
    
    const lead = matches[0];
    // Remember last discussed client
    upsertLead(denisPhone, { lastDiscussedPhone: lead.phone });
    await sendMessage(denisPhone, `⏳ מושך סיכום ל-${lead.name}...`);
    const summary = await summarizeFromHistory(lead);
    await sendMessage(denisPhone, summary);
    return;
  }

  // ── Check if Denis sent client info after requesting summary ──
  const denisLead = getLead(denisPhone);
  if (denisLead && denisLead.pendingSummary && text.length > 20 && !text.includes('|')) {
    const { upsertLead } = require('./leads');
    upsertLead(denisPhone, { pendingSummary: false });
    await sendMessage(denisPhone, '⏳ מסכם...');
    const summary = await summarizeClient(text);
    await sendMessage(denisPhone, summary);
    return;
  }

  // ── Natural language command (e.g. "תייצר הצעה LDB לנייד 0528201238 מחיר 16900") ──
  const nlResult = parseNaturalCommand(text);
  if (nlResult) {
    const { phone, program, price } = nlResult;
    await sendMessage(denisPhone, `⏳ מייצר הצעה (${program} | ₪${price}) ל-${phone}...`);
    try {
      await generateAndSendProposal(phone, program, price);
      await sendMessage(denisPhone, `✅ הצעה נשלחה ל-${phone}`);
    } catch (err) {
      await sendMessage(denisPhone, `❌ שגיאה: ${err.message}`);
    }
    return;
  }

  await sendMessage(denisPhone,
    `📖 פקודות:\n\nפורמט: הצעה | [מספר] | [מסלול] | [מחיר]\nדוגמה: הצעה | 972501234567 | ABM+LDB | 24900\n\nאו במילים חופשיות:\n"הצעה LDB לנייד 0528201238 מחיר 16900"\n\nסיכום | [מספר]`
  );
}

// Parse natural language Denis commands
function parseNaturalCommand(text) {
  const t = text.toLowerCase();

  // Must mention הצעה or proposal
  if (!t.includes('הצע') && !t.includes('proposal') && !t.includes('תייצר') && !t.includes('לשלוח')) return null;

  // Extract phone number (Israeli format)
  const phoneMatch = text.match(/(?:97[2]|0)([5][0-9]{8}|[2-9][0-9]{7})/);
  if (!phoneMatch) return null;
  const rawPhone = phoneMatch[0];
  const phone = rawPhone.startsWith('0') ? '972' + rawPhone.slice(1) : rawPhone;

  // Detect program
  let program = 'BOTH';
  if (/abm\+ldb|שניהם|הכל|משולב|both/i.test(text)) program = 'ABM+LDB';
  else if (/\babm\b/i.test(text)) program = 'ABM';
  else if (/\bldb\b/i.test(text)) program = 'LDB';

  // Detect price (4-5 digit number)
  const priceMatch = text.match(/(?:מחיר|₪|ש"ח|שקל|עולה)?\s*(\d{4,6})/);
  const defaultPrices = { 'ABM': '13900', 'LDB': '18900', 'BOTH': '24900', 'ABM+LDB': '24900' };
  const price = priceMatch ? priceMatch[1] : defaultPrices[program];

  return { phone, program, price };
}

async function handleLeadMessage(phone, text) {
  let lead = getLead(phone);
  if (!lead) upsertLead(phone, { status: 'new', lastMessageAt: new Date().toISOString() });

  upsertLead(phone, { lastResponseAt: new Date().toISOString(), lastMessageAt: new Date().toISOString() });
  addMessage(phone, 'user', text);

  const conversation = getConversation(phone);
  const result = await generateResponse(conversation);

  await sendMessage(phone, result.message);
  addMessage(phone, 'assistant', result.message);

  // ── Auto-generate proposal when Claude decides it's time ──
  if (result.action === 'send_proposal' && result.proposalData) {
    const { program, price } = result.proposalData;
    const normalizedProgram = program === 'BOTH' ? 'ABM+LDB' : program;
    try {
      await generateAndSendProposal(phone, normalizedProgram, price);
      await notifyDenis(`📋 הצעה נשלחה אוטומטית ל-${getLead(phone)?.name || phone} — ${normalizedProgram} ₪${price}`);
    } catch (err) {
      console.error('[Handler] Auto-proposal error:', err.message);
    }
  }

  if (result.action === 'booked') {
    upsertLead(phone, { status: 'booked', followupCount: 0 });
    lead = getLead(phone);
    await notifyDenis(`🔥 ליד חם! ${lead.name || phone} שריין שיחה!\n${process.env.CALENDAR_LINK}`);
  }

  if (result.action === 'hot_lead') {
    lead = getLead(phone);
    await notifyDenis(`⚡ ליד חם מאוד! ${lead.name || phone} מוכן לרכישה עכשיו! 🚀`);
  }

  if (result.extractedInfo) {
    const info = result.extractedInfo;
    const updates = {};
    if (info.name) updates.name = info.name;
    if (info.profession) updates.profession = info.profession;
    if (info.business) updates.business = info.business;
    if (info.currentRevenue) updates.currentRevenue = info.currentRevenue;
    if (info.goal) updates.goal = info.goal;
    if (info.painPoints?.length) updates.painPoints = info.painPoints;
    if (Object.keys(updates).length) upsertLead(phone, updates);
  }

  lead = getLead(phone);
  if (lead.status === 'new') upsertLead(phone, { status: 'in_conversation' });
}


// Safe price formatter — prevents phone numbers being used as price
function formatPrice(raw) {
  const num = parseInt(String(raw || '').replace(/[^0-9]/g, ''));
  if (isNaN(num) || num <= 0 || num > 99999) return '24,900';
  return num.toLocaleString('he-IL');
}

async function generateAndSendProposal(phone, program, price) {
  const lead = getLead(phone) || {};
  let extracted = {};

  if (lead.conversation?.length) {
    extracted = await extractLeadInfo(getConversation(phone));
  }

  const data = {
    clientName: lead.name || extracted.name || 'לקוח יקר',
    clientProfession: lead.profession || extracted.profession || '',
    clientBusiness: lead.business || extracted.business || '',
    currentRevenue: lead.currentRevenue || extracted.currentRevenue || null,
    goal: lead.goal || extracted.goal || '',
    painPoints: lead.painPoints?.length ? lead.painPoints : (extracted.painPoints || []),
    program: program === 'ABM+LDB' ? 'BOTH' : program,
    price: formatPrice(price),
    calendarLink: process.env.CALENDAR_LINK
  };

  if (data.currentRevenue) {
    const n = parseInt(data.currentRevenue.replace(/[^0-9]/g, ''));
    if (!isNaN(n)) data.targetRevenue = `${n * 2}K+`;
  }

  const html = generateProposalHTML(data);
  const url = await deployProposal(html, data.clientName);

  const msg = `היי ${data.clientName} 🌟\n\nהכנתי לך הצעה מותאמת אישית — כנס/י לראות:\n\n${url}\n\nשאלות? אני כאן 🙏`;
  await sendMessage(phone, msg);

  upsertLead(phone, {
    status: 'proposal_sent',
    proposalUrl: url,
    proposalProgram: program,
    proposalPrice: price,
    followupCount: 0,
    lastFollowupAt: new Date().toISOString()
  });

  addMessage(phone, 'assistant', msg);
  return url;
}

module.exports = { handleIncomingMessage };
