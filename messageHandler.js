const { sendMessage, notifyDenis } = require('./whatsapp');
const { generateResponse, extractLeadInfo } = require('./claude');
const { getLead, upsertLead, addMessage, getConversation } = require('./leads');
const { deployProposal } = require('./netlify');
const { generateProposalHTML } = require('./proposal');

async function handleIncomingMessage(message) {
  const phone = message.from;
  const text = message.text?.body?.trim();
  if (!text) return;

  console.log(`[Handler] ${phone}: "${text}"`);

    const isDenisCommand = /^(הצעה|סיכום)\s*\|/.test(text);
  if (phone === process.env.DENIS_PHONE && isDenisCommand) {
        await handleDenisCommand(phone, text);
        return;
    
  }

  await handleLeadMessage(phone, text);
}

async function handleDenisCommand(denisPhone, text) {
  const parts = text.split('|').map(p => p.trim());

  if (parts[0] === 'הצעה' && parts.length === 4) {
    const [, leadPhone, program, rawPrice] = parts;
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

  if (parts[0] === 'סיכום' && parts.length === 2) {
    const lead = getLead(parts[1]);
    if (!lead) { await sendMessage(denisPhone, `❌ לא נמצא ליד ${parts[1]}`); return; }
    await sendMessage(denisPhone,
      `📊 ${parts[1]}:\nשם: ${lead.name || '-'}\nמקצוע: ${lead.profession || '-'}\nסטטוס: ${lead.status}\nפולואפים: ${lead.followupCount}/6\nהצעה: ${lead.proposalUrl || 'לא נשלחה'}`
    );
    return;
  }

  await sendMessage(denisPhone,
    `📖 פקודות:\nהצעה | [מספר] | [מסלול] | [מחיר]\nדוגמה: הצעה | 972501234567 | ABM+LDB | 24900\n\nסיכום | [מספר]`
  );
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
    price: parseInt(price).toLocaleString('he-IL'),
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
