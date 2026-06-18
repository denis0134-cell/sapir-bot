const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Skills directory
const SKILLS_DIR = path.join(__dirname, 'skills');

// Skill map: keywords → skill file
const SKILL_MAP = {
  'copywriting': ['קופי', 'כתיבה שיווקית', 'copy', 'כותרת', 'headline', 'לנדינג', 'CTA', 'נוסח', 'טקסט שיווקי'],
  'cold-email': ['מייל קר', 'cold email', 'אימייל קר', 'פנייה קרה', 'cold outreach'],
  'emails': ['אימייל', 'מייל', 'email', 'ניוזלטר', 'newsletter', 'רצף מיילים'],
  'sales-enablement': ['מכירות', 'sales', 'תסריט מכירה', 'sales script', 'הצגת מוצר', 'pitch'],
  'pricing': ['תמחור', 'מחיר', 'pricing', 'כמה לגבות', 'חבילות מחיר', 'price point'],
  'marketing-psychology': ['פסיכולוגיה', 'psychology', 'persuasion', 'שכנוע', 'הטיה', 'bias', 'טריגר'],
  'ad-creative': ['מודעה', 'פרסומת', 'ad', 'פייסבוק', 'אינסטגרם', 'creative', 'advertising'],
  'lead-magnets': ['ליד מגנט', 'lead magnet', 'מגנט לידים', 'freebie', 'הצעת ערך'],
  'marketing-ideas': ['רעיונות שיווק', 'marketing ideas', 'אסטרטגיה', 'strategy', 'רעיון'],
  'marketing-plan': ['תוכנית שיווק', 'marketing plan', 'תכנון', 'plan'],
  'viral-content': ['ויראלי', 'viral', 'תוכן', 'content', 'פוסט', 'post', 'רשתות חברתיות'],
  'competitor-profiling': ['מתחרה', 'competitor', 'ניתוח שוק', 'market analysis'],
  'analytics': ['אנליטיקס', 'analytics', 'נתונים', 'data', 'מדדים', 'KPI'],
  'ab-testing': ['A/B', 'בדיקה', 'testing', 'ניסוי'],
  'marketing-psychology': ['פסיכולוגיה', 'psychology', 'persuasion'],
  'launch': ['לאנץ', 'launch', 'השקה', 'שחרור מוצר'],
  'seo-audit': ['SEO', 'גוגל', 'חיפוש', 'search engine'],
  'customer-research': ['מחקר לקוחות', 'customer research', 'persona', 'פרסונה'],
  'cro': ['המרה', 'conversion', 'CRO', 'אופטימיזציה'],
  'prospecting': ['פרוספקטינג', 'prospecting', 'חיפוש לידים', 'lead generation'],
  // Video & Content
  'video-editing': ['עריכת וידאו', 'video', 'ריל', 'reel', 'יוטיוב', 'youtube'],
  'viral-content': ['ויראלי', 'viral', 'תוכן', 'content', 'פוסט', 'post'],
  'content-creation': ['יצירת תוכן', 'content creation', 'יוצר תוכן'],
  'infographic': ['אינפוגרפיק', 'infographic', 'ויזואל', 'visual'],
  // Anthropic official skills
  'anthropic-frontend-design': ['עיצוב', 'UI', 'design', 'CSS', 'ממשק'],
  'anthropic-pptx': ['מצגת', 'powerpoint', 'slides', 'PPTX', 'שקף'],
  'anthropic-docx': ['מסמך', 'word', 'docx', 'document'],
  'anthropic-xlsx': ['אקסל', 'excel', 'spreadsheet', 'גיליון'],
  // Extra marketing
  'keith-landing-page-optimizer': ['אופטימיזציה', 'optimize', 'שיפור דף'],
  'keith-brand-positioning': ['מיתוג', 'brand', 'מותג', 'positioning'],
  'impeccable-impeccable': ['מושלם', 'perfect', 'impeccable'],
  'prd-writer': ['PRD', 'מפרט מוצר', 'product requirement'],
  'playwright-playwright-skill': ['playwright', 'automation', 'אוטומציה'],
  'product-marketing': ['שיווק מוצר', 'product marketing', 'positioning', 'מיצוב'],
};

// Detect which skill to use
function detectSkill(text) {
  const lowerText = text.toLowerCase();
  for (const [skill, keywords] of Object.entries(SKILL_MAP)) {
    if (keywords.some(kw => lowerText.includes(kw.toLowerCase()))) {
      return skill;
    }
  }
  return null;
}

// Load skill content
function loadSkill(skillName) {
  const skillPath = path.join(SKILLS_DIR, skillName + '.md');
  if (fs.existsSync(skillPath)) {
    const content = fs.readFileSync(skillPath, 'utf8');
    // Return first 3000 chars to stay within token limits
    return content.substring(0, 3000);
  }
  return null;
}

// Generate response using skill
async function respondWithSkill(text, skillName) {
  const skillContent = loadSkill(skillName);
  if (!skillContent) return null;

  const system = `אתה אלונה, עוזרת AI חכמה של דניס — איש מכירות בכיר.
אתה מומחית מלאה ב: ${skillName.replace(/-/g, ' ')}.

הנה הידע המקצועי שלך:
---
${skillContent}
---

ענה בעברית, קצר וברור (עד 5 שורות), כמו יועצת מקצועית חמה.
אם צריך יותר פרטים — שאל שאלה אחת ספציפית.`;

  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
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
