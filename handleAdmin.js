const { sendMessage } = require('./whatsapp');
const { getLead, upsertLead, findLeadsByName, getNamedLeads } = require('./leads');
const { summarizeClient, summarizeFromHistory } = require('./claude');
const { generateAndSendProposal } = require('./proposalHelper');
const { detectAdminIntent } = require('./adminIntent');
const { detectSkill, respondWithSkill } = require('./skillRouter');
const { addLesson, removeLesson, getAll, parseLessonFromText, formatMemoryForPrompt, rewriteWithCorrection } = require('./alonaMemory');
const axios = require('axios');

const DENIS_PHONE = process.env.DENIS_PHONE || '972509698121';
const ALONA_SYSTEM = `אתה אלונה, עוזרת AI חכמה, חמה ומצחיקה של דניס — איש מכירות בכיר.
עונה תמיד בעברית, קצר ולעניין (עד 4 שורות), עם הומור קל כשמתאים.
אל תציגי פקודות. אל תסבירי מה את. פשוט עזרי.`;

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
  // 3. FORM COMMAND
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
  // 4. SKILL-BASED TASK DETECTION (PRIORITY)
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
    const systemWithMemory = ALONA_SYSTEM + memory;
    const response = await claudeCall(systemWithMemory, textToAnalyze || t, 250);
    await sendMessage(denisPhone, response);
  } catch {
    await sendMessage(denisPhone, 'אני כאן דניס! 😊 במה אוכל לעזור?');
  }
}

module.exports = { handleDenisAdmin };
