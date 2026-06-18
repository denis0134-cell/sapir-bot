const { sendMessage } = require('./whatsapp');
const { getLead, upsertLead, findLeadsByName, getNamedLeads, getLeadsForFollowup } = require('./leads');
const { summarizeClient, summarizeFromHistory } = require('./claude');
const { generateAndSendProposal } = require('./proposalHelper');
const { detectAdminIntent } = require('./adminIntent');
const { detectSkill, respondWithSkill } = require('./skillRouter');
const { addLesson, removeLesson, getAll, parseLessonFromText, formatMemoryForPrompt, rewriteWithCorrection } = require('./alonaMemory');
const { buildSystemPrompt, addKnowledge, getKnowledge, loadContext } = require('./alonaContext');
const {
  analyzeSalesConversation, writeFollowupMessages, writeCustomFollowup,
  scoreLeads, adviseDecision, buildSalesScript
} = require('./salesAnalysis');
const {
  setGoal, getGoalStatus,
  logIncome, logExpense, addDebt, getFinanceReport,
  logHealth, getHealthReport,
  addTask, completeTask, getTaskList,
  getMorningQuestions, getEveningQuestions, buildDailyReport
} = require('./personalData');
const axios = require('axios');

const DENIS_PHONE = process.env.DENIS_PHONE || '972509698121';
// Dynamic system prompt built from context + memory
function getAlonaSystem() {
  const ctx = buildSystemPrompt();
  const mem = formatMemoryForPrompt();
  return ctx + mem;
}

// ── Claude API call helper ──
async function claudeCall(system, userText, maxTokens = 300) {
  const resp = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userText }]
  }, {
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }
  });
  return resp.data.content[0].text.trim();
}

// ── Main handler ──
async function handleDenisAdmin(denisPhone, text) {
  const t = text.trim();

  // ═══════════════════════════════════════════
  // 1. STRUCTURED COMMANDS (pipe-separated)
  // ═══════════════════════════════════════════
  const parts = t.split('|').map(p => p.trim());

  // הצעה | phone | program | price
  if (parts[0] === 'הצעה' && parts.length >= 4) {
    const extras = {};
    parts.slice(4).forEach(p => {
      const [k, ...v] = p.split('=');
      if (k && v.length) extras[k.trim()] = v.join('=').trim();
    });
    upsertLead(parts[1], {
      name: extras.name, profession: extras.prof,
      currentRevenue: extras.rev, targetRevenue: extras.target,
      goal: extras.goal, socialUrl: extras.social,
      lastMessageAt: new Date().toISOString()
    });
    try {
      const url = await generateAndSendProposal(parts[1], parts[2].toUpperCase(), parts[3]);
      await sendMessage(denisPhone, `✅ הצעה נשלחה ל-${parts[1]}\n${url}`);
    } catch (e) { await sendMessage(denisPhone, `❌ שגיאה: ${e.message}`); }
    return;
  }

  // סיכום | phone
  if (parts[0] === 'סיכום' && parts.length === 2) {
    const lead = getLead(parts[1]);
    if (!lead) { await sendMessage(denisPhone, `❌ לא נמצא ${parts[1]}`); return; }
    upsertLead(denisPhone, { lastDiscussedPhone: lead.phone });
    await sendMessage(denisPhone, await summarizeFromHistory(lead));
    return;
  }

  // דף נחיתה | phone | name | ...
  if (parts[0] === 'דף נחיתה' && parts.length >= 3) {
    const extras = {};
    parts.slice(3).forEach(p => {
      const [k, ...v] = p.split('=');
      if (k && v.length) extras[k.trim()] = v.join('=').trim();
    });
    await sendMessage(denisPhone, '⏳ בונה דף נחיתה... (30-60 שניות)');
    try {
      const { generateLandingPage } = require('./landingPageBuilder');
      const { deployProposal } = require('./netlify');
      const html = await generateLandingPage({ businessName: parts[2], phone: parts[1], ...extras });
      const url = await deployProposal(html, parts[2]);
      await sendMessage(denisPhone, `✅ דף נחיתה מוכן!\n${url}`);
    } catch (e) { await sendMessage(denisPhone, `❌ ${e.message}`); }
    return;
  }

  // ═══════════════════════════════════════════
  // 2. PHOTO & SETUP COMMANDS
  // ═══════════════════════════════════════════
  if (/^(תמונה|עדכן תמונה|תמונה שלי)/i.test(t) && t.includes('|')) {
    const photoUrl = t.split('|').slice(1).join('|').trim();
    if (!photoUrl.startsWith('http') && !photoUrl.startsWith('data:')) {
      await sendMessage(denisPhone, '❌ שלח URL תמונה. דוגמה: תמונה | https://...');
      return;
    }
    upsertLead(denisPhone, { myPhotoUrl: photoUrl });
    await sendMessage(denisPhone, '✅ תמונה נשמרה! תופיע בכל הצעה 📸');
    return;
  }

  // ═══════════════════════════════════════════
  // 2b. SALES CONVERSATION ANALYSIS
  // ═══════════════════════════════════════════
  if (/^ניתוח שיחה|^נתחי|^ניתוח:/i.test(t) || /^ניתוח \|/i.test(t)) {
    const text = t.replace(/^(ניתוח שיחה|נתחי|ניתוח[:\s]\|?\s*)/i, '').trim();
    if (text.length < 30) {
      await sendMessage(denisPhone, '📋 שלח את השיחה לניתוח (תמלול או תיאור מפורט)\n\nפורמט:\nניתוח שיחה\n[תוכן השיחה]');
      return;
    }
    await sendMessage(denisPhone, '⏳ מנתח את השיחה... (15-30 שניות)');
    try {
      const analysis = await analyzeSalesConversation(text);
      // Split long analysis into chunks (WhatsApp 4096 char limit)
      const chunks = [];
      let remaining = analysis;
      while (remaining.length > 3800) {
        let cutPoint = remaining.lastIndexOf('\n', 3800);
        if (cutPoint < 2000) cutPoint = 3800;
        chunks.push(remaining.substring(0, cutPoint));
        remaining = remaining.substring(cutPoint).trim();
      }
      if (remaining) chunks.push(remaining);
      for (const chunk of chunks) {
        await sendMessage(denisPhone, chunk);
        await new Promise(r => setTimeout(r, 500));
      }
      upsertLead(denisPhone, { lastRequest: text, lastResponse: analysis });
    } catch (e) {
      await sendMessage(denisPhone, '❌ שגיאה בניתוח: ' + e.message);
    }
    return;
  }

  // ═══════════════════════════════════════════
  // 2c. SMART FOLLOW-UP WRITER
  // ═══════════════════════════════════════════
  if (/^פולואפ ל|^כתבי פולואפ|^הודעת פולואפ|^פולואפ \|/i.test(t)) {
    const raw = t.replace(/^(פולואפ ל|כתבי פולואפ|הודעת פולואפ|פולואפ \|)\s*/i, '').trim();
    await sendMessage(denisPhone, '⏳ כותבת פולואפ...');
    try {
      // Try to find lead by name or phone
      const matches = findLeadsByName(raw);
      let leadInfo = {};
      let status = raw;
      if (matches.length > 0) {
        leadInfo = matches[0];
        const days = leadInfo.lastMessageAt
          ? Math.floor((Date.now() - new Date(leadInfo.lastMessageAt)) / 86400000)
          : 3;
        status = leadInfo.status || 'לא ענה';
        const msg = await writeFollowupMessages(leadInfo, status, days);
        await sendMessage(denisPhone, msg);
      } else {
        // Free-text context
        const msg = await writeCustomFollowup(raw);
        await sendMessage(denisPhone, msg);
      }
    } catch (e) {
      await sendMessage(denisPhone, '❌ שגיאה: ' + e.message);
    }
    return;
  }

  // ═══════════════════════════════════════════
  // 2d. LEAD SCORING / PRIORITIES
  // ═══════════════════════════════════════════
  if (/^דרגי לידים|^ציון לידים|^מי הכי חם|^עדיפויות לידים|^סדר לידים/i.test(t)) {
    await sendMessage(denisPhone, '⏳ מנתח לידים...');
    try {
      const allLeads = getNamedLeads ? getNamedLeads() : [];
      if (allLeads.length === 0) {
        await sendMessage(denisPhone, 'עוד אין לידים שמורים במערכת 📭');
        return;
      }
      const result = await scoreLeads(allLeads);
      let msg = '🎯 *דירוג לידים:*\n\n';
      const sorted = (result.leads || []).sort((a, b) => b.score - a.score);
      sorted.slice(0, 8).forEach((l, i) => {
        const icon = l.score >= 80 ? '🔥' : l.score >= 60 ? '⚡' : l.score >= 40 ? '🟡' : '❄️';
        msg += `${icon} ${l.name} — ${l.score}%\n`;
        msg += `   פעולה: ${l.action}\n\n`;
      });
      if (result.summary) msg += `\n📊 ${result.summary}`;
      await sendMessage(denisPhone, msg);
    } catch (e) {
      await sendMessage(denisPhone, '❌ שגיאה: ' + e.message);
    }
    return;
  }

  // ═══════════════════════════════════════════
  // 2e. GOALS & TARGETS
  // ═══════════════════════════════════════════
  if (/^יעד |^יעד\|/i.test(t)) {
    const parts = t.split('|').map(p => p.trim());
    // יעד | חודשי | הכנסה | 30000
    if (parts.length >= 4) {
      const result = setGoal(parts[1], parts[2], parts[3]);
      await sendMessage(denisPhone, `✅ יעד נשמר: ${parts[1]} ${parts[2]} = ${parts[3]}\n\n${getGoalStatus()}`);
    } else if (parts.length >= 3) {
      // יעד | הכנסה | 30000
      const result = setGoal('monthly', parts[1], parts[2]);
      await sendMessage(denisPhone, `✅ יעד חודשי: ${parts[1]} = ${parts[2]}\n\n${getGoalStatus()}`);
    } else {
      await sendMessage(denisPhone, getGoalStatus());
    }
    return;
  }

  if (/^מצב יעדים|^יעדים|^מצב שלי$/i.test(t)) {
    await sendMessage(denisPhone, getGoalStatus());
    return;
  }

  // ═══════════════════════════════════════════
  // 2f. FINANCE TRACKING
  // ═══════════════════════════════════════════
  if (/^הכנסה \||^רשום הכנסה/i.test(t)) {
    const parts = t.split('|').map(p => p.trim());
    const amount = parts[1]?.replace(/[^0-9]/g, '');
    const source = parts[2] || 'לא צוין';
    if (!amount) { await sendMessage(denisPhone, 'פורמט: הכנסה | [סכום] | [מקור]'); return; }
    await sendMessage(denisPhone, logIncome(amount, source, 'sale'));
    return;
  }

  if (/^הוצאה \||^רשום הוצאה/i.test(t)) {
    const parts = t.split('|').map(p => p.trim());
    const amount = parts[1]?.replace(/[^0-9]/g, '');
    const desc = parts[2] || 'לא צוין';
    if (!amount) { await sendMessage(denisPhone, 'פורמט: הוצאה | [סכום] | [תיאור]'); return; }
    await sendMessage(denisPhone, logExpense(amount, desc));
    return;
  }

  if (/^חוב \||^הוסף חוב/i.test(t)) {
    const parts = t.split('|').map(p => p.trim());
    if (parts.length < 3) { await sendMessage(denisPhone, 'פורמט: חוב | [שם] | [סכום] | [תשלום חודשי אופציונלי]'); return; }
    await sendMessage(denisPhone, addDebt(parts[1], parts[2], parts[3] || 0));
    return;
  }

  if (/^דוח כסף|^מצב כסף|^כסף שלי|^הכנסות החודש/i.test(t)) {
    await sendMessage(denisPhone, getFinanceReport());
    return;
  }

  // ═══════════════════════════════════════════
  // 2g. HEALTH TRACKING
  // ═══════════════════════════════════════════
  if (/^כושר \||^אימון \|/i.test(t)) {
    const desc = t.split('|').slice(1).join('|').trim();
    await sendMessage(denisPhone, logHealth('workout', desc));
    return;
  }

  if (/^משקל \||^שקילה \|/i.test(t)) {
    const val = t.split('|')[1]?.trim().replace(/[^0-9.]/g, '');
    if (!val) { await sendMessage(denisPhone, 'פורמט: משקל | [מספר]'); return; }
    await sendMessage(denisPhone, logHealth('weight', val));
    return;
  }

  if (/^שינה \|/i.test(t)) {
    const hours = t.split('|')[1]?.trim().replace(/[^0-9.]/g, '');
    await sendMessage(denisPhone, logHealth('sleep', hours));
    return;
  }

  if (/^צעדים \|/i.test(t)) {
    const steps = t.split('|')[1]?.trim().replace(/[^0-9]/g, '');
    await sendMessage(denisPhone, logHealth('steps', steps));
    return;
  }

  if (/^מים \|/i.test(t)) {
    const glasses = t.split('|')[1]?.trim().replace(/[^0-9]/g, '');
    await sendMessage(denisPhone, logHealth('water', glasses));
    return;
  }

  if (/^עישון \|/i.test(t)) {
    const cigs = t.split('|')[1]?.trim().replace(/[^0-9]/g, '');
    await sendMessage(denisPhone, logHealth('smoking', cigs));
    return;
  }

  if (/^בריאות שלי|^דוח בריאות|^כושר שלי/i.test(t)) {
    await sendMessage(denisPhone, getHealthReport());
    return;
  }

  // ═══════════════════════════════════════════
  // 2h. TASK MANAGEMENT
  // ═══════════════════════════════════════════
  if (/^משימה \||^לא לשכוח \||^תזכורת \|/i.test(t)) {
    const parts = t.split('|').map(p => p.trim());
    const text = parts[1];
    const priority = /דחוף|חשוב|urgent|high/i.test(parts[2] || '') ? 'high' : 'normal';
    if (!text) { await sendMessage(denisPhone, 'פורמט: משימה | [טקסט] | [דחוף/רגיל]'); return; }
    const id = addTask(text, priority);
    await sendMessage(denisPhone, `✅ משימה ${id} נוספה: ${text}\n\n${getTaskList()}`);
    return;
  }

  if (/^סיים משימה \||^משימה בוצעה \||^בוצע \|/i.test(t)) {
    const id = t.split('|')[1]?.trim();
    const taskText = completeTask(id);
    if (taskText) {
      await sendMessage(denisPhone, `✅ "${taskText}" הושלמה!\n\n${getTaskList()}`);
    } else {
      await sendMessage(denisPhone, `❌ משימה ${id} לא נמצאה\n\n${getTaskList()}`);
    }
    return;
  }

  if (/^משימות|^רשימת משימות|^מה יש לי לעשות/i.test(t)) {
    await sendMessage(denisPhone, getTaskList());
    return;
  }

  // ═══════════════════════════════════════════
  // 2i. DAILY CHECK-INS
  // ═══════════════════════════════════════════
  if (/^צ'?ק אין בוקר|^בוקר טוב|^התחלת יום|^שאלות בוקר/i.test(t)) {
    await sendMessage(denisPhone, getMorningQuestions());
    return;
  }

  if (/^צ'?ק אין ערב|^סיכום יום|^דוח יום|^שאלות ערב|^ערב טוב/i.test(t)) {
    await sendMessage(denisPhone, getEveningQuestions());
    return;
  }

  if (/^דוח מלא|^סיכום מלא|^מצב כולל/i.test(t)) {
    const report = buildDailyReport();
    const goals = getGoalStatus();
    await sendMessage(denisPhone, report + '\n' + goals);
    return;
  }

  // ═══════════════════════════════════════════
  // 2j. DECISION ADVISOR
  // ═══════════════════════════════════════════
  if (/^עזרה בהחלטה|^תייעצי|^האם כדאי|^שאלה עסקית|^תחשבי על/i.test(t)) {
    const question = t.replace(/^(עזרה בהחלטה|תייעצי|האם כדאי|שאלה עסקית|תחשבי על)\s*/i, '').trim();
    if (question.length < 10) {
      await sendMessage(denisPhone, 'מה ההחלטה? כתוב יותר פרטים...');
      return;
    }
    await sendMessage(denisPhone, '⏳ חושבת...');
    try {
      const advice = await adviseDecision(question);
      await sendMessage(denisPhone, advice);
    } catch (e) {
      await sendMessage(denisPhone, '❌ שגיאה: ' + e.message);
    }
    return;
  }

  // ═══════════════════════════════════════════
  // 2k. SALES SCRIPT BUILDER
  // ═══════════════════════════════════════════
  if (/^תסריט שיחה|^בני תסריט|^תבני תסריט/i.test(t)) {
    const context = t.replace(/^(תסריט שיחה|בני תסריט|תבני תסריט)\s*/i, '').trim();
    await sendMessage(denisPhone, '⏳ בונה תסריט...');
    try {
      const script = await buildSalesScript(context || 'תסריט מכירה כללי לתוכניות ספיר זיסמן');
      const chunks = [];
      let rem = script;
      while (rem.length > 3800) {
        let cut = rem.lastIndexOf('\n', 3800);
        if (cut < 2000) cut = 3800;
        chunks.push(rem.substring(0, cut));
        rem = rem.substring(cut).trim();
      }
      if (rem) chunks.push(rem);
      for (const chunk of chunks) {
        await sendMessage(denisPhone, chunk);
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      await sendMessage(denisPhone, '❌ שגיאה: ' + e.message);
    }
    return;
  }

  // ═══════════════════════════════════════════
  // 2l. LEAD QUICK NOTE (after sales call)
  // ═══════════════════════════════════════════
  if (/^אחרי שיחה \||^שיחה עם \||^עדכון ליד \|/i.test(t)) {
    const parts = t.split('|').map(p => p.trim());
    // אחרי שיחה | שם | כאב | מטרה | התנגדות | פולואפ
    if (parts.length >= 3) {
      const nameOrPhone = parts[1];
      const matches = findLeadsByName(nameOrPhone);
      const lead = matches.length > 0 ? matches[0] : getLead(nameOrPhone);
      if (!lead) {
        await sendMessage(denisPhone, `❌ ליד "${nameOrPhone}" לא נמצא. צור כרטיס קודם.`);
        return;
      }
      const updates = {};
      if (parts[2]) updates.lastNote = parts[2];
      if (parts[3]) updates.goal = parts[3];
      if (parts[4]) updates.lastObjection = parts[4];
      if (parts[5]) updates.nextFollowup = parts[5];
      upsertLead(lead.phone, updates);
      upsertLead(denisPhone, { lastDiscussedPhone: lead.phone });
      await sendMessage(denisPhone, `✅ עודכן עבור ${lead.name || nameOrPhone}:\n${JSON.stringify(updates, null, 2).replace(/[{}"]/g,'').trim()}`);
    } else {
      await sendMessage(denisPhone, 'פורמט: אחרי שיחה | [שם] | [כאב] | [מטרה] | [התנגדות] | [פולואפ]');
    }
    return;
  }

  // ═══════════════════════════════════════════
  // 3a. SKILL-BASED TASK DETECTION (PRIORITY — runs BEFORE form to prevent routing bugs)
  // ═══════════════════════════════════════════
  // Remove "אלונה" prefix if present (calling by name before a task)
  const textWithoutName = t.replace(/^אלונה[,،\s]*/i, '').trim();
  const textToAnalyze = textWithoutName || t;

  // Check if it's a task request (contains action verb)
  const taskVerbs = ['תכתב', 'תכתבי', 'כתב', 'כתבי', 'תייצר', 'צור', 'צרי', 'תיצור', 'עזר', 'עזרי',
    'תעזר', 'תעזרי', 'בנה', 'בני', 'תבנה', 'תבני', 'תספר', 'ספר', 'תציע', 'הצע',
    'תכין', 'תכיני', 'הכן', 'הכיני', 'תשלח', 'שלח', 'תנסח', 'נסח', 'תמליץ', 'המלץ',
    'תסביר', 'הסבר', 'תנתח', 'נתח', 'תחשוב', 'חשוב', 'תציג', 'הצג'];

  const hasTaskVerb = taskVerbs.some(v => textToAnalyze.startsWith(v) || textToAnalyze.includes(' ' + v + ' '));
  const detectedSkill = detectSkill(textToAnalyze) || detectSkill(t);

  if (detectedSkill) {
    console.log(`[Admin] Skill detected: ${detectedSkill} for: "${textToAnalyze.substring(0, 40)}"`);
    try {
      const skillResponse = await respondWithSkill(textToAnalyze, detectedSkill);
      if (skillResponse && skillResponse.length > 20) {
        upsertLead(denisPhone, { lastRequest: textToAnalyze, lastResponse: skillResponse });
        await sendMessage(denisPhone, skillResponse);
        return;
      }
    } catch (skillErr) { console.error('[Skill] Error:', skillErr.message); }
  }

  // ═══════════════════════════════════════════
  // 3b. FORM COMMAND (only reached if no skill was detected above)
  // ═══════════════════════════════════════════
  if (/טופס|שלח.*טופס|form/i.test(t)) {
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
        const existing = await axiosLib.get('https://api.netlify.com/api/v1/sites?filter=owner', {
          headers: { Authorization: 'Bearer ' + token }
        });
        const found = existing.data.find(s => s.name === siteName);
        siteId = found ? found.id : null;
      } catch {}
      if (!siteId) {
        const siteRes = await axiosLib.post('https://api.netlify.com/api/v1/sites', { name: siteName }, {
          headers: { Authorization: 'Bearer ' + token }
        });
        siteId = siteRes.data.id;
      }
      const deployRes = await axiosLib.post(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
        { files: { '/index.html': sha1 } },
        { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } });
      await axiosLib.put(`https://api.netlify.com/api/v1/deploys/${deployRes.data.id}/files/index.html`,
        htmlBytes, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/octet-stream' }, maxBodyLength: Infinity });
      const formUrl = `https://${siteName}.netlify.app`;
      await sendMessage(denisPhone, `📋 הנה הטופס:\n\n${formUrl}\n\nמלא ← לחץ "שלח לבוט" ← הבוט יבנה הצעה ⚡`);
    } catch (e) { await sendMessage(denisPhone, `❌ שגיאה: ${e.message}`); }
    return;
  }

  // ═══════════════════════════════════════════
  // 3.5 ALONA LEARNING SYSTEM
  // ═══════════════════════════════════════════

  // ADD KNOWLEDGE (זכרי שאנחנו...)
  if (/^(זכרי ש|שמרי ש|שמרי:|זכרי:|ידע חדש|הוסיפי לידע)/i.test(t)) {
    const knowledge = t.replace(/^(זכרי ש|שמרי ש|שמרי:|זכרי:|ידע חדש|הוסיפי לידע)\s*/i, '').trim();
    if (knowledge) {
      const total = addKnowledge(knowledge);
      await sendMessage(denisPhone, '🧠 שמרתי!\n"' + knowledge + '"\n\nסה"כ ' + total + ' פריטי ידע.');
    }
    return;
  }

  // SHOW KNOWLEDGE BASE
  if (/^(מה יודעת|מה אני יודעת|הראי.*ידע|בסיס ידע|show.*knowledge)/i.test(t)) {
    const items = getKnowledge();
    if (!items.length) {
      await sendMessage(denisPhone, 'עוד אין ידע שמור 📭\nאמור: "זכרי ש..." כדי ללמד אותי');
    } else {
      await sendMessage(denisPhone, '🧠 ידע שמור (' + items.length + '):\n\n' + items.map((k,i) => (i+1)+'. '+k.text).join('\n'));
    }
    return;
  }

  // VIEW MEMORY
  if (/^(מה למדת|מה אתה זוכרת|הראי.*זיכרון|זיכרון שלך|כמה שיעורים)/i.test(t)) {
    const all = getAll();
    if (!all.length) {
      await sendMessage(denisPhone, 'עוד לא למדתי כלום 😅\nתגיד לי מה לשפר!');
    } else {
      const list = all.map((l, i) => `${i+1}. ${l}`).join('\n');
      await sendMessage(denisPhone, `📚 למדתי ${all.length} שיעורים:\n\n${list}`);
    }
    return;
  }

  // DELETE LESSON
  if (/^מחק.*שיעור|^מחקי.*שיעור/i.test(t)) {
    const numMatch = t.match(/\d+/);
    if (numMatch) {
      const removed = removeLesson(numMatch[0]);
      await sendMessage(denisPhone, removed
        ? '🗑️ מחקתי: "' + removed + '"'
        : '❌ לא מצאתי שיעור במספר הזה');
    } else {
      await sendMessage(denisPhone, 'כתוב: מחקי שיעור | [מספר]');
    }
    return;
  }

  // TEACH DIRECTLY: למדי | [כלל]
  if (/^למדי\s*\|/i.test(t)) {
    const lesson = t.split('|').slice(1).join('|').trim();
    if (lesson) {
      const result = addLesson(lesson);
      await sendMessage(denisPhone, '✅ למדתי ושמרתי!\n\n📝 "' + lesson + '"\n\nסה"כ ' + result.total + ' שיעורים בזיכרון.');
    } else {
      await sendMessage(denisPhone, 'כתוב: למדי | [מה ללמוד]');
    }
    return;
  }

  // CORRECTION + REWRITE: זה לא מה שרציתי — [מה רצית]
  if (/זה לא מה שרציתי|לא ביקשתי כזה|לא זה מה שביקשתי/i.test(t)) {
    const desired = t.replace(/.*(?:רציתי|ביקשתי).*?[-—]\s*/i, '').trim();
    const denisData = getLead(denisPhone) || {};
    const lastContext = denisData.lastRequest || '';
    const lastResponse = denisData.lastResponse || '';
    if (desired && lastContext) {
      const newResponse = await rewriteWithCorrection(lastResponse, desired, lastContext);
      if (newResponse) {
        const lesson = await parseLessonFromText(t);
        if (lesson) addLesson(lesson);
        upsertLead(denisPhone, { lastResponse: newResponse });
        await sendMessage(denisPhone, '🔄 כתבתי מחדש:\n\n' + newResponse);
        if (lesson) await sendMessage(denisPhone, '\n📝 למדתי: "' + lesson + '"');
        return;
      }
    }
  }

  // GENERAL CORRECTION
  const correctionWords = ['טעית', 'טעות', 'שגית', 'לא הבנת', 'תתקני', 'תתקן', 'בפעם הבאה', 'אל תשאל', 'אל תשאלי', 'תכתב מיד', 'תכתבי מיד', 'ללא שאלות'];
  if (correctionWords.some(w => t.includes(w))) {
    const lesson = await parseLessonFromText(t);
    if (lesson) {
      const result = addLesson(lesson);
      await sendMessage(denisPhone, '✅ הבנתי ולמדתי!\n\n📝 "' + lesson + '"\n\nלא אחזור על זה. (שיעור ' + result.total + ')');
    } else {
      await sendMessage(denisPhone, 'מצטערת 😔 הסבירי לי בדיוק מה הטעות ומה תרצה, ואזכור.');
    }
    return;
  }

  // ═══════════════════════════════════════════
  // 5. CLIENT OPERATIONS (lookup, update, summarize)
  // ═══════════════════════════════════════════
  const denisData = getLead(denisPhone) || {};
  const lastPhone = denisData.lastDiscussedPhone;

  // Update last client (add phone/info)
  const isUpdate = /^(תוסיפ|עדכנ|הוסיפ)/i.test(textToAnalyze);
  if (isUpdate) {
    const targetPhone = lastPhone;
    const phoneMatch = textToAnalyze.match(/0[5][0-9]{8}/);
    if (phoneMatch && targetPhone) {
      const newPhone = '972' + phoneMatch[0].slice(1);
      upsertLead(targetPhone, { phone: newPhone });
      await sendMessage(denisPhone, `✅ עודכן: 📱 ${newPhone}`);
      return;
    }
  }

  // Client name lookup
  const namedLeads = getNamedLeads();
  if (textToAnalyze.length < 40 && !hasTaskVerb) {
    const nameToSearch = textToAnalyze.replace(/^(מה עם|מה קורה עם|תסכמ|סכמ|תן לי|מידע על)\s*/i, '').trim();
    if (nameToSearch.length >= 2) {
      const matches = findLeadsByName(nameToSearch);
      if (matches.length > 0) {
        const lead = matches[0];
        upsertLead(denisPhone, { lastDiscussedPhone: lead.phone });
        const summary = await summarizeFromHistory(lead);
        await sendMessage(denisPhone, summary);
        return;
      }
    }
  }

  // Long text = new client summary
  if (t.length > 70 && !hasTaskVerb) {
    const summary = await summarizeClient(t);
    await sendMessage(denisPhone, summary);
    return;
  }

  // Natural language proposal request
  if (/הצע|proposal|לשלוח הצעה|תבנה הצעה/i.test(textToAnalyze)) {
    await sendMessage(denisPhone,
      'כדי לבנות הצעה שלח פרטי הלקוח:\n\nשם:\nעסק:\nנייד:\nמטרה:\nמחיר שדיברנו:\n\nאו: הצעה | נייד | מסלול | מחיר'
    );
    return;
  }

  // ═══════════════════════════════════════════
  // 6. LAUGHTER & JOKES
  // ═══════════════════════════════════════════
  if (/^[ח]{2,}$|^(ha){2,}|^lol$|^haha|^😂|^🤣/i.test(t)) {
    const reactions = [
      'חחח גם אני 😂 רוצה עוד בדיחה?',
      'אאאא הצלחתי! 🎉 עוד אחת?',
      'זו הייתה הטובה שלי 😏 יש לי עוד...',
      'שמחה שצחקת! 😄 רוצה עוד?'
    ];
    await sendMessage(denisPhone, reactions[Math.floor(Math.random() * reactions.length)]);
    return;
  }

  if (/בדיחה|ספר.*בדיחה|תצחיק|joke|עוד בדיחה|עוד אחת/i.test(t)) {
    try {
      const joke = await claudeCall(
        'ספר בדיחה קצרה ומצחיקה בעברית על מכירות, עסקים, או AI. עד 4 שורות עם פואנטה. רק הבדיחה.',
        'בדיחה בבקשה', 250
      );
      await sendMessage(denisPhone, '😂 ' + joke + '\n\n— אלונה 🎤');
    } catch { await sendMessage(denisPhone, 'יצאתי לחפש בדיחה... ומצאתי רק לקוחות שלא סגרו 😅'); }
    return;
  }

  // ═══════════════════════════════════════════
  // 7. ALONA PERSONA — all other messages
  // ═══════════════════════════════════════════
  try {
    const memory = formatMemoryForPrompt();
    const response = await claudeCall(getAlonaSystem(), textToAnalyze || t, 400);
    await sendMessage(denisPhone, response);
  } catch {
    await sendMessage(denisPhone, 'אני כאן דניס! 😊 במה אוכל לעזור?');
  }
}

module.exports = { handleDenisAdmin };
