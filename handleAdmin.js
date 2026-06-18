/**
 * handleAdmin.js — NLU-based routing v2
 */
const { sendMessage } = require('./whatsapp');
const { getLead, upsertLead, findLeadsByName, getNamedLeads, getLeadsForFollowup } = require('./leads');
const { summarizeFromHistory } = require('./claude');
const { generateAndSendProposal } = require('./proposalHelper');
const { addLesson, removeLesson, getAll, parseLessonFromText, formatMemoryForPrompt, rewriteWithCorrection } = require('./alonaMemory');
const { buildSystemPrompt, addKnowledge, getKnowledge } = require('./alonaContext');
const { detectIntent } = require('./intentDetector');
const { analyzeSalesConversation, writeFollowupMessages, writeCustomFollowup, scoreLeads, adviseDecision, buildSalesScript, writeMarketingAsset } = require('./salesAnalysis');
const { detectSkill, respondWithSkill } = require('./skillRouter');
const { setGoal, getGoalStatus, logIncome, logExpense, addDebt, getFinanceReport, logHealth, getHealthReport, addTask, completeTask, getTasks, getTaskList, getMorningQuestions, getEveningQuestions, buildDailyReport } = require('./personalData');
const axios = require('axios');

const denisPhone = process.env.DENIS_PHONE || '972509698121';

function getAlonaSystem() {
  return buildSystemPrompt() + formatMemoryForPrompt();
}

async function claudeCall(system, userText, maxTokens = 400) {
  const resp = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-6', max_tokens: maxTokens, system,
    messages: [{ role: 'user', content: userText }]
  }, {
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    timeout: 30000
  });
  return resp.data.content[0].text.trim();
}

async function splitAndSend(phone, text) {
  const MAX = 3800;
  if (text.length <= MAX) { await sendMessage(phone, text); return; }
  const chunks = [];
  let rem = text;
  while (rem.length > MAX) {
    let cut = rem.lastIndexOf('\n', MAX);
    if (cut < 1500) cut = MAX;
    chunks.push(rem.substring(0, cut));
    rem = rem.substring(cut).trim();
  }
  if (rem) chunks.push(rem);
  for (const chunk of chunks) {
    await sendMessage(phone, chunk);
    await new Promise(r => setTimeout(r, 600));
  }
}

async function handleDenisAdmin(phone, text) {
  const t = text?.trim();
  if (!t) return;
  console.log(`[Admin] Denis: "${t.substring(0, 60)}"`);

  // ═══ 1. STRUCTURED PIPE COMMANDS ═══
  if (/^הצעה\s*\|/i.test(t)) {
    const parts = t.split('|').map(p => p.trim());
    if (parts.length >= 4) {
      const leadPhone = parts[1].startsWith('972') ? parts[1] : '972' + parts[1].replace(/^0/, '');
      const lead = getLead(leadPhone) || {};
      upsertLead(denisPhone, { lastDiscussedPhone: leadPhone });
      await generateAndSendProposal({ ...lead, phone: leadPhone, program: parts[2].toUpperCase(), price: parts[3].replace(/[^0-9]/g, '') });
      await sendMessage(denisPhone, `✅ הצעה נשלחה ל-${lead.name || leadPhone} — ${parts[2]} ₪${parts[3]}`);
    } else {
      await sendMessage(denisPhone, 'פורמט: הצעה | [נייד] | [ABM/LDB/BOTH] | [מחיר]');
    }
    return;
  }

  if (/^סיכום\s*\|/i.test(t)) {
    const parts = t.split('|').map(p => p.trim());
    const tp = parts[1]?.startsWith('972') ? parts[1] : '972' + (parts[1] || '').replace(/^0/, '');
    const lead = getLead(tp);
    if (lead) {
      upsertLead(denisPhone, { lastDiscussedPhone: tp });
      await sendMessage(denisPhone, await summarizeFromHistory(lead));
    } else {
      await sendMessage(denisPhone, `❌ לא נמצא ליד ${parts[1]}`);
    }
    return;
  }

  if (/^דף נחיתה\s*\|/i.test(t)) {
    const parts = t.split('|').map(p => p.trim());
    const tp = parts[1]?.startsWith('972') ? parts[1] : '972' + (parts[1] || '').replace(/^0/, '');
    const lead = getLead(tp) || {};
    const { deployProposal } = require('./netlify');
    const { generateProposalHTML } = require('./proposal');
    const html = await generateProposalHTML({ ...lead, phone: tp });
    const url = await deployProposal(html, tp);
    if (url) {
      await sendMessage(tp, `📄 הדף שלך:\n${url}`);
      await sendMessage(denisPhone, `✅ דף נחיתה נשלח ל-${lead.name || tp}\n${url}`);
    }
    return;
  }

  // ═══ 2. PHOTO SETUP ═══
  if (/^תמונה\s*\|/i.test(t)) {
    const photoUrl = t.split('|').slice(1).join('|').trim();
    if (!photoUrl.startsWith('http') && !photoUrl.startsWith('data:')) {
      await sendMessage(denisPhone, '❌ שלח URL תמונה.');
      return;
    }
    upsertLead(denisPhone, { myPhotoUrl: photoUrl });
    await sendMessage(denisPhone, '✅ תמונה נשמרה!');
    return;
  }

  // ═══ 3. LEARNING SYSTEM ═══
  if (/^(זכרי ש|שמרי ש|שמרי:|זכרי:|ידע חדש)/i.test(t)) {
    const knowledge = t.replace(/^(זכרי ש|שמרי ש|שמרי:|זכרי:|ידע חדש)\s*/i, '').trim();
    if (knowledge) {
      const total = addKnowledge(knowledge);
      await sendMessage(denisPhone, '🧠 שמרתי!\n"' + knowledge + '"\n\nסה"כ ' + total + ' פריטי ידע.');
    }
    return;
  }

  if (/^(מה יודעת|הראי.*ידע|בסיס ידע)/i.test(t)) {
    const items = getKnowledge();
    await sendMessage(denisPhone, items.length
      ? '🧠 ידע שמור (' + items.length + '):\n\n' + items.map((k, i) => (i + 1) + '. ' + k.text).join('\n')
      : 'עוד אין ידע שמור 📭');
    return;
  }

  if (/^(מה למדת|הראי.*זיכרון)/i.test(t)) {
    const all = getAll();
    await sendMessage(denisPhone, all.length
      ? `📚 ${all.length} שיעורים:\n\n` + all.map((l, i) => `${i + 1}. ${l}`).join('\n')
      : 'עוד לא למדתי כלום 😅');
    return;
  }

  if (/^מחק[יי]?\s+שיעור/i.test(t)) {
    const num = t.match(/\d+/);
    if (num) {
      const removed = removeLesson(num[0]);
      await sendMessage(denisPhone, removed ? '🗑️ מחקתי: "' + removed + '"' : '❌ לא נמצא');
    }
    return;
  }

  if (/^למדי\s*\|/i.test(t)) {
    const lesson = t.split('|').slice(1).join('|').trim();
    if (lesson) {
      const result = addLesson(lesson);
      await sendMessage(denisPhone, '✅ למדתי! (שיעור ' + result.total + ')');
    }
    return;
  }

  if (/זה לא מה שרציתי|לא ביקשתי כזה/i.test(t)) {
    const desired = t.replace(/.*(?:רציתי|ביקשתי).*?[-—]\s*/i, '').trim();
    const denisData = getLead(denisPhone) || {};
    if (desired && denisData.lastRequest) {
      const newResponse = await rewriteWithCorrection(denisData.lastResponse || '', desired, denisData.lastRequest);
      if (newResponse) {
        const lesson = await parseLessonFromText(t);
        if (lesson) addLesson(lesson);
        upsertLead(denisPhone, { lastResponse: newResponse });
        await sendMessage(denisPhone, '🔄 כתבתי מחדש:\n\n' + newResponse);
        return;
      }
    }
  }

  const correctionWords = ['טעית', 'טעות', 'שגית', 'לא הבנת', 'תתקני', 'תתקן', 'בפעם הבאה', 'תכתבי מיד', 'ללא שאלות'];
  if (correctionWords.some(w => t.includes(w))) {
    const lesson = await parseLessonFromText(t);
    if (lesson) {
      const result = addLesson(lesson);
      await sendMessage(denisPhone, '✅ הבנתי!\n\n📝 "' + lesson + '"\n\nלא אחזור על זה. (שיעור ' + result.total + ')');
    } else {
      await sendMessage(denisPhone, 'הסבירי מה הטעות ומה תרצי, ואזכור.');
    }
    return;
  }

  // ═══ 4. NLU ROUTING ═══
  let intentResult;
  try {
    intentResult = await detectIntent(t);
  } catch {
    intentResult = { intent: 'GENERAL_QUESTION', params: {}, confidence: 0.5, clarifyQuestion: null };
  }

  const { intent, params, confidence, clarifyQuestion } = intentResult;

  if (confidence < 0.65 && clarifyQuestion) {
    await sendMessage(denisPhone, clarifyQuestion);
    return;
  }

  switch (intent) {

    case 'SALES_ANALYSIS': {
      const text = params.text || t;
      if (text.length < 40) { await sendMessage(denisPhone, '📋 שלח את תוכן השיחה'); break; }
      await sendMessage(denisPhone, '⏳ מנתח... (15-30 שניות)');
      try {
        const analysis = await analyzeSalesConversation(text);
        await splitAndSend(denisPhone, analysis);
        upsertLead(denisPhone, { lastRequest: text, lastResponse: analysis });
      } catch (e) { await sendMessage(denisPhone, '❌ ' + e.message); }
      break;
    }

    case 'WRITE_FOLLOWUP': {
      await sendMessage(denisPhone, '⏳ כותבת...');
      try {
        const msg = params.name
          ? await (async () => {
              const matches = findLeadsByName(params.name);
              if (matches.length > 0) {
                const lead = matches[0];
                const days = lead.lastMessageAt ? Math.floor((Date.now() - new Date(lead.lastMessageAt)) / 86400000) : 3;
                return writeFollowupMessages(lead, lead.status || 'לא ענה', days);
              }
              return writeCustomFollowup(t);
            })()
          : writeCustomFollowup(t);
        await sendMessage(denisPhone, await msg);
      } catch (e) { await sendMessage(denisPhone, '❌ ' + e.message); }
      break;
    }

    case 'SCORE_LEADS': {
      await sendMessage(denisPhone, '⏳ מדרגת...');
      try {
        const allLeads = getNamedLeads ? getNamedLeads() : [];
        if (!allLeads.length) { await sendMessage(denisPhone, 'אין לידים שמורים 📭'); break; }
        const result = await scoreLeads(allLeads);
        let msg = '🎯 *דירוג לידים:*\n\n';
        (result.leads || []).sort((a, b) => b.score - a.score).slice(0, 8).forEach(l => {
          const icon = l.score >= 80 ? '🔥' : l.score >= 60 ? '⚡' : l.score >= 40 ? '🟡' : '❄️';
          msg += `${icon} ${l.name} — ${l.score}%\n   ${l.action}\n\n`;
        });
        if (result.summary) msg += `📊 ${result.summary}`;
        await sendMessage(denisPhone, msg);
      } catch (e) { await sendMessage(denisPhone, '❌ ' + e.message); }
      break;
    }

    case 'ADD_LEAD_NOTE': {
      if (!params.name) { await sendMessage(denisPhone, 'על איזה ליד?'); break; }
      const matches = findLeadsByName(params.name);
      if (matches.length > 0) {
        const lead = matches[0];
        if (params.context) upsertLead(lead.phone, { lastNote: params.context });
        upsertLead(denisPhone, { lastDiscussedPhone: lead.phone });
        await sendMessage(denisPhone, `✅ עודכן: ${lead.name}`);
      } else {
        await sendMessage(denisPhone, `❌ לא מצאתי "${params.name}"`);
      }
      break;
    }

    case 'FIND_LEAD': {
      const matches = findLeadsByName(params.name || t);
      if (matches.length > 0) {
        upsertLead(denisPhone, { lastDiscussedPhone: matches[0].phone });
        await sendMessage(denisPhone, await summarizeFromHistory(matches[0]));
      } else {
        await sendMessage(denisPhone, `לא מצאתי ליד בשם "${params.name || t}" 🔍`);
      }
      break;
    }

    case 'LOG_INCOME': {
      const amount = params.amount || t.match(/\d+/)?.[0];
      if (!amount) { await sendMessage(denisPhone, 'כמה סגרת?'); break; }
      await sendMessage(denisPhone, logIncome(amount, params.source || 'מכירה'));
      break;
    }

    case 'LOG_EXPENSE': {
      const amount = params.amount || t.match(/\d+/)?.[0];
      if (!amount) { await sendMessage(denisPhone, 'כמה הוצאת?'); break; }
      await sendMessage(denisPhone, logExpense(amount, params.source || params.context || 'לא צוין'));
      break;
    }

    case 'ADD_DEBT': {
      const amount = params.amount || t.match(/\d+/)?.[0];
      if (!amount) { await sendMessage(denisPhone, 'כמה? "חוב [שם] [סכום]"'); break; }
      await sendMessage(denisPhone, addDebt(params.name || 'חוב', amount, 0));
      break;
    }

    case 'FINANCE_REPORT': {
      await sendMessage(denisPhone, getFinanceReport());
      break;
    }

    case 'LOG_HEALTH': {
      if (!params.metric) { await sendMessage(denisPhone, 'מה לרשום? (כושר/משקל/שינה/צעדים/מים/עישון)'); break; }
      await sendMessage(denisPhone, logHealth(params.metric, params.value || params.context || '1'));
      break;
    }

    case 'HEALTH_REPORT': {
      await sendMessage(denisPhone, getHealthReport());
      break;
    }

    case 'ADD_TASK': {
      const taskText = params.taskText || params.context || t;
      addTask(taskText, params.priority || 'normal');
      await sendMessage(denisPhone, `${params.priority === 'high' ? '🔴' : '📋'} נוספה: "${taskText}"\n\n${getTaskList()}`);
      break;
    }

    case 'TASK_DONE': {
      const id = params.value || t.match(/\d+/)?.[0];
      if (id) {
        const taskText = completeTask(id);
        await sendMessage(denisPhone, taskText ? `✅ "${taskText}" הושלמה!\n\n${getTaskList()}` : `❌ משימה ${id} לא נמצאה`);
      } else {
        const tasks = getTasks(true);
        const match = tasks.find(task => t.toLowerCase().includes(task.text.substring(0, 8).toLowerCase()));
        if (match) {
          completeTask(match.id);
          await sendMessage(denisPhone, `✅ "${match.text}" הושלמה!\n\n${getTaskList()}`);
        } else {
          await sendMessage(denisPhone, `איזו משימה?\n\n${getTaskList()}`);
        }
      }
      break;
    }

    case 'TASK_LIST': {
      await sendMessage(denisPhone, getTaskList());
      break;
    }

    case 'SET_GOAL': {
      const amount = params.amount || t.match(/\d+/)?.[0];
      if (!amount) { await sendMessage(denisPhone, 'מה היעד?'); break; }
      setGoal('monthly', params.metric || 'income', amount);
      await sendMessage(denisPhone, `✅ יעד נשמר!\n\n${getGoalStatus()}`);
      break;
    }

    case 'GOAL_STATUS': {
      await sendMessage(denisPhone, getGoalStatus());
      break;
    }

    case 'MORNING_CHECKIN': {
      await sendMessage(denisPhone, getMorningQuestions());
      break;
    }

    case 'EVENING_CHECKIN': {
      await sendMessage(denisPhone, getEveningQuestions());
      break;
    }

    case 'DAILY_REPORT': {
      await sendMessage(denisPhone, buildDailyReport() + '\n\n' + getGoalStatus());
      break;
    }

    case 'DECISION_ADVICE': {
      await sendMessage(denisPhone, '⏳ חושבת...');
      try {
        await splitAndSend(denisPhone, await adviseDecision(params.question || t));
      } catch (e) { await sendMessage(denisPhone, '❌ ' + e.message); }
      break;
    }

    case 'BUILD_SCRIPT': {
      await sendMessage(denisPhone, '⏳ בונה תסריט...');
      try {
        await splitAndSend(denisPhone, await buildSalesScript(params.context || t));
      } catch (e) { await sendMessage(denisPhone, '❌ ' + e.message); }
      break;
    }

    case 'SEND_FORM': {
      await sendMessage(denisPhone, '⏳ מכין טופס...');
      try {
        const fs = require('fs'), path = require('path'), axiosLib = require('axios'), crypto = require('crypto');
        const formPath = path.join(__dirname, 'client-form.html');
        const htmlBytes = fs.readFileSync(formPath);
        const sha1 = crypto.createHash('sha1').update(htmlBytes).digest('hex');
        const token = process.env.NETLIFY_TOKEN;
        const siteName = 'sapir-client-form';
        let siteId;
        try {
          const ex = await axiosLib.get('https://api.netlify.com/api/v1/sites?filter=owner', { headers: { Authorization: 'Bearer ' + token } });
          const found = ex.data.find(s => s.name === siteName);
          siteId = found?.id;
        } catch {}
        if (!siteId) {
          const sr = await axiosLib.post('https://api.netlify.com/api/v1/sites', { name: siteName }, { headers: { Authorization: 'Bearer ' + token } });
          siteId = sr.data.id;
        }
        const dr = await axiosLib.post(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, { files: { '/index.html': sha1 } }, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } });
        await axiosLib.put(`https://api.netlify.com/api/v1/deploys/${dr.data.id}/files/index.html`, htmlBytes, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/octet-stream' }, maxBodyLength: Infinity });
        await sendMessage(denisPhone, `📋 הטופס:\n\nhttps://${siteName}.netlify.app\n\nמלא ← לחץ "שלח לבוט" ← אני אבנה הצעה ⚡`);
      } catch (e) { await sendMessage(denisPhone, '❌ ' + e.message); }
      break;
    }

    case 'WRITE_CONTENT': {
      try {
        const content = await writeMarketingAsset(params.contentType || 'whatsapp', params.context || t);
        upsertLead(denisPhone, { lastRequest: t, lastResponse: content });
        await sendMessage(denisPhone, content);
      } catch (e) { await sendMessage(denisPhone, '❌ ' + e.message); }
      break;
    }

    default: {
      // Try skills for marketing tasks
      const textClean = t.replace(/^אלונה[,،\s]*/i, '').trim();
      const skill = detectSkill(textClean);
      if (skill) {
        try {
          const skillResponse = await respondWithSkill(textClean, skill);
          if (skillResponse?.length > 20) {
            upsertLead(denisPhone, { lastRequest: t, lastResponse: skillResponse });
            await sendMessage(denisPhone, skillResponse);
            return;
          }
        } catch {}
      }

      // Short text = lead name lookup
      if (t.length < 30) {
        const matches = findLeadsByName(t);
        if (matches.length > 0) {
          upsertLead(denisPhone, { lastDiscussedPhone: matches[0].phone });
          await sendMessage(denisPhone, await summarizeFromHistory(matches[0]));
          return;
        }
      }

      // General Claude response
      try {
        const response = await claudeCall(getAlonaSystem(), t, 500);
        upsertLead(denisPhone, { lastRequest: t, lastResponse: response });
        await sendMessage(denisPhone, response);
      } catch (e) { await sendMessage(denisPhone, '❌ שגיאה זמנית. נסה שוב.'); }
      break;
    }
  }
}

module.exports = { handleDenisAdmin };
