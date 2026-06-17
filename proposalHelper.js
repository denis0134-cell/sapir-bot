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
  const DENIS_DEFAULT_PHOTO = 'https://instagram.fhfa1-1.fna.fbcdn.net/v/t51.2885-19/429484293_1464583517747497_9005593983860294552_n.jpg';
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
