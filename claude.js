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

📝 *הערות:* [משפט חשוב לפני הצעה]

חוקים: קצר ולעניין — עד 15 שורות. רק מה שידוע. AI/אוטומציה→ABM | עסק/ליווי→LDB | שניהם→ABM+LDB`;

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

module.exports = { generateResponse, extractLeadInfo, summarizeClient };
