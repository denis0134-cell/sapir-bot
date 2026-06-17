const { getLead, upsertLead, addMessage, getConversation } = require('./leads');
const { extractLeadInfo, generateProposalHeadline } = require('./claude');
const { deployProposal } = require('./netlify');
const { generateProposalHTML } = require('./proposal');
const { sendMessage } = require('./whatsapp');
const { fetchSocialPhoto } = require('./socialPhoto');

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

  // If social URL is Denis's own Instagram, store it as his photo (not client photo)
  const rawSocialUrl = lead.socialUrl || null;
  const isDenisOwnProfile = rawSocialUrl && (
    rawSocialUrl.includes('__denis.pol__') ||
    rawSocialUrl.includes('denis.pol')
  );
  if (isDenisOwnProfile && rawSocialUrl) {
    console.log('[Proposal] Social URL is Denis own profile — fetching his photo');
    const extracted = await require('./socialPhoto').fetchSocialPhoto(rawSocialUrl);
    if (extracted) {
      upsertLead(process.env.DENIS_PHONE, { myPhotoUrl: extracted });
      console.log('[Proposal] Denis photo updated:', extracted.substring(0, 60));
    }
  }

  // Fetch CLIENT photo from social URL if available (client, not Denis)
  let clientPhotoUrl = lead.photoUrl || null;
  const socialUrl = lead.socialUrl || extracted.socialUrl || null;
  if (!clientPhotoUrl && socialUrl) {
    console.log('[Proposal] Fetching photo from:', socialUrl);
    clientPhotoUrl = await fetchSocialPhoto(socialUrl);
    if (clientPhotoUrl) {
      upsertLead(phone, { photoUrl: clientPhotoUrl });
      console.log('[Proposal] Photo found:', clientPhotoUrl);
    }
  }

  const clientName = lead.name || extracted.name || 'לקוח יקר';
  const clientProfession = lead.profession || extracted.profession || '';

  // Build role badges from profession
  const clientRoles = lead.roles || (clientProfession ? [`💼 ${clientProfession}`, '🤖 AI שעובד בשבילך — חדש!'] : []);

  // Get Denis's stored photo (with CDN fallback from Instagram)
  const denisLead = require('./leads').getLead(process.env.DENIS_PHONE);
  // Denis's profile photo (base64 - permanent, works without external hosting)
  const DENIS_DEFAULT_PHOTO = 'data:image/jpeg;base64,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';
  const denisPhotoUrl = (denisLead && denisLead.myPhotoUrl) || process.env.DENIS_PHOTO_URL || DENIS_DEFAULT_PHOTO;

  const data = {
    clientName,
    clientProfession,
    clientBusiness: lead.business || extracted.business || '',
    clientRoles,
    currentRevenue: lead.currentRevenue || extracted.currentRevenue || null,
    targetRevenue: lead.targetRevenue || null,
    goal: lead.goal || extracted.goal || '',
    painPoints: lead.painPoints?.length ? lead.painPoints : (extracted.painPoints || []),
    program: program === 'ABM+LDB' ? 'BOTH' : program,
    price: formatPrice(price),
    calendarLink: process.env.CALENDAR_LINK,
    clientPhotoUrl,
    socialUrl,
    denisPhotoUrl,
  };

  // Generate AI personalized headline
  let headlineData = {};
  try {
    headlineData = await generateProposalHeadline(data);
    console.log('[Proposal] Headline generated:', headlineData.headline?.substring(0, 50));
  } catch (err) {
    console.error('[Proposal] Headline error:', err.message);
  }

  const html = generateProposalHTML({ ...data, ...headlineData });
  const url = await deployProposal(html, clientName);

  const msg = `היי ${clientName} 🌟\n\nהכנתי לך הצעה מותאמת אישית — כנס/י לראות:\n\n${url}\n\nשאלות? אני כאן 🙏`;
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
