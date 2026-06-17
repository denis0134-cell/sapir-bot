const axios = require('axios');

// System prompt optimized for generating reliable, valid HTML landing pages
const SYSTEM = `You are an expert HTML developer specializing in WhatsApp bot landing pages.
Generate a COMPLETE, VALID HTML page that will render correctly in all browsers.

CRITICAL RULES:
1. Start with <!DOCTYPE html>
2. All CSS must be inside <style> in <head> - properly closed with </style>
3. All content goes inside <body> tag - NEVER outside body
4. Do NOT use template literals or JavaScript-rendered content - use static HTML only
5. Close ALL tags properly
6. Use dark theme: background #0A0F0D, WhatsApp green #25D366
7. Hebrew RTL: html lang="he" dir="rtl"
8. Use Heebo font from Google Fonts
9. Return ONLY the HTML - no markdown, no backticks, no explanation

The page must include these sections IN ORDER:
- Nav (sticky, dark)
- Hero with WhatsApp chat mockup showing real conversation
- 4 pain point cards
- 6 feature cards in grid
- How it works (3 steps)
- Testimonials (2-3)
- Booking CTA
- Pricing
- FAQ accordion (JS powered)
- Footer`;

async function generateLandingPage(businessData) {
  const {
    businessName, ownerName, botDescription, targetAudience,
    features = [], phone, price, calendarLink, results = [],
    painPoints = [], chatMockup = {}
  } = businessData;

  const phoneDigits = String(phone || '972501234567').replace(/\D/g, '');
  const waLink = `https://wa.me/${phoneDigits}?text=${encodeURIComponent('היי, רוצה לשמוע על הבוט')}`;
  const calLink = calendarLink || '#';

  const prompt = `Build a complete HTML landing page for this WhatsApp bot service:

Business: ${businessName}
Owner: ${ownerName || businessName}
Bot does: ${botDescription || 'manages customer inquiries and bookings automatically'}
Target audience: ${targetAudience || 'business owners'}
Key features: ${features.length ? features.join(', ') : 'instant replies, appointment booking, lead qualification, FAQ automation'}
Pain points solved: ${painPoints.length ? painPoints.join(', ') : 'missed inquiries, repetitive questions, manual follow-ups'}
Price: ${price || 'custom pricing'}
WhatsApp: ${waLink}
Calendar booking: ${calLink}
Results/stats: ${results.length ? results.join(', ') : '90% less repetitive questions, 10+ hours saved per week, 24/7 availability'}
Chat example - user says: "${chatMockup.userMsg || 'שלום, כמה זה עולה?'}"
Chat example - bot replies: "${chatMockup.botMsg || 'היי! 👋 אשמח לעזור. המחיר מותאם לצרכי העסק שלך. רוצה שנקבע שיחת ייעוץ קצרה?'}"

Requirements:
- Hebrew RTL, Heebo font
- Dark WhatsApp-inspired theme (#0A0F0D background, #25D366 green)
- Animated chat mockup with CSS typing animation
- All CTAs link to: ${waLink}
- Booking links to: ${calLink}
- Static HTML only - NO JavaScript frameworks, NO dynamic rendering
- All sections must have visible text content`;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    let html = response.data.content[0].text.trim();

    // Clean markdown wrappers
    html = html.replace(/^```html\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    // Ensure starts with DOCTYPE
    if (!html.includes('<!DOCTYPE')) {
      const htmlStart = html.indexOf('<html');
      if (htmlStart > 0) html = '<!DOCTYPE html>\n' + html.substring(htmlStart);
      else html = '<!DOCTYPE html>\n' + html;
    }

    // Validate: check that body has content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (!bodyMatch || bodyMatch[1].trim().length < 100) {
      console.error('[LandingPage] Generated HTML has empty body, using fallback');
      return buildFallbackPage(businessData, waLink, calLink);
    }

    console.log('[LandingPage] Generated successfully, size:', html.length);
    return html;

  } catch (err) {
    console.error('[LandingPage] Generation error:', err.message);
    return buildFallbackPage(businessData, waLink, calLink);
  }
}

// Fallback page if Claude generation fails
function buildFallbackPage(data, waLink, calLink) {
  const { businessName = 'העסק שלך', botDescription = 'בוט WhatsApp חכם', phone = '' } = data;
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>בוט WhatsApp | ${businessName}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Heebo',sans-serif;background:#0A0F0D;color:#F0FFF4;direction:rtl}
nav{position:fixed;top:0;width:100%;background:rgba(10,15,13,0.97);border-bottom:1px solid rgba(37,211,102,0.2);padding:0 24px;display:flex;justify-content:space-between;align-items:center;height:60px;z-index:100}
.nav-brand{color:#25D366;font-size:18px;font-weight:800}
.nav-cta{background:#25D366;color:#000;padding:9px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px}
.hero{min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:100px 24px 60px;background:radial-gradient(ellipse at top,rgba(37,211,102,0.07),transparent 65%)}
h1{font-size:clamp(28px,5vw,52px);font-weight:900;line-height:1.2;margin-bottom:20px}
.green{color:#25D366}
.sub{font-size:17px;color:#6B8F71;max-width:600px;margin:0 auto 36px;line-height:1.7}
.cta-btn{display:inline-block;background:#25D366;color:#000;font-weight:800;padding:16px 36px;border-radius:12px;text-decoration:none;font-size:17px}
section{padding:80px 24px;max-width:1000px;margin:0 auto}
.sec-title{font-size:32px;font-weight:900;margin-bottom:40px;text-align:center}
.features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
.feature-card{background:#111A14;border:1px solid rgba(37,211,102,0.2);border-radius:16px;padding:28px}
.feature-icon{font-size:28px;margin-bottom:12px}
.feature-title{font-size:16px;font-weight:700;margin-bottom:8px;color:#F0FFF4}
.feature-desc{font-size:14px;color:#6B8F71;line-height:1.6}
.cta-section{text-align:center;padding:80px 24px}
footer{text-align:center;padding:40px 24px;border-top:1px solid rgba(37,211,102,0.15);color:#6B8F71;font-size:13px}
</style>
</head>
<body>
<nav>
  <div class="nav-brand">🤖 ${businessName}</div>
  <a href="${waLink}" class="nav-cta" target="_blank">🤖 קבל את הבוט ←</a>
</nav>
<div class="hero">
  <div>
    <h1>הלקוחות שלך מקבלים מענה<br><span class="green">מיידי — גם בשעה 3 בלילה</span></h1>
    <p class="sub">${botDescription}</p>
    <a href="${waLink}" class="cta-btn" target="_blank">💬 נסו את הבוט עכשיו ←</a>
  </div>
</div>
<section>
  <h2 class="sec-title">מה הבוט עושה?</h2>
  <div class="features-grid">
    <div class="feature-card"><div class="feature-icon">⚡</div><div class="feature-title">מענה מיידי 24/7</div><div class="feature-desc">לא עוד לקוחות שמחכים לתשובה. הבוט עונה תוך שניות בכל שעה.</div></div>
    <div class="feature-card"><div class="feature-icon">📅</div><div class="feature-title">ניהול תורים אוטומטי</div><div class="feature-desc">לקוחות קובעים, מקבלים אישור ותזכורת — בלי מגע אנושי.</div></div>
    <div class="feature-card"><div class="feature-icon">💰</div><div class="feature-title">שליחת הצעות מחיר</div><div class="feature-desc">הבוט שולח הצעות מחיר מותאמות אישית תוך שניות.</div></div>
    <div class="feature-card"><div class="feature-icon">🔄</div><div class="feature-title">פולו-אפ אוטומטי</div><div class="feature-desc">הבוט עוקב אחרי לידים ולא מאפשר ללקוחות לאבד עניין.</div></div>
    <div class="feature-card"><div class="feature-icon">❓</div><div class="feature-title">שאלות נפוצות</div><div class="feature-desc">עונה על 90% מהשאלות החוזרות — ומפנה לנציג רק כשצריך.</div></div>
    <div class="feature-card"><div class="feature-icon">📊</div><div class="feature-title">דיווחים ולידים</div><div class="feature-desc">כל ליד נשמר, מסומן ומדווח לך בזמן אמת.</div></div>
  </div>
</section>
<div class="cta-section">
  <h2 style="font-size:32px;font-weight:900;margin-bottom:16px">רוצה בוט כזה לעסק שלך?</h2>
  <p style="color:#6B8F71;margin-bottom:28px;font-size:16px">שיחת ייעוץ של 20 דקות — ומבינים מה מתאים לך</p>
  <a href="${calLink !== '#' ? calLink : waLink}" class="cta-btn" target="_blank">📅 קבע שיחת ייעוץ חינם ←</a>
</div>
<footer>© 2025 ${businessName} · כל הזכויות שמורות</footer>
</body>
</html>`;
}

module.exports = { generateLandingPage };
