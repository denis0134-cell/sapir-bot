/**
 * proactiveBot.js
 * אלונה יוזמת — שולחת הודעות ביוזמתה לדניס
 * בוקר: 8:00 | תזכורת פולואפ: 10:00 | ערב: 21:00
 */
const { getMorningQuestions, getEveningQuestions, getGoalStatus, getTasks } = require('./personalData');

let sendMessageFn = null;
let denisPhoneFn = null;
let getLeadsForFollowupFn = null;

// Track what was already sent today (resets on restart, that's fine)
const sentToday = {};
function todayKey(type) {
  return `${new Date().toISOString().split('T')[0]}_${type}`;
}
function alreadySent(type) {
  return !!sentToday[todayKey(type)];
}
function markSent(type) {
  sentToday[todayKey(type)] = true;
}

// Israel timezone: UTC+3 (close enough for summer/winter)
function israelTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const israel = new Date(utc + 3 * 3600000);
  return { hour: israel.getHours(), minute: israel.getMinutes(), day: israel.getDay() };
}

async function checkAndSend() {
  if (!sendMessageFn || !denisPhoneFn) return;
  const { hour, minute, day } = israelTime();
  const phone = denisPhoneFn();

  // 8:00 AM — Morning check-in (weekdays only: 0=Sun...6=Sat, skip Sat=6)
  if (hour === 8 && minute < 6 && day !== 6 && !alreadySent('morning')) {
    markSent('morning');
    try {
      const tasks = getTasks(true);
      const highPrio = tasks.filter(t => t.priority === 'high');
      let msg = getMorningQuestions();
      if (highPrio.length > 0) {
        msg += `\n\n🔴 *משימות דחופות מאתמול:*\n${highPrio.map(t => `• ${t.text}`).join('\n')}`;
      }
      await sendMessageFn(phone, msg);
    } catch (e) { console.error('[Proactive] Morning error:', e.message); }
    return;
  }

  // 10:00 AM — Follow-up reminders
  if (hour === 10 && minute < 6 && day !== 6 && !alreadySent('followup')) {
    markSent('followup');
    try {
      if (!getLeadsForFollowupFn) return;
      const overdue = getLeadsForFollowupFn();
      if (overdue.length > 0) {
        const list = overdue.slice(0, 5).map(l =>
          `• ${l.name || l.phone} — ${l.status || 'ממתין'}`
        ).join('\n');
        await sendMessageFn(phone,
          `🔔 *פולואפ — ${overdue.length} לידים מחכים:*\n\n${list}\n\nכתוב "פולואפ ל[שם]" לקבל הודעה מוכנה`
        );
      }
    } catch (e) { console.error('[Proactive] Followup error:', e.message); }
    return;
  }

  // 21:00 — Evening check-in
  if (hour === 21 && minute < 6 && !alreadySent('evening')) {
    markSent('evening');
    try {
      const goals = getGoalStatus();
      let msg = getEveningQuestions();
      msg += `\n\n${goals}`;
      await sendMessageFn(phone, msg);
    } catch (e) { console.error('[Proactive] Evening error:', e.message); }
    return;
  }
}

function startProactiveScheduler(sendMsg, getPhone, getFollowups) {
  sendMessageFn = sendMsg;
  denisPhoneFn = getPhone;
  getLeadsForFollowupFn = getFollowups;

  setInterval(checkAndSend, 5 * 60 * 1000); // check every 5 minutes
  console.log('[ProactiveBot] Scheduler started — morning 8:00, followups 10:00, evening 21:00');
}

module.exports = { startProactiveScheduler };
