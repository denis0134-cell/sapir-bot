const axios = require('axios');
const systemPromptTemplate = require('./systemPrompt');

function getSystemPrompt(isOwner) {
  let p = systemPromptTemplate.replace(
    'CALENDAR_LINK_PLACEHOLDER',
    process.env.CALENDAR_LINK || ''
  );
  if (isOwner) { p += " הפונה הנוכחי הוא דניס, הבעלים שלך. בפנייה הראשונה אליו פתחי: היי דניס, אני אלונה העוזרת האישית שלך."; } else { p += " הפונה הנוכחי הוא לקוח. בפנייה הראשונה אליו פתחי: היי, אני אלונה העוזרת האישית של דניס."; }
  return p;
}

async function generateResponse(conversationHistory, isOwner = false) {
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
                model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: getSystemPrompt(isOwner),
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
                model: 'claude-sonnet-4-5',
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

module.exports = { generateResponse, extractLeadInfo };
