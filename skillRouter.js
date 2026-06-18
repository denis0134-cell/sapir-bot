const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SKILLS_DIR = path.join(__dirname, 'skills');

const SKILL_MAP = {
  // ── Ads & Content ──
  'ad-creative':        ['מודעה', 'פרסומת', 'פייסבוק', 'אינסטגרם', 'ad', 'creative', 'advertising', 'קריאייטיב', 'banner'],
  'claude-ads-daniel':  ['קמפיין פרסום', 'ads campaign', 'google ads', 'פרסום ממומן'],
  'viral-content':      ['ויראלי', 'viral', 'פוסט', 'רילס', 'reels', 'סטורי', 'story', 'תוכן ברשתות'],
  'content-creation':   ['יצירת תוכן', 'content plan', 'לוח תוכן', 'content calendar', 'יוצר תוכן'],
  'infographic':        ['אינפוגרפיק', 'infographic', 'ויזואל', 'visual data'],
  // ── Copywriting ──
  'copywriting':        ['קופי', 'כתיבה שיווקית', 'copy', 'כותרת', 'headline', 'CTA', 'נוסח', 'טקסט שיווקי', 'לכתוב', 'תכתב'],
  'keith-copywriter':   ['שכתב', 'copywriter', 'marketing copy'],
  'copy-editing':       ['לערוך טקסט', 'שפר', 'copy edit', 'לתקן'],
  'keith-landing-page-optimizer': ['שפר דף', 'אופטימיזציה לדף', 'landing optimization'],
  'impeccable-impeccable': ['מושלם', 'perfect', 'impeccable', 'ברמה גבוהה'],
  // ── Email & SMS ──
  'emails':             ['אימייל', 'מייל', 'email', 'ניוזלטר', 'newsletter', 'רצף מיילים', 'email sequence'],
  'cold-email':         ['מייל קר', 'cold email', 'פנייה קרה', 'cold outreach', 'ליצור קשר'],
  'keith-email-marketer': ['קמפיין מייל', 'email campaign', 'drip'],
  'sms':                ['SMS', 'הודעת טקסט', 'text message', 'הודעה קצרה'],
  // ── Sales ──
  'sales-enablement':   ['תסריט מכירה', 'sales script', 'pitch', 'מצגת מכירה', 'sales deck', 'objection', 'התנגדות', 'לסגור עסקה', 'מכירה', 'לסגור'],
  'pricing':            ['תמחור', 'מחיר', 'pricing', 'כמה לגבות', 'חבילות מחיר', 'price point', 'מחירון'],
  'prospecting':        ['פרוספקטינג', 'prospecting', 'חיפוש לידים', 'lead generation', 'למצוא לקוחות'],
  'lead-magnets':       ['ליד מגנט', 'lead magnet', 'מגנט לידים', 'freebie', 'הצעת ערך חינמית'],
  'popups':             ['פופאפ', 'popup', 'pop-up', 'חלונית'],
  'signup':             ['דף הרשמה', 'signup', 'sign up', 'הרשמה', 'registration'],
  // ── Strategy & Psychology ──
  'marketing-psychology': ['פסיכולוגיה', 'psychology', 'persuasion', 'שכנוע', 'הטיה קוגניטיבית', 'bias', 'טריגר', 'urgency', 'דחיפות', 'social proof'],
  'marketing-plan':     ['תוכנית שיווק', 'marketing plan', 'אסטרטגיה שיווקית', 'marketing strategy'],
  'marketing-ideas':    ['רעיונות שיווק', 'marketing ideas', 'רעיון לקמפיין', 'campaign idea'],
  'customer-research':  ['מחקר לקוחות', 'customer research', 'persona', 'פרסונה', 'buyer persona', 'ICP'],
  'competitor-profiling': ['מתחרה', 'competitor', 'ניתוח שוק', 'market analysis', 'competition', 'מתחרים'],
  'keith-brand-positioning': ['מיתוג', 'brand', 'מותג', 'positioning', 'מיצוב', 'brand identity'],
  // ── Analytics & Optimization ──
  'analytics':          ['אנליטיקס', 'analytics', 'נתונים', 'data', 'מדדים', 'KPI', 'metrics', 'דוח', 'report'],
  'ab-testing':         ['A/B', 'A/B testing', 'בדיקת גרסאות', 'split test'],
  'cro':                ['המרה', 'conversion', 'CRO', 'conversion rate', 'אופטימיזציית המרות'],
  'seo-audit':          ['SEO audit', 'ביקורת SEO', 'בדיקת SEO', 'seo check'],
  'ai-seo':             ['SEO', 'גוגל', 'חיפוש אורגני', 'organic search', 'keyword', 'מילות מפתח'],
  'keith-seo-strategist': ['אסטרטגיית SEO', 'seo strategy', 'בניית קישורים'],
  // ── Launch & Product ──
  'launch':             ['לאנץ', 'launch', 'השקה', 'שחרור מוצר', 'product launch', 'לשחרר'],
  'product-marketing':  ['שיווק מוצר', 'product marketing', 'product positioning', 'go to market', 'GTM'],
  'prd-writer':         ['PRD', 'מפרט מוצר', 'product requirement', 'requirements doc'],
  // ── Video & Design ──
  'video-editing':      ['עריכת וידאו', 'video edit', 'ריל', 'reel', 'video production'],
  'anthropic-frontend-design': ['עיצוב', 'UI', 'design', 'CSS', 'ממשק', 'frontend', 'UX'],
  'anthropic-algorithmic-art': ['גרפיקה', 'art', 'אמנות', 'generative', 'illustration'],
  'color-expert':       ['צבעים', 'color', 'פלטת צבעים', 'color palette', 'brand colors'],
  'infographic':        ['אינפוגרפיק', 'infographic', 'data visualization'],
  // ── Documents ──
  'anthropic-pptx':     ['מצגת', 'powerpoint', 'slides', 'PPTX', 'שקף', 'presentation'],
  'anthropic-docx':     ['מסמך', 'word', 'docx', 'document', 'Word'],
  'anthropic-xlsx':     ['אקסל', 'excel', 'spreadsheet', 'גיליון', 'XLSX'],
  'anthropic-pdf':      ['PDF', 'pdf'],
};

function detectSkill(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [skill, keywords] of Object.entries(SKILL_MAP)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return skill;
    }
  }
  return null;
}

function loadSkill(skillName) {
  const skillPath = path.join(SKILLS_DIR, skillName + '.md');
  if (fs.existsSync(skillPath)) {
    return fs.readFileSync(skillPath, 'utf8').substring(0, 4000);
  }
  return null;
}

function loadAlonaMemory() {
  try {
    const fs = require('fs'), path = require('path');
    const memFile = path.join(__dirname, 'alona-memory.json');
    if (fs.existsSync(memFile)) {
      return JSON.parse(fs.readFileSync(memFile, 'utf8')) || [];
    }
  } catch {}
  return [];
}

async function respondWithSkill(text, skillName) {
  const skillContent = loadSkill(skillName);
  if (!skillContent) return null;

  const skillLabel = skillName.replace(/-/g, ' ').replace('keith ', '').replace('anthropic ', '');

  const system = `אתה אלונה, עוזרת AI מקצועית של דניס — איש מכירות בכיר במכללת ספיר זיסמן.
יש לך מומחיות מלאה ב-${skillLabel}.

הידע המקצועי שלך:
---
${skillContent}
---

כללים:
- ענה בעברית בלבד
- היה ספציפי ומעשי — תן פלט שדניס יכול להשתמש בו מיד
- אם מבקשים לכתוב משהו — כתוב אותו ממש, לא רק עצות
- סגנון חם ומקצועי
- אורך: עד 10 שורות (אלא אם מבקשים יותר)`;

  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system,
    messages: [{ role: 'user', content: text }]
  }, {
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }
  });

  return response.data.content[0].text.trim();
}

module.exports = { detectSkill, loadSkill, respondWithSkill };
