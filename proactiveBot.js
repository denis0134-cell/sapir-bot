/**
 * proactiveBot.js
 * שולחת תזכורות פולואפ לדניס ב-10:00 בבוקר
 */
const { getLeadsDueToday } = require('./leads');
const { writeFollowupMessages } = require('./salesAnalysis');

let sendMessageFn = null;
let denisPhoneFn = null;

const sentToday = {};
function todayKey(type) {
  return new Date().toISOString().split('T')[0] + '_' + type;
}
function alreadySent(type) { return !!sentToday[todayKey(type)]; }
function markSent(type) { sentToday[todayKey(type)] = true; }

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

  // 10:00 AM — Follow-up reminders (weekdays)
  if (hour === 10 && minute < 6 && day !== 6 && !alreadySent('followup')) {
    markSent('followup');
    try {
      const dueToday = getLeadsDueToday ? getLeadsDueToday() : [];
      if (dueToday.length > 0) {
        const header = '🔔 *פולואפ היום — ' + dueToday.length + ' לידים:*\n\n' +
          dueToday.slice(0, 5).map(function(l) {
            const prob = l.closingProbability;
            const icon = prob >= 70 ? '🔥' : prob >= 50 ? '⚡' : '🟡';
            return icon + ' ' + (l.name || l.phone) + (prob ? ' (' + prob + '%)' : '') + ' — ' + (l.status || 'ממתין');
          }).join('\n');
        await sendMessageFn(phone, header);

        const topLead = dueToday[0];
        if (topLead && topLead.name) {
          const days = topLead.lastMessageAt
            ? Math.floor((Date.now() - new Date(topLead.lastMessageAt)) / 86400000) : 3;
          try {
            const readyMsg = await writeFollowupMessages(topLead, topLead.status || 'follow_up', days);
            await sendMessageFn(phone,
              '✍️ *הודעה מוכנה ל' + topLead.name + ':*\n\n' + readyMsg +
              '\n\n_לשלוח? כתוב: תשלחי_'
            );
          } catch {}
        }
      }
    } catch (e) { console.error('[Proactive] Followup error:', e.message); }
    return;
  }
}

async function sendSequenceMessages() {
  if (!sendMessageFn || !denisPhoneFn) return;
  const DENIS = denisPhoneFn();
  try {
    const { getLeadsWithPendingSequence, updateLeadSequenceMessage } = require('./leads');
    const leads = getLeadsWithPendingSequence ? getLeadsWithPendingSequence() : [];
    for (const lead of leads) {
      const pending = (lead.followupSequence || []).filter(function(m) {
        return !m.sent && !m.stopped && m.scheduledDate <= new Date().toISOString().split('T')[0];
      });
      for (const msg of pending) {
        try {
          await sendMessageFn(lead.phone, msg.message);
          updateLeadSequenceMessage(lead.phone, msg.day, { sent: true, sentAt: new Date().toISOString() });
          await sendMessageFn(DENIS,
            '✅ שלחתי פולואפ ל*' + lead.name + '* (הודעה ' + msg.day + '):\n\n"' +
            msg.message.substring(0, 100) + '"'
          );
          await new Promise(function(r) { setTimeout(r, 2000); });
        } catch (e) { console.error('[Sequence] Send error:', e.message); }
      }
    }
  } catch (e) { console.error('[Sequence] Error:', e.message); }
}

function startProactiveScheduler(sendMsg, getPhone, getFollowups) {
  sendMessageFn = sendMsg;
  denisPhoneFn = getPhone;
  setInterval(checkAndSend, 5 * 60 * 1000);
  setInterval(sendSequenceMessages, 30 * 60 * 1000);
  sendSequenceMessages();
  console.log('[ProactiveBot] Scheduler started — followup reminders at 10:00');
}

module.exports = { startProactiveScheduler };
