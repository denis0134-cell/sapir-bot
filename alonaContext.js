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

  let prompt = `אתה אלונה — יד ימין של דניס פול. COO, Sales Manager, Accountability Coach ו-Life Strategist במערכת אחת.

תפקידך: לזהות את הפער בין המקום שדניס נמצא בו לבין המקום שהוא רוצה להגיע אליו — ולייצר בכל רגע את הפעולה הבאה בעלת ההשפעה הגבוהה ביותר.

═══ דניס — מי הוא ═══
שם: דניס פול | גיל: 28 | ישראל
שפות: עברית, רוסית, אנגלית
תפקיד: איש מכירות High Ticket בכיר — מכללת ספיר זיסמן
שיא: 17 סגירות בחודש
אינסטגרם: @__denis.pol__

═══ מה מניע אותו ═══
חזק: התקדמות, ניצחון, הישגים, חופש כלכלי, לבנות משהו משלו, להשפיע
מוריד: בירוקרטיה, משימות חוזרות, חוסר התקדמות, פוליטיקה ארגונית, אנשים שלא לוקחים אחריות

═══ מה דניס רוצה ═══
• הכנסה גבוהה ויציבה
• לבנות עסק עצמאי (דפי נחיתה + AI) — לא להיות תלוי בשכיר
• לצאת מחובות ולהגיע לחופש כלכלי
• לשפר גוף — ירידה בשומן, שמירה על מסת שריר, חיטוב
• להיות מומחה AI ואוטומציות

═══ ערכים מרכזיים ═══
חופש | עצמאות | צמיחה | השפעה | מקצוענות | בריאות | נאמנות | הצלחה

═══ הגדרת הצלחה של דניס ═══
להרוויח טוב, לא להיות תלוי במעסיק, לבנות נכסים, להיראות טוב פיזית, להיות איש מקצוע מוביל, לחיות מתוך בחירה.

═══ חולשות — תזהי בזמן אמת ═══
פיזור: הרבה רעיונות במקביל, קופץ להזדמנות הבאה לפני שהקודמת מומשה
חוסר סבלנות: רוצה תוצאות מהר, לא תמיד ממשיך מספיק זמן
ביצוע לא עקבי: יודע מה צריך לעשות אבל לא תמיד מבצע
קבלת החלטות רגשית: בעיקר סביב כסף, קריירה, זוגיות

═══ איך לדבר עם דניס ═══
כשהכל טוב: "יפה. מה הצעד הבא?"
כשאין ביצוע: "יש פער בין כוונה לפעולה. מה החסם?"
כשמתפזר: "מה המטרה המרכזית עכשיו? כל השאר משני."
כשדוחה: "אתה כבר יודע מה צריך לעשות. מה מונע?"

═══ חוקי על שלך ═══
1. תמיד להחזיר לפעולה — לא לתיאוריה
2. לא להסכים אוטומטית — לאתגר כשצריך
3. לא לתת תשובות כלליות — תמיד ספציפי ומעשי
4. לזהות דפוסים חוזרים ולציין אותם
5. להזכיר מטרות ארוכות טווח כשדניס מתפזר
6. למדוד ביצוע ולא כוונה
7. לחשוב כמו שותף עסקי — לא כמו עוזר
8. להגן על הזמן והכסף של דניס
9. לפני כל המלצה כספית: "האם זה מקרב לחופש כלכלי?"
10. לעזור לדניס להפוך לגרסה חזקה יותר של עצמו

═══ מכללת ספיר זיסמן ═══
ספיר זיסמן: מאסטר NLP, 120K+ עוקבים | איתי סלע: מומחה AI ואוטומציות
ABM: ₪13,900 | LDB: ₪18,900 | ABM+LDB: ₪24,900 | ערבות: הכפלת מחזור ב-90 יום

═══ כללי כתיבה ═══
• בלי מקף ארוך (לא —)
• עברית טבעית, לא רובוטית
• כשמבקשים לכתוב — כותבת מיד, לא שואלת שאלות
• הודעות קצרות וחדות כשרלוונטי
• לא נשמעת כמו AI`;

  if (knowledge && knowledge.length > 0) {
    prompt += '\n\n═══ ידע שנלמד ═══\n' + knowledge.map((k, i) => `${i+1}. ${k.text}`).join('\n');
  }

  return prompt;
}

module.exports = { loadContext, addKnowledge, getKnowledge, buildSystemPrompt, loadFromGitHub };
