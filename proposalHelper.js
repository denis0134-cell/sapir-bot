const { getLead, upsertLead, addMessage, getConversation } = require('./leads');
const { extractLeadInfo } = require('./claude');
const { deployProposal } = require('./netlify');
const { generateProposalHTML } = require('./proposal');
const { sendMessage } = require('./whatsapp');

function formatPrice(raw) {
  const num = parseInt(String(raw || '').replace(/[^0-9]/g, ''));
  if (isNaN(num) || num <= 0 || num > 99999) return '24,900';
  return num.toLocaleString('he-IL');
}

async function generateAndSendProposal(phone, program, price) {
  const lead = getLead(phone) || {};
  let extracted = {};
  if (lead.conversation && lead.conversation.length > 0) {
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
    const n = parseInt(String(data.currentRevenue).replace(/[^0-9]/g, ''));
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

module.exports = { generateAndSendProposal, formatPrice };
