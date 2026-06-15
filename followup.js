const cron = require('node-cron');
const { getLeadsForFollowup, upsertLead, markNotRelevant } = require('./leads');
const { sendMessage, notifyDenis } = require('./whatsapp');

const MSGS = {
  proposal_sent: [
    n => `היי ${n} 👋 שלחתי לך הצעה מותאמת אישית. חשוב שתקח כמה דקות לראות אותה — בניתי אותה במיוחד עבורך.`,
    n => `היי ${n}, דניס כאן 🙏 רציתי לבדוק אם הספקת לראות את ההצעה. יש שם דברים שחשוב לי שתדע.`,
    n => `בוקר טוב ${n} ✨ אני לא רוצה שהזדמנות הזו תחמוק. ראית את ההצעה?`,
    n => `היי ${n}, אם יש משהו שלא ברור — אני כאן. זה בדיוק בשביל זה 💬`,
    n => `היי ${n} 🌟 אני לא מוותר עלייך כי ראיתי פוטנציאל אמיתי. מה מעכב אותך?`,
    n => `היי ${n}, מבין שאולי זה לא הזמן הנכון. הכניס/י אותי בחשבון לעתיד 🙏`
  ],
  in_conversation: [
    n => `היי ${n} 👋 דניס כאן. עדיין מעניין אותך להתקדם? אשמח לענות על כל שאלה.`,
    n => `היי ${n}, יש לי כמה רעיונות ספציפיים לעסק שלך. מתי 20 דקות נוחות לשוחח? 📞`,
    n => `בוקר טוב ${n} ☀️ השיחה תהיה קצרה וממוקדת — 20 דקות בלבד. מה אומר?`,
    n => `היי ${n}, הנושא עדיין רלוונטי לך? יש לי תוצאות מהחודשים האחרונים שאשמח לשתף 💡`,
    n => `היי ${n} 🙏 ניסיון אחרון — אם תרצה לשוחח, אני כאן.`,
    n => `היי ${n}, מבין שאולי זה לא הזמן. הכניס/י אותי בחשבון בעתיד. שיהיה לך יום טוב 🙏`
  ],
  new: [
    n => `היי ${n} 👋 אני דניס ממכללת ספיר זיסמן. שמחתי לשמוע עלייך — האם יש מועד נוח לשיחה קצרה?`,
    n => `היי ${n}, דניס כאן. רוצה לתאם 20 דקות ממוקדות. מתי נוח לך?`,
    n => `בוקר טוב ${n} ☀️ 20 דקות בלבד, ממוקדות לחלוטין. מתי?`,
    n => `היי ${n}, הנושא של צמיחה עסקית עדיין רלוונטי? אשמח לשמוע.`,
    n => `היי ${n} 🙏 ניסיון אחרון — אם תרצה לשוחח, אני כאן.`,
    n => `היי ${n}, מבין שאולי זה לא הזמן. הכניס/י אותי בחשבון בעתיד 🙏`
  ]
};

async function runFollowups() {
  console.log('[Followup] Running...');
  const leads = getLeadsForFollowup();

  for (const lead of leads) {
    try {
      const count = lead.followupCount || 0;

      if (count >= 6) {
        markNotRelevant(lead.phone);
        await notifyDenis(`📋 הליד ${lead.name || lead.phone} סומן "לא רלוונטי" אחרי 6 הודעות ללא מענה.`);
        continue;
      }

      const scenario = lead.status === 'proposal_sent' ? 'proposal_sent'
        : lead.status === 'in_conversation' ? 'in_conversation' : 'new';

      const msg = MSGS[scenario][count](lead.name || '');
      await sendMessage(lead.phone, msg);

      upsertLead(lead.phone, {
        followupCount: count + 1,
        lastFollowupAt: new Date().toISOString()
      });

      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[Followup] Error ${lead.phone}:`, err.message);
    }
  }
}

function startFollowupScheduler() {
  console.log('[Followup] Scheduler started — 10:00 + 17:00 Israel time');
  cron.schedule('0 10 * * *', runFollowups, { timezone: 'Asia/Jerusalem' });
  cron.schedule('0 17 * * *', runFollowups, { timezone: 'Asia/Jerusalem' });
}

module.exports = { startFollowupScheduler };
