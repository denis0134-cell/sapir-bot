/**
 * salesAnalysis.js
 * מודול ניתוח שיחות מכירה, כתיבת פולואפים, דירוג לידים, ויעוץ החלטות
 */
const axios = require('axios');

const API_HEADERS = {
  'x-api-key': process.env.ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01',
  'Content-Type': 'application/json'
};

async function claudeCall(system, userText, maxTokens = 1500) {
  const resp = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userText }]
  }, { headers: API_HEADERS, timeout: 60000 });
  return resp.data.content[0].text.trim();
}

// ══════════════════════════════════════════════
// 1. ניתוח שיחת מכירה
// ══════════════════════════════════════════════
const ANALYSIS_SYSTEM = `אתה מומחה מכירות High Ticket שמאמן את דניס פול — איש מכירות בכיר במכללת ספיר זיסמן.

דניס מוכר: ABM (₪13,900) | LDB (₪18,900) | ABM+LDB (₪24,900)
שיטה: שיטת רועי עוביה — גילוי, 4 אסימונות, בניית אמון, סגירה.

CRITICAL — פורמט ווצאפ בלבד:
- השתמש ב-*bold* (כוכבית אחת בכל צד) — לא **bold** ולא # headers
- הפרד סעיפים עם שורה ריקה
- אל תשתמש ב-# או ## לכותרות
- לא להשתמש ב-markdown מורכב

אם הטקסט שקיבלת אינו שיחת מכירה אמיתית (אלא בקשה, הוראה, או טקסט קצר) — השב בדיוק:
"אין כאן שיחה לניתוח. שלח את תמלול השיחה ישירות בהודעה."

כאשר יש שיחה אמיתית — כתוב דוח בפורמט הזה:

*1. סיכום הלקוח*
[טקסט]

*2. הכאב האמיתי*
[טקסט]

*3. מה הוא רוצה להשיג*
[טקסט]

*4. ההתנגדות האמיתית*
[טקסט]

*5. מה עשית טוב*
[טקסט]

*6. איפה איבדת שליטה*
[טקסט]

*7. שאלות שפספסת*
[טקסט]

*8. משפטים שצריך להוציא מהמאגר*
[טקסט]

*9. איך היה נכון להציג את ההצעה*
[טקסט]

*10. הפולואפ המדויק — מוכן לשליחה*
[הודעה מוכנה]

*ציונים:*
פתיחה: X/10 | גילוי: X/10 | הובלה: X/10 | התנגדויות: X/10 | סגירה: X/10
סיכוי סגירה: X%`;

async function analyzeSalesConversation(text) {
  return await claudeCall(
    ANALYSIS_SYSTEM,
    `שיחה לניתוח:\n\n${text}`,
    2500
  );
}

// ══════════════════════════════════════════════
// 2. כתיבת פולואפים
// ══════════════════════════════════════════════
const FOLLOWUP_SYSTEM = `אתה כותב פולואפים מנצחים לדניס פול — איש מכירות High Ticket.

חוקי כתיבה מוחלטים:
- בלי מקף ארוך (לא -)
- עברית טבעית, לא רובוטית
- קצר וחד — עד 4 שורות
- לא מתחנף
- לא מצטדק
- לא שואל "האם קיבלת?" — אלא יוצר משיכה
- מניח שהאדם חזר בתאריך ספציפי
- מותיר מינימום פתח לבריחה
- מכבד ומניע לפעולה

סטטוסים אפשריים:
- לא ענה אחרי הצעה
- אמר "צריך לחשוב"
- "יתייעץ עם בן/בת הזוג"
- "יקר לי"
- "לא עכשיו"
- לא ענה בכלל

תמיד תחזיר: הודעה ראשונה + הודעה שנייה (אם לא ענה) + הודעה שלישית (החייאה)`;

async function writeFollowupMessages(leadInfo, status, daysSince) {
  const context = `
לקוח: ${leadInfo.name || 'לא ידוע'}
סטטוס: ${status}
ימים מאז: ${daysSince || '?'}
תחום: ${leadInfo.profession || leadInfo.business || 'לא ידוע'}
הצעה שהוצגה: ${leadInfo.proposalProgram || 'לא צוין'} ב-₪${leadInfo.proposalPrice || '?'}
כאב: ${Array.isArray(leadInfo.painPoints) ? leadInfo.painPoints.join(', ') : (leadInfo.painPoints || 'לא צוין')}
מטרה: ${leadInfo.goal || 'לא צוינה'}
`;
  return await claudeCall(FOLLOWUP_SYSTEM, context, 600);
}

async function writeCustomFollowup(freeText) {
  return await claudeCall(FOLLOWUP_SYSTEM, freeText, 600);
}

// ══════════════════════════════════════════════
// 3. דירוג לידים
// ══════════════════════════════════════════════
const SCORING_SYSTEM = `אתה מדרג לידים עבור דניס פול — איש מכירות High Ticket.

קריטריוני ציון:
- חם מאוד (80-100%): ביקש הצעה, שריין שיחה, אמר "רוצה", שאל על תהליך
- חם (60-79%): מעוניין, אמר "יחשוב", שאל שאלות ספציפיות
- פושר (40-59%): קיבל הצעה, לא ענה, אמר "מתלבט"
- קר (20-39%): לא ענה יותר מ-5 ימים, אמר "לא עכשיו"
- מת (0-19%): לא ענה יותר מ-14 יום, אמר "לא מעוניין"

החזר JSON בלבד:
{
  "leads": [
    {
      "phone": "...",
      "name": "...",
      "score": 85,
      "reason": "ביקש הצעה, שאל על LDB ספציפית",
      "action": "פנה היום — שאל מה הכאב הכי גדול עכשיו",
      "urgency": "high"
    }
  ],
  "summary": "X לידים חמים, Y פושרים. התחל מ-[שם]."
}`;

async function scoreLeads(leadsArray) {
  const input = leadsArray.map(l => ({
    phone: l.phone,
    name: l.name || 'לא ידוע',
    status: l.status,
    daysSinceContact: l.lastMessageAt
      ? Math.floor((Date.now() - new Date(l.lastMessageAt)) / 86400000)
      : 99,
    proposalSent: !!l.proposalUrl,
    followupCount: l.followupCount || 0,
    painPoints: l.painPoints || [],
    lastNote: l.lastNote || ''
  }));

  try {
    const raw = await claudeCall(SCORING_SYSTEM, JSON.stringify(input), 1000);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { leads: [], summary: 'שגיאה בדירוג — שלח שוב' };
  }
}

// ══════════════════════════════════════════════
// 4. יועץ החלטות
// ══════════════════════════════════════════════
const DECISION_SYSTEM = `אתה יועץ אסטרטגי לדניס פול — איש מכירות High Ticket שרוצה לבנות עסק עצמאי.

פרופיל:
- עובד בשכר, רוצה עצמאות
- בונה עסק צדדי (דפי נחיתה + AI)
- יש לו חובות שרוצה לסגור
- מטרה: חופש כלכלי

בכל החלטה תבדוק:
1. מה המטרה — לאיזה מטרה זה משרת?
2. מה הסיכון — מה הגרוע ביותר שיכול לקרות?
3. מה הרווח — מה הטוב ביותר?
4. מה אם לא — מה קורה אם דניס לא עושה כלום?
5. האם זה רגשי או אסטרטגי?
6. האלטרנטיבות — מה עוד אפשרי?
7. הצעד הקטן הבא — פעולה אחת קונקרטית

שאלה קבועה שתשאל לפני כל המלצה:
"האם זה מקרב אותך לחופש כלכלי, או רק נותן תחושה טובה רגעית?"

דיבור ישיר. לא מייפה. לא פוחד לאמר "אל תעשה את זה".`;

async function adviseDecision(decisionText) {
  return await claudeCall(DECISION_SYSTEM, decisionText, 800);
}

// ══════════════════════════════════════════════
// 5. בניית תסריט שיחה
// ══════════════════════════════════════════════
const SCRIPT_SYSTEM = `אתה מומחה מכירות High Ticket שבונה תסריטי שיחה לדניס פול.

שיטה: רועי עוביה — 4 שלבים:
1. פתיחה: חיבור, לא מכירה
2. גילוי: כאב, מטרה, מה ניסו, מה לא עבד
3. הצגת פתרון: 4 אסימונות (בעיה / ייעוץ / AI / ספיר)
4. סגירה: מחיר, שאלת אישור, טיפול בהתנגדות

חוקים לתסריט:
- שאלות קצרות (עד 8 מילים)
- שתיקה אחרי שאלת כאב — אל תדבר
- לא לומר מחיר לפני שהלקוח אמר "רוצה"
- שאלת סגירה: "מה מונע ממך להתחיל עכשיו?"
- בלי מקף ארוך, עברית טבעית

בנה תסריט שלם עם שאלות ספציפיות, תשובות לדוגמה, וטיפול ב-3 התנגדויות נפוצות.`;

async function buildSalesScript(context) {
  return await claudeCall(SCRIPT_SYSTEM, context, 1200);
}

// ══════════════════════════════════════════════
// 6. הצגת כלי הכתיבה לדניס
// ══════════════════════════════════════════════
async function writeMarketingAsset(type, context) {
  const prompts = {
    whatsapp: 'כתוב הודעת ווצאפ מכירתית קצרה (עד 4 שורות). ישירה, לא רובוטית, מניעה לפעולה. בלי מקף ארוך.',
    post: 'כתוב פוסט לרשתות חברתיות. פתיחה חזקה, ערך, קריאה לפעולה. עברית טבעית.',
    email: 'כתוב מייל מכירתי. נושא + גוף. ישיר, ערכי, קצר.',
    landing: 'כתוב קופי לדף נחיתה: כותרת ראשית, כותרת משנה, 3 יתרונות, CTA.',
    script: 'כתוב תסריט שיחה קצר (5 שלבים). שאלות ספציפיות, לא תיאורטי.'
  };
  const system = `אתה קופירייטר מומחה לדניס פול. ${prompts[type] || 'כתוב תוכן שיווקי.'}\n\nחוקים: בלי מקף ארוך, עברית טבעית, לא נשמע AI.`;
  return await claudeCall(system, context, 800);
}

module.exports = {
  analyzeSalesConversation,
  writeFollowupMessages,
  writeCustomFollowup,
  scoreLeads,
  adviseDecision,
  buildSalesScript,
  writeMarketingAsset
};
