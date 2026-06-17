const axios = require('axios');

// Use Claude to understand what Denis wants
async function detectAdminIntent(text, lastClientPhone, namedLeads) {
  const leadsContext = namedLeads.slice(0, 20)
    .map(l => `${l.name} (${l.phone}) - ${l.status}`)
    .join('\n');

  const system = `אתה עוזר של דניס, איש מכירות.
דניס שולח הודעות שיכולות להיות אחת מהאפשרויות:

1. בקשת סיכום על לקוח מהמאגר (לפי שם)
2. בקשת סיכום על לקוח חדש (מידע גולמי)
3. עדכון פרטי לקוח (הוספת טלפון, שם, מידע)
4. בקשת הצעת מחיר
5. הודעה שאינה קשורה

לקוח אחרון שנדון: ${lastClientPhone || 'אין'}

לקוחות שמורים במערכת:
${leadsContext || 'אין עדיין'}

החזר JSON בלבד:
{
  "intent": "lookup | summarize_new | update_lead | proposal | other",
  "clientName": null,
  "phone": null,
  "newPhone": null,
  "extraInfo": null
}

lookup = חיפוש לקוח קיים לפי שם
summarize_new = סיכום טקסט גולמי על לקוח חדש
update_lead = הוספת/עדכון פרטים ללקוח האחרון שנדון
proposal = בניית הצעת מחיר
other = אחר`;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system,
        messages: [{ role: 'user', content: text }]
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
    console.error('[AdminIntent] error:', err.message);
    return { intent: 'other' };
  }
}

module.exports = { detectAdminIntent };
