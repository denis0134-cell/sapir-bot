/**
 * intentDetector.js
 * מנתח את הכוונה של דניס מהודעה בשפה טבעית
 */
const axios = require('axios');

const INTENT_SYSTEM = `אתה מנתח כוונות של דניס פול — איש מכירות High Ticket שמנהל עסק.
קראת הודעה שדניס שלח לבוט האישי שלו בעברית טבעית.
המשימה שלך: לזהות מה דניס רוצה ולחלץ את הפרמטרים.

כוונות אפשריות:
SALES_ANALYSIS   — רוצה לנתח שיחת מכירה / תמלול / שיחה שהייתה לו
WRITE_FOLLOWUP   — רוצה הודעת פולואפ ללקוח ספציפי
SCORE_LEADS      — רוצה לדעת מי הלידים הכי חמים / לדרג לידים
ADD_LEAD_NOTE    — רוצה לעדכן/לרשום פרטים על ליד שדיבר איתו
FIND_LEAD        — מחפש מידע על ליד ספציפי
LOG_INCOME       — רוצה לרשום הכנסה / סגירה / מכירה
LOG_EXPENSE      — רוצה לרשום הוצאה
ADD_DEBT         — רוצה לרשום חוב
FINANCE_REPORT   — רוצה לראות מצב כסף / הכנסות / דוח פיננסי
LOG_HEALTH       — רוצה לרשום כושר / משקל / שינה / מים / צעדים / עישון
HEALTH_REPORT    — רוצה לראות מצב בריאות
ADD_TASK         — רוצה להוסיף משימה / תזכורת / לא לשכוח
TASK_DONE        — בצע / סיים משימה
TASK_LIST        — רוצה לראות משימות פתוחות
SET_GOAL         — מגדיר יעד (הכנסה / סגירות / שיחות)
GOAL_STATUS      — רוצה לראות מצב יעדים / התקדמות
DAILY_REPORT     — דוח יומי מלא
DECISION_ADVICE  — מבקש יעוץ בהחלטה (לעזוב עבודה / השקעה / רכישה / שינוי)
BUILD_SCRIPT     — רוצה תסריט שיחה / סקריפט מכירה
SEND_FORM        — רוצה לשלוח טופס לקבלת לקוח
WRITE_CONTENT    — רוצה לכתוב תוכן שיווקי (פוסט / מודעה / מייל / הודעת ווצאפ)
GENERAL_QUESTION — שאלה כללית, שיח, ייעוץ, כל מה שלא נופל לאף קטגוריה
CREATE_GOAL      — רוצה להגדיר מטרה חדשה (עם קטגוריה/עדיפות/מדד הצלחה)
STORE_DECISION   — מתעד החלטה שקיבל ("החלטתי...", "קיבלתי החלטה...")
UPDATE_LEAD_FULL — עדכון ליד עם פרטים מלאים (חום, סבירות, פולואפ הבא)
LIST_GOALS       — הצגת מטרות פעילות
LIST_DECISIONS   — הצגת החלטות אחרונות
START_FOLLOWUP_SEQUENCE — להתחיל רצף פולואפ אוטומטי עם ליד (שולח הודעות לאורך ימים)
STOP_FOLLOWUP_SEQUENCE  — לעצור רצף פולואפ פעיל
SEND_TO_LEAD            — לשלוח הודעה ללקוח/ה (תשלחי לה, שלח ללקוח, שלחי לרחל)

החזר JSON בלבד (בלי backticks):
{
  "intent": "INTENT_NAME",
  "params": {
    "text": null,
    "name": null,
    "amount": null,
    "source": null,
    "metric": null,
    "value": null,
    "taskText": null,
    "priority": "normal",
    "question": null,
    "contentType": null,
    "context": null
  },
  "confidence": 0.9,
  "clarifyQuestion": null
}

כללים:
- metric לבריאות: workout / weight / sleep / steps / water / smoking
- priority: high אם "דחוף"/"חשוב", אחרת normal
- confidence < 0.7 → תן clarifyQuestion (שאלה אחת קצרה)
- אם ההודעה ארוכה (>200 תווים) ומתארת שיחה/שיחה עם לקוח → SALES_ANALYSIS
- contentType: whatsapp/post/email/ad/landing/script

דוגמאות (לא להחזיר את הדוגמאות עצמן):
"ניתח לי את השיחה עם רחל" → SALES_ANALYSIS confidence:0.9
"סגרתי היום 13900 על ABM" → LOG_INCOME amount:13900 source:"ABM"
"כתבי פולואפ לאיתי שלא ענה שבוע" → WRITE_FOLLOWUP name:"איתי" confidence:0.9
"התאמנתי שעה ריצה" → LOG_HEALTH metric:workout value:"שעה ריצה"
"שקלתי היום 81" → LOG_HEALTH metric:weight value:81
"לא לשכוח לפנות לרחל מחר" → ADD_TASK taskText:"לפנות לרחל" priority:normal
"האם כדאי לי לעזוב את העבודה?" → DECISION_ADVICE question:"האם כדאי לי לעזוב את העבודה?"
"כמה כסף יש לי החודש?" → FINANCE_REPORT
"מה שלום רחל?" → FIND_LEAD name:"רחל"
"תכתבי לי פוסט לפייסבוק על..." → WRITE_CONTENT contentType:post
"שיחה הייתה לי היום עם מטפלת..." → SALES_ANALYSIS (long text)
"רוצה להגדיר מטרה: להגיע ל-40K בחודש" → CREATE_GOAL title:"להגיע ל-40K" category:money
"החלטתי לעזוב את העבודה" → STORE_DECISION
"דוח שבוע" → WEEKLY_REPORT
"מה הדשבורד שלי?" → LIFE_DASHBOARD
"מה הציון שלי היום?" → SCORE_CHECK
"1. פולואפ לרחל\n2. 5 שיחות" → SAVE_CHECKIN (after morning questions)
"רחל חמה, סבירות 80%, פולואפ מחר" → UPDATE_LEAD_FULL name:רחל temperature:hot closing_probability:80`;

async function detectIntent(text) {
  try {
    const resp = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: INTENT_SYSTEM,
      messages: [{ role: 'user', content: text }]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: 12000
    });

    const raw = resp.data.content[0].text.trim().replace(/```json|```/g, '').trim();
    const result = JSON.parse(raw);
    console.log(`[Intent] ${result.intent} (${result.confidence}) for: "${text.substring(0, 40)}"`);
    return result;
  } catch (err) {
    console.error('[IntentDetector] Error:', err.message);
    return {
      intent: 'GENERAL_QUESTION',
      params: { context: text },
      confidence: 0.5,
      clarifyQuestion: null
    };
  }
}

module.exports = { detectIntent };
