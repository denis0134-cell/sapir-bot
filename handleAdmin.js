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
const { extractLeadData, analyzeSalesConversation, writeFollowupMessages, writeCustomFollowup, scoreLeads, adviseDecision, buildSalesScript, writeMarketingAsset } = require('./salesAnalysis');
const { detectSkill, respondWithSkill } = require('./skillRouter');
const { setGoal, getGoalStatus, logIncome, logExpense, addDebt, getFinanceReport,
  logHealth, getHealthReport, addTask, completeTask, delayTask, getTasks, getTaskList,
  getMorningQuestions, getEveningQuestions, saveCheckIn, setPendingCheckin, getPendingCheckin, getTodayCheckIn,
  buildDailyReport, generateWeeklyReport, generateLifeDashboard,
  calculateScores, getScoresText, storeDecision, getDecisions, formatDecisions,
  checkAccountability, createGoal, listGoals, getGoalsText, updateGoal,
  getUserProfile
} = require('./personalData');
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

  // Load Denis's last conversation context (for "him/her/it" references)
  const denisData = getLead(denisPhone) || {};
  const lastCtx = denisData.lastRequest && denisData.lastRequest.length > 80
    ? denisData.lastRequest.substring(0, 900)
    : null;
  const lastCtxSummary = denisData.lastResponse && denisData.lastResponse.length > 40
    ? denisData.lastResponse.substring(0, 300)
    : null;

  // System prompt with conversation memory
  function getSystemWithContext() {
    let sys = getAlonaSystem();
    if (lastCtx) {
      sys += '\n\n═══ הקשר שיחה קודמת ═══\n' + lastCtx +
        '\n\n(כשדניס אומר "איתו"/"איתה"/"הפולואפ"/"השיחה הזו" — זה ההקשר. השתמש בו.)';
    }
    return sys;
  }

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

  // ═══ 3.4 AUTO-DETECT: Long/multiline text = transcription ═══
  // If Denis pastes a raw transcription without trigger words
  const lineCount = t.split('\n').length;
  const looksLikeTranscription = (t.length > 350) ||
    (lineCount > 5 && t.length > 150) ||
    (/[:\u05F4]\s*.{5,}\n/.test(t) && t.length > 100); // "Name: text\n" pattern

  if (looksLikeTranscription) {
    await sendMessage(denisPhone, '⏳ מנתח... (15-30 שניות)');
    try {
      const analysis = await analyzeSalesConversation(t);
      await splitAndSend(denisPhone, analysis);
      upsertLead(denisPhone, { lastRequest: t, lastResponse: analysis });
    } catch (e) { await sendMessage(denisPhone, '❌ ' + e.message); }
    return;
  }

  // ═══ 3.5 PENDING CHECK-IN ANSWER ═══
  // If Denis just received check-in questions and sends numbered answers
  const pendingCheckin = getPendingCheckin();
  if (pendingCheckin && /^\d[.:]/.test(t)) {
    const lines = t.split('\n').map(l => l.replace(/^\d+\.?\s*/, '').trim()).filter(Boolean);
    const checkin = saveCheckIn(pendingCheckin, lines);
    const scores = calculateScores();
    await sendMessage(denisPhone,
      `✅ ${pendingCheckin === 'morning' ? 'בוקר' : 'ערב'} נרשם!\n\n` +
      (pendingCheckin === 'evening'
        ? getScoresText()
        : `🎯 פוקוס: ${checkin.morningFocus || lines[0] || ''}\n\n${generateLifeDashboard()}`)
    );
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
      // Text must be an actual transcription: multiline or very long
      const isRealTranscription = text.length > 300 ||
        (text.split('\n').length > 4 && text.length > 100);
      if (!isRealTranscription) {
        await sendMessage(denisPhone,
          '📋 הדבק את תמלול השיחה ישירות כאן\n\nטקסט מלא — כמה שיותר מדויק = ניתוח טוב יותר');
        break;
      }
      await sendMessage(denisPhone, '⏳ מנתח... (15-30 שניות)');
      try {
        const analysis = await analyzeSalesConversation(text);
        await splitAndSend(denisPhone, analysis);
        // Extract name from analysis for "him/her" references
        const nameMatch = analysis.match(/שם[^:：]*[:：]\s*([^\n]+)/);
        const analyzedName = nameMatch ? nameMatch[1].trim().substring(0, 30) : null;
        upsertLead(denisPhone, {
          lastRequest: text,
          lastResponse: analysis,
          lastAnalyzedName: analyzedName
        });
      } catch (e) { await sendMessage(denisPhone, '❌ ' + e.message); }
      break;
    }

    case 'WRITE_FOLLOWUP': {
      await sendMessage(denisPhone, '⏳ כותבת...');
      try {
        let msg;
        if (params.name) {
          const matches = findLeadsByName(params.name);
          if (matches.length > 0) {
            const lead = matches[0];
            const days = lead.lastMessageAt ? Math.floor((Date.now() - new Date(lead.lastMessageAt)) / 86400000) : 3;
            msg = await writeFollowupMessages(lead, lead.status || 'לא ענה', days);
          } else {
            msg = await writeCustomFollowup(t);
          }
        } else if (lastCtx) {
          // No name given — use last conversation context
          const contextualRequest = t + '\n\n---\nהקשר השיחה שניתחנו:\n' + lastCtx;
          msg = await writeCustomFollowup(contextualRequest);
        } else {
          msg = await writeCustomFollowup(t);
        }
        await sendMessage(denisPhone, msg);
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
      setPendingCheckin('morning');
      await sendMessage(denisPhone, getMorningQuestions());
      break;
    }

    case 'EVENING_CHECKIN': {
      setPendingCheckin('evening');
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
        const decisionQ = (params.question || t) + (lastCtx ? '\n\nהקשר: ' + lastCtx.substring(0, 300) : '');
        await splitAndSend(denisPhone, await adviseDecision(decisionQ));
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

    case 'CREATE_GOAL': {
      const title = params.context || params.question || t.replace(/.*מטרה:?\s*/i,'').trim();
      const goal = createGoal({
        title: title.substring(0, 100),
        category: params.metric || 'business',
        priority: params.priority || 'high',
        successMetric: params.value || '',
        whyItMatters: ''
      });
      await sendMessage(denisPhone, `✅ מטרה נרשמה!\n\n📌 "${goal.title}"\nקטגוריה: ${goal.category}\n\n${getGoalsText()}`);
      break;
    }

    case 'LIST_GOALS': {
      await sendMessage(denisPhone, getGoalsText());
      break;
    }

    case 'STORE_DECISION': {
      const decisionText = params.context || params.question || t;
      await sendMessage(denisPhone, '⏳ רושמת את ההחלטה...');
      try {
        const rec = storeDecision({
          title: decisionText.substring(0, 60),
          category: params.metric || 'business',
          decision: decisionText,
          reasoning: params.value || '',
          risks: [],
          expectedOutcome: ''
        });
        await sendMessage(denisPhone, `✅ ההחלטה נרשמה!\n\n"${rec.decision.substring(0, 100)}"\n\nהחלטות אחרונות:\n${formatDecisions()}`);
      } catch (e) { await sendMessage(denisPhone, '❌ ' + e.message); }
      break;
    }

    case 'LIST_DECISIONS': {
      await sendMessage(denisPhone, formatDecisions());
      break;
    }

    case 'WEEKLY_REPORT': {
      await sendMessage(denisPhone, generateWeeklyReport());
      break;
    }

    case 'LIFE_DASHBOARD': {
      await sendMessage(denisPhone, generateLifeDashboard());
      break;
    }

    case 'SCORE_CHECK': {
      await sendMessage(denisPhone, getScoresText());
      break;
    }

    case 'UPDATE_LEAD_FULL': {
      if (!params.name) { await sendMessage(denisPhone, 'איזה ליד לעדכן?'); break; }
      const matches = findLeadsByName(params.name);
      if (matches.length === 0) { await sendMessage(denisPhone, `❌ לא מצאתי "${params.name}"`); break; }
      const lead = matches[0];
      const updates = {};
      if (params.value && ['cold','warm','hot'].includes(params.value)) updates.temperature = params.value;
      if (params.amount) updates.closingProbability = parseInt(params.amount);
      if (params.context) updates.lastNote = params.context;
      upsertLead(lead.phone, updates);
      upsertLead(denisPhone, { lastDiscussedPhone: lead.phone });
      const updatesSummary = Object.entries(updates).map(([k,v]) => `${k}: ${v}`).join(', ');
      await sendMessage(denisPhone, `✅ עודכן: ${lead.name}\n${updatesSummary}`);
      break;
    }

    case 'SAVE_CHECKIN': {
      const pending = getPendingCheckin();
      if (!pending) {
        await sendMessage(denisPhone, `לא מצאתי שאלות פתוחות. שלח 'צ'ק אין בוקר' או 'צ'ק אין ערב' קודם.`);
        break;
      }
      // Parse numbered answers
      const lines = t.split('\n').map(l => l.replace(/^\d+\.?\s*/, '').trim()).filter(Boolean);
      const checkin = saveCheckIn(pending, lines);
      const scores = calculateScores();
      await sendMessage(denisPhone,
        `✅ ${pending === 'morning' ? 'בוקר' : 'ערב'} נרשם!\n\n` +
        (pending === 'evening'
          ? `📊 ציון היום: ${scores.overall}/100\n${getScoresText()}`
          : `🎯 פוקוס היום: ${checkin.morningFocus || 'לא צוין'}\n\n${generateLifeDashboard()}`)
      );
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

      // General Claude response — with conversation context
      try {
        const response = await claudeCall(getSystemWithContext(), t, 600);
        upsertLead(denisPhone, { lastRequest: t, lastResponse: response });
        await sendMessage(denisPhone, response);
      } catch (e) { await sendMessage(denisPhone, '❌ שגיאה זמנית. נסה שוב.'); }
      break;
    }
  }
}

module.exports = { handleDenisAdmin };
