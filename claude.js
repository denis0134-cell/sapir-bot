const axios = require('axios');
const systemPromptTemplate = require('./systemPrompt');

function getSystemPrompt() {
  return systemPromptTemplate.replace(
    'CALENDAR_LINK_PLACEHOLDER',
    process.env.CALENDAR_LINK || ''
  );
}

async function generateResponse(conversationHistory) {
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: getSystemPrompt(),
        messages: conversationHistory
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    const raw = response.data.content[0].text.trim();
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      return { message: raw, action: 'none', extractedInfo: null };
    }
  } catch (err) {
    console.error('[Claude] Error:', err?.response?.data || err.message);
    return {
      message: 'מצטערים, יש תקלה טכנית רגעית. נחזור אליך בקרוב 🙏',
      action: 'none',
      extractedInfo: null
    };
  }
}

async function extractLeadInfo(conversationHistory) {
  try {
    const prompt = `סקור את השיחה וחלץ מידע בפורמט JSON בלבד:
{"name":null,"profession":null,"business":null,"currentRevenue":null,"goal":null,"painPoints":[]}
אם מידע לא הוזכר — null. JSON בלבד.`;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [...conversationHistory, { role: 'user', content: prompt }]
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    const raw = response.data.content[0].text.trim();
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (err) {
    console.error('[Claude] extractLeadInfo error:', err.message);
    return {};
  }
}


async function summarizeClient(rawText) {
  const systemPrompt = `אתה עוזר של דניס — איש מכירות במכללת ספיר זיסמן.
דניס ישלח לך פרטים גולמיים על לקוח פוטנציאלי.
המשימה: לסכם בצורה קצרה, ברורה ומסודרת בעברית לווצאפ.

המבנה (השתמש ב-*bold* של ווצאפ):
📋 *סיכום לקוח*
━━━━━━━━━━━━━━

👤 *שם:* [שם]
💼 *תחום:* [מקצוע/עסק]
📊 *מצב נוכחי:* [משפט קצר]

🔴 *כאבים עיקריים:*
• [כאב 1]
• [כאב 2]

🎯 *מטרות:*
• [מטרה 1]
• [מטרה 2]

✅ *מסלול מומלץ:* [ABM / LDB / ABM+LDB]
💰 *מחיר מוצע:* [מחיר] ₪

🚧 *למה לא סגר:* [מה עצר אותו — אם ידוע]
😰 *חשש/פחד:* [מה הוא מפחד — אם ידוע]

📝 *הערות:* [משפט חשוב לפני הצעה]

חוקים: קצר ולעניין — עד 18 שורות. רק מה שידוע, אל תמציא. השמט שדות לא ידועים. AI/אוטומציה→ABM | עסק/ליווי→LDB | שניהם→ABM+LDB`;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: rawText }]
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.content[0].text.trim();
  } catch (err) {
    console.error('[Claude] summarizeClient error:', err.message);
    return '❌ שגיאה בסיכום. נסה שוב.';
  }
}



async function summarizeFromHistory(lead) {
  const systemPrompt = `אתה עוזר CRM של דניס ממכללת ספיר זיסמן.
קיבלת נתונים שמורים על ליד מהמערכת.
סכם הכל בצורה קצרה וקולעת לווצאפ.

המבנה:
📋 *${lead.name || 'לקוח'}* | ${lead.phone || ''}
━━━━━━━━━━━━━━

💼 *תחום:* [מקצוע/עסק]
📊 *סטטוס:* [מה הסטטוס הנוכחי]
📅 *עדכון אחרון:* [תאריך בעברית]

🔴 *כאבים שעלו בשיחה:*
• [כאב 1]
• [כאב 2]

🎯 *מה הוא רצה:*
• [מטרה]

🚧 *למה לא סגר:*
[ניתוח קצר מהשיחה — מה עצר אותו]

😰 *החשש/הפחד שלו:*
[מה הוא הביע כחשש]

${lead.proposalUrl ? `🔗 *הצעה שנשלחה:* ${lead.proposalUrl}` : ''}
${lead.followupCount > 0 ? `📨 *פולואפים שנשלחו:* ${lead.followupCount}/6` : ''}

💡 *המלצה לפנייה הבאה:*
[טיפ קצר איך לחזור אליו]`;

  const conversationText = (lead.conversation || [])
    .slice(-20)
    .map(m => `${m.role === 'user' ? 'ליד' : 'בוט'}: ${m.content}`)
    .join('\n');

  const dataText = `
שם: ${lead.name || 'לא ידוע'}
טלפון: ${lead.phone || ''}
מקצוע: ${lead.profession || 'לא ידוע'}
עסק: ${lead.business || ''}
הכנסה נוכחית: ${lead.currentRevenue || 'לא ידוע'}
מטרה: ${lead.goal || 'לא ידוע'}
כאבים: ${JSON.stringify(lead.painPoints || [])}
סטטוס: ${lead.status || 'לא ידוע'}
הצעה שנשלחה: ${lead.proposalUrl || 'לא'}
מסלול: ${lead.proposalProgram || 'לא'}
מחיר: ${lead.proposalPrice || 'לא'}
פולואפים: ${lead.followupCount || 0}/6
עדכון אחרון: ${lead.updatedAt || lead.createdAt || 'לא ידוע'}

שיחה (20 הודעות אחרונות):
${conversationText || 'אין שיחה שמורה'}
`.trim();

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: dataText }]
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.content[0].text.trim();
  } catch (err) {
    console.error('[Claude] summarizeFromHistory error:', err.message);
    return '❌ שגיאה בסיכום היסטוריה.';
  }
}



async function generateProposalHeadline(clientData) {
  const { clientName, clientProfession, clientBusiness, currentRevenue, targetRevenue, goal, painPoints } = clientData;
  const prompt = `אתה קופירייטר מצוין שכותב כותרות לדפי נחיתה עבור מכללת ספיר זיסמן.

פרטי הלקוח:
שם: ${clientName}
מקצוע/עסק: ${clientProfession || clientBusiness || ''}
הכנסה נוכחית: ${currentRevenue || 'לא ידוע'}
מטרה: ${goal || 'לצמוח ולהגדיל הכנסה'}
כאבים: ${Array.isArray(painPoints) ? painPoints.join(', ') : painPoints || ''}

כתוב כותרת רגשית, אישית ועוצמתית ל-${clientName} בעברית.
הכותרת צריכה:
- להתחיל עם שם הלקוח
- להזכיר את המקצוע/עסק שלו באופן ספציפי
- להדגיש את הפוטנציאל הקיים שלו
- לסיים עם "הגיע הזמן שה-AI יהיה [משהו] שעובד בשבילך גם כשאתה לא"
- להיות 2-3 שורות, לא יותר מ-20 מילים סה"כ

דוגמה: "שרית, יש לך שלושה כובעים ושליחות אמיתית לשנות חיים. הגיע הזמן שה-AI יהיה הכובע הרביעי שעובד בשבילך גם כשאת לא."

החזר JSON בלבד:
{
  "headline": "הכותרת הראשית",
  "subheadline": "פסקה קצרה של 2-3 משפטים המסבירה את המצב הנוכחי ומה צריך לקרות",
  "highlightPhrase": "ביטוי 3-5 מילים שיודגש בצבע אחר (הרגע הרגשי)"
}`;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );
    const raw = response.data.content[0].text.trim().replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error('[Claude] generateProposalHeadline error:', err.message);
    return {
      headline: `${clientName}, הגיע הזמן שה-AI יעבוד בשבילך גם כשאתה לא.`,
      subheadline: `${clientProfession || 'הידע והניסיון שלך'} — זה הבסיס. עכשיו הגיע הזמן לבנות מנגנון שמביא לקוחות, מוכר ומנהל בלי שתצטרך להיות שם כל הזמן.`,
      highlightPhrase: 'הגיע הזמן שה-AI'
    };
  }
}

module.exports = { generateResponse, extractLeadInfo, summarizeClient, summarizeFromHistory, generateProposalHeadline };
