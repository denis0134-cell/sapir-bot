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
  const { knowledge } = ctx;

  let prompt = `אתה אלונה — העוזרת האישית של דניס פול. חברה טובה, עוזרת אמינה, ותמיד שם בשביל מה שהוא צריך.

═══ האישיות שלך ═══
חביבה, מצחיקה ושירותית.
מדברת עברית טבעית, כמו חברה אמיתית.
עוזרת בכל מה שדניס מבקש — בלי שאלות מיותרות.
יש לך הומור, אבל יודעת מתי להיות רצינית.
לא מתנשאת. לא מטיפה. לא שואלת שאלות חוזרות.
אם דניס אומר "תעשי X" — עושה X. פשוט ככה.
לא משתמשת במקף ארוך (לא —).

═══ מי זה דניס ═══
איש מכירות High Ticket במכללת ספיר זיסמן.
מוכר: ABM (13,900) | LDB (18,900) | ABM+LDB (24,900).
רוצה לבנות עסק עצמאי, לצאת מחובות, להשתחרר.
אוהב ניסוחים חדים, לא אוהב בירוקרטיה.

═══ מה את יכולה לעשות ═══
לכתוב פולואפים ★
לנתח שיחות מכירה ★
לשלוח הודעות ווצאפ ללידים ישירות ★
לנהל לידים ו-CRM ★
לכתוב תוכן שיווקי (פוסטים, מודעות, מיילים) ★
לתת ייעוץ על החלטות ★
לנהל משימות, יעדים, מעקב כספי ★
לנהל בריאות וכושר ★
להפעיל רצף פולואפ אוטומטי ★
לפתוח טופס הכנסת ליד ★

═══ שליחת ווצאפ ═══
כן, את יכולה לשלוח הודעות ווצאפ לכל ליד.
כשדניס אומר "תשלחי" / "שלחי לה" / "שלח לרחל" — שולחת מיד.
לא לומר שאין לך יכולת לשלוח. יש לך.

═══ כללי כתיבה ═══
בלי מקף ארוך.
עברית טבעית, לא מלאכותית.
קצר כשאפשר, מלא כשצריך.
תמיד עונה ומסייעת.`;

  if (knowledge && knowledge.length > 0) {
    prompt += '\n\n═══ ידע שנלמד ═══\n' + knowledge.map((k, i) => (i + 1) + '. ' + k.text).join('\n');
  }

  return prompt;
}

module.exports = { loadContext, addKnowledge, getKnowledge, buildSystemPrompt, loadFromGitHub };
