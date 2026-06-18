/**
 * proactiveBot.js
 * אלונה יוזמת — שולחת הודעות ביוזמתה לדניס
 * בוקר: 8:00 | תזכורת פולואפ: 10:00 | ערב: 21:00
 */
const { getMorningQuestions, getEveningQuestions, getGoalStatus, getTasks, checkAccountability, generateLifeDashboard, getScoresText } = require('./personalData');
const { getLeadsDueToday } = require('./leads');
const { writeFollowupMessages } = require('./salesAnalysis');

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

  // 7:00 AM — Daily Dashboard + Accountability (every weekday)
  if (hour === 7 && minute < 6 && day !== 6 && !alreadySent('dashboard')) {
    markSent('dashboard');
    try {
      const dashboard = generateLifeDashboard();
      const acc = checkAccountability();
      let msg = dashboard;
      if (acc.length > 0) msg += `\n\n⚠️ ${acc[0].message}`;
      await sendMessageFn(phone, msg);
    } catch (e) { console.error('[Proactive] Dashboard error:', e.message); }
    return;
  }

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
      const dueToday = getLeadsDueToday ? getLeadsDueToday() : [];
      if (dueToday.length > 0) {
        // Summary header
        const header = '🔔 *פולואפ היום — ' + dueToday.length + ' לידים:*\n\n' +
          dueToday.slice(0,5).map(l => {
            const prob = l.closingProbability;
            const icon = prob >= 70 ? '🔥' : prob >= 50 ? '⚡' : '🟡';
            return icon + ' ' + (l.name || l.phone) + (prob ? ' (' + prob + '%)' : '') + ' — ' + (l.status || 'ממתין');
          }).join('\n');
        await sendMessageFn(phone, header);

        // Ready message for top lead
        const topLead = dueToday[0];
        if (topLead && topLead.name) {
          const days = topLead.lastMessageAt
            ? Math.floor((Date.now() - new Date(topLead.lastMessageAt)) / 86400000)
            : 3;
          try {
            const readyMsg = await writeFollowupMessages(topLead, topLead.status || 'follow_up', days);
            await sendMessageFn(phone,
              '✍️ *הודעה מוכנה ל' + topLead.name + ':*\n\n' + readyMsg +
              '\n\n(העתק ושלח, או כתוב "פולואפ ל' + topLead.name + '" לגרסה אחרת)'
            );
          } catch {}
        }
      }
    } catch (e) { console.error('[Proactive] Followup error:', e.message); }
    return;
  }

  // Friday 17:00 — Weekly report
  if (hour === 17 && minute < 6 && day === 5 && !alreadySent('weekly')) {
    markSent('weekly');
    try {
      const { generateWeeklyReport } = require('./personalData');
      await sendMessageFn(phone, generateWeeklyReport());
    } catch (e) { console.error('[Proactive] Weekly report error:', e.message); }
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
