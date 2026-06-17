const { sendMessage, notifyDenis } = require('./whatsapp');
const { getLead, upsertLead, findLeadsByName, getNamedLeads } = require('./leads');
const { summarizeClient, summarizeFromHistory } = require('./claude');
const { generateAndSendProposal } = require('./proposalHelper');
const { detectAdminIntent } = require('./adminIntent');
const { parseNaturalCommand } = require('./commandParser');

async function handleDenisAdmin(denisPhone, text) {

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

  // SHORT unknown message — show help
  await sendMessage(denisPhone,
    '📖 פקודות:\n\nהצעה | [מספר] | [מסלול] | [מחיר]\nסכם | [פרטי לקוח]\n[שם לקוח] — חיפוש היסטוריה'
  );
}

module.exports = { handleDenisAdmin };
