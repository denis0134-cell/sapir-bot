const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CONTEXT_FILE = path.join(__dirname, 'alona-context.json');
const REPO = 'denis0134-cell/sapir-bot';

function loadContext() {
  try {
    if (fs.existsSync(CONTEXT_FILE)) {
      return JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function saveContext(ctx) {
  ctx.updatedAt = new Date().toISOString().split('T')[0];
  fs.writeFileSync(CONTEXT_FILE, JSON.stringify(ctx, null, 2));
  persistToGitHub(ctx).catch(() => {});
}

async function persistToGitHub(ctx) {
  const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!GH_TOKEN) return;
  try {
    const content = Buffer.from(JSON.stringify(ctx, null, 2)).toString('base64');
    let sha;
    try {
      const res = await axios.get(
        `https://api.github.com/repos/${REPO}/contents/alona-context.json`,
        { headers: { Authorization: `Bearer ${GH_TOKEN}` } }
      );
      sha = res.data.sha;
    } catch {}
    const body = { message: 'Update Alona knowledge base', content };
    if (sha) body.sha = sha;
    await axios.put(
      `https://api.github.com/repos/${REPO}/contents/alona-context.json`,
      body,
      { headers: { Authorization: `Bearer ${GH_TOKEN}`, 'Content-Type': 'application/json' } }
    );
  } catch {}
}

async function loadFromGitHub() {
  const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!GH_TOKEN) return;
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${REPO}/contents/alona-context.json`,
      { headers: { Authorization: `Bearer ${GH_TOKEN}` } }
    );
    const ctx = JSON.parse(Buffer.from(res.data.content, 'base64').toString());
    saveContext(ctx);
    console.log('[AlonaContext] Loaded from GitHub, knowledge items:', ctx.knowledge?.length || 0);
  } catch {}
}

function addKnowledge(item) {
  const ctx = loadContext();
  if (!ctx.knowledge) ctx.knowledge = [];
  ctx.knowledge.push({ text: item, addedAt: new Date().toISOString() });
  saveContext(ctx);
  return ctx.knowledge.length;
}

function getKnowledge() {
  const ctx = loadContext();
  return ctx.knowledge || [];
}

function buildSystemPrompt() {
  const ctx = loadContext();
  const { about, programs, salesMethodology, knowledge } = ctx;

  let prompt = `אתה אלונה — עוזרת AI חכמה, חמה ומצחיקה של דניס פול.

═══ WHO IS DENIS ═══
שם: דניס פול | איש מכירות בכיר | מכללת ספיר זיסמן
מטרה: לשנות חיים דרך מכירות
שיא: 17 סגירות בחודש
אינסטגרם: @__denis.pol__

═══ המכללה ═══
מכללת ספיר זיסמן:
• ספיר זיסמן — מאסטר NLP, 120K+ עוקבים
• איתי סלע — מומחה AI ואוטומציות

═══ תוכניות ═══
• ABM (AI Business Mastery): ₪13,900 — 6 שבועות, AI מעשי
• LDB (Let's Do Business): ₪18,900 — ליווי עסקי מלא
• ABM+LDB משולב: ₪24,900 — ערבות: הכפלת מחזור ב-90 יום

═══ שיטת מכירות ═══
• שיטת רועי עוביה: שיחה טבעית, שתיקה, שאלות אישור, שיקוף
• 4 אסימונות: בעיה ← עזרה מקצועית ← AI coaching ← ספיר זיסמן
• עיקרון: "לא למכור — להכיר. אמון = המפתח לסגירה"

═══ כלי הבוט ═══
• הצעה | טלפון | מסלול | מחיר
• טופס → שולח טופס לקוח
• [שם לקוח] → חיפוש היסטוריה
• למדי | [כלל] → ללמד כלל חדש

═══ עיצוב ═══
• צבע זהב #C9A84C, רקע שחור, Heebo RTL
• CTA: "📅 שריין שיחה עם דניס ←"`;

  if (knowledge && knowledge.length > 0) {
    prompt += '\n\n═══ ידע שנלמד ═══\n' + knowledge.map((k, i) => `${i+1}. ${k.text}`).join('\n');
  }

  prompt += '\n\n═══ כללי תגובה ═══\nעני בעברית. היי מעשית. אם מבקשים לכתוב — כתבי מיד.';

  return prompt;
}

module.exports = { loadContext, addKnowledge, getKnowledge, buildSystemPrompt, loadFromGitHub };
