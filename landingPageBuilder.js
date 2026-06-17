const axios = require('axios');

// Skill content - the full instructions for building landing pages
const LANDING_SKILL = `
אתה מומחה לבניית דפי נחיתה HTML בעברית RTL.
בנה דף נחיתה מלא ומקצועי עבור העסק לפי הפרטים שמסופקים.

# מערכת צבעים (Dark Theme — חובה)
:root {
  --bg: #0A0F0D; --bg2: #111A14; --card: #162119;
  --wa-green: #25D366; --wa-dark: #128C7E;
  --wa-light: rgba(37,211,102,0.12); --wa-border: rgba(37,211,102,0.25);
  --white: #F0FFF4; --muted: #6B8F71; --border: rgba(37,211,102,0.15);
}

# מבנה חובה (לפי הסדר)
1. Nav sticky (שם + CTA)
2. Hero עם WhatsApp Chat Mockup מונפש בצד
3. Pain Points (3-4 כאבים ספציפיים לעסק)
4. Features Grid (6 תכונות)  
5. How It Works (3-4 שלבים)
6. Results (מספרים)
7. Booking CTA (חובה לפני מחיר!)
8. Pricing
9. FAQ Accordion (5 שאלות)
10. Footer

# Chat Mockup (חובה — מונפש)
- רקע: #0B141A
- header: #202C33
- הודעת משתמש: background #202C33
- הודעת בוט: background #005C4B
- typing indicator עם animation

# כללים
- direction: rtl, font: Heebo
- כל CTA בירוק עם glow
- Booking לפני pricing
- Chat mockup מותאם לעסק ספציפי (לא גנרי)
- קובץ יחיד HTML+CSS+JS
- IntersectionObserver על reveal elements

החזר קוד HTML מלא בלבד — ללא הסבר.
`;

async function generateLandingPage(businessData) {
  const {
    businessName,
    ownerName,
    botDescription,
    targetAudience,
    features = [],
    phone,
    price,
    calendarLink,
    results = [],
    painPoints = []
  } = businessData;

  const prompt = `בנה דף נחיתה HTML מלא לפי הפרטים:

שם העסק: ${businessName}
שם הבעלים: ${ownerName || ''}
תיאור הבוט: ${botDescription}
קהל יעד: ${targetAudience}
תכונות: ${features.join(', ')}
מחיר: ${price || 'מותאם אישית'}
טלפון/WhatsApp: ${phone || ''}
Calendar לשריון: ${calendarLink || ''}
תוצאות/מספרים: ${results.join(', ') || 'זמן תגובה 24/7, חיסכון 10+ שעות/שבוע'}
כאבים שהבוט פותר: ${painPoints.join(', ')}

דרישות:
- Chat mockup מותאם לעסק (${businessName}) עם שאלות אמיתיות של לקוחות
- Dark theme עם ירוק WhatsApp
- CTA ל: wa.me/${(phone||'972501234567').replace(/\D/g,'')}
- Calendar: ${calendarLink || '#'}
- RTL עברית מלא
- כל הסקשנים לפי הסדר הנכון
- Chat mockup עם animation`;

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: LANDING_SKILL,
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

  let html = response.data.content[0].text.trim();
  // Clean up if wrapped in markdown
  html = html.replace(/^```html\n?/i, '').replace(/\n?```$/i, '').trim();
  if (!html.startsWith('<!DOCTYPE') && !html.startsWith('<html')) {
    const start = html.indexOf('<!DOCTYPE');
    if (start !== -1) html = html.substring(start);
  }
  return html;
}

module.exports = { generateLandingPage };
