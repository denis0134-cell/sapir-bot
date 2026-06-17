function generateProposalHTML(data) {
  const {
    clientName = 'לקוח יקר',
    clientProfession = '',
    clientBusiness = '',
    clientRoles = [],
    currentRevenue = null,
    targetRevenue = null,
    goal = '',
    painPoints = [],
    program = 'BOTH',
    price = '24,900',
    originalPrice = null,
    calendarLink = process.env.CALENDAR_LINK,
    clientPhotoUrl = null,
    socialUrl = null,
    personalMessage = null
  } = data;

  const showABM = program === 'ABM' || program === 'BOTH';
  const showLDB = program === 'LDB' || program === 'BOTH';
  const programTitle = program === 'BOTH' ? "AI Business Mastery × Let's Do Business"
    : program === 'ABM' ? 'AI Business Mastery' : "Let's Do Business";

  const savings = originalPrice && originalPrice !== price
    ? `<div class="price-saving">חיסכון של ₪${(parseInt(originalPrice.replace(/,/g,'')) - parseInt(price.replace(/,/g,''))).toLocaleString('he-IL')}!</div>`
    : '';

  const defaultPainPoints = [
    { icon: '⏸️', title: 'כשאתה עוצר — העסק עוצר', desc: 'כל ההכנסה תלויה בנוכחות שלך. חופשה, מחלה, מנוחה — ותיכף מרגישים בקופה.' },
    { icon: '🔒', title: 'תקרת הכנסה שקשה לשבור', desc: 'אפשר לעבוד קצת יותר, אבל השעות הן שעות. קשה לצמוח בלי מודל שונה.' },
    { icon: '⚙️', title: 'וואן מן שואו', desc: 'שיווק, מכירות, ניהול, תיאומים — הכל עובר דרכך. לא נשאר זמן לדברים החשובים.' },
    { icon: '😰', title: 'AI נשמע רחוק', desc: 'שומעים על AI בכל מקום, אבל זה נראה מסובך ורחוק מהעסק שלך.' },
    { icon: '🧠', title: 'ידע שנשאר בראש', desc: 'שנים של ניסיון ושיטות — אבל הידע לא הפך עדיין לנכס שמרוויח לבד.' },
    { icon: '⏱️', title: 'הזמן רץ והחלום מחכה', desc: 'אתה יודע שהצמיחה אפשרית — אבל אין זמן ולא ברור מאיפה להתחיל.' }
  ];

  const displayPainPoints = painPoints.length > 0
    ? painPoints.map(p => typeof p === 'string' ? { icon: '⚡', title: p, desc: '' } : p)
    : defaultPainPoints;

  const rolesBadges = clientRoles.length > 0
    ? clientRoles.map(r => `<span class="role-badge">${r}</span>`).join('')
    : clientProfession ? `<span class="role-badge">💼 ${clientProfession}</span><span class="role-badge">🤖 AI שעובד בשבילך — חדש!</span>` : '';

  const clientPhoto = clientPhotoUrl
    ? `<div class="client-photo-wrap"><img src="${clientPhotoUrl}" class="client-photo" alt="${clientName}" onerror="this.style.display='none'"></div>`
    : '';

  const saMessage = personalMessage ||
    `${clientName} יקרה, ראיתי בדיוק את הפוטנציאל שלך. השליחות שלך לשנות חיים — בדיוק זה מה שאנחנו עושים כאן. בואי נבנה יחד את המנגנון שיאפשר לך לעשות את זה בגדול.`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>הצעה אישית ל${clientName} | מכללת ספיר זיסמן</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://unpkg.com/aos@2.3.1/dist/aos.css">
<style>
:root{--gold:#D4AF37;--gold2:#F5D078;--gg:linear-gradient(135deg,#D4AF37,#F5D078,#D4AF37);--bg:#0a0a0a;--card:#111;--card2:#161616;--text:#fff;--muted:#888;--border:rgba(212,175,55,0.2)}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Heebo',sans-serif;background:var(--bg);color:var(--text);direction:rtl}
nav{position:fixed;top:0;width:100%;z-index:100;background:rgba(10,10,10,0.96);border-bottom:1px solid var(--border);padding:0 20px;display:flex;justify-content:space-between;align-items:center;height:64px;backdrop-filter:blur(10px)}
.nav-logo{display:flex;align-items:center;gap:10px}
.nav-logo img{height:32px;filter:brightness(0) invert(1)}
.nav-logo span{color:var(--gold);font-size:16px;font-weight:700}
.nav-cta{background:var(--gg);color:#000;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;white-space:nowrap}

/* HERO */
.hero{min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:100px 20px 60px;background:radial-gradient(ellipse at top,rgba(212,175,55,0.08) 0%,transparent 60%)}
.hero-label{display:inline-block;color:var(--gold);font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;border:1px solid var(--border);padding:6px 16px;border-radius:20px}
.hero h1{font-size:clamp(26px,4.5vw,52px);font-weight:900;line-height:1.25;max-width:820px;margin:0 auto 20px}
.hero h1 span{background:var(--gg);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero-sub{font-size:17px;color:#ccc;max-width:620px;margin:0 auto 28px;line-height:1.7}
.client-photo-wrap{margin:0 auto 24px;width:90px;height:90px;border-radius:50%;border:3px solid var(--gold);overflow:hidden}
.client-photo{width:100%;height:100%;object-fit:cover}
.roles-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:28px}
.role-badge{background:rgba(212,175,55,0.1);border:1px solid var(--border);color:var(--gold);font-size:13px;font-weight:600;padding:7px 16px;border-radius:20px}
.hero-stats{display:flex;gap:32px;justify-content:center;flex-wrap:wrap;margin-bottom:36px}
.hero-stat{text-align:center}
.hero-stat .num{font-size:32px;font-weight:900;color:var(--gold)}
.hero-stat .lbl{font-size:12px;color:var(--muted);margin-top:4px}
.cta-btn{display:inline-block;background:var(--gg);color:#000;font-weight:800;padding:18px 40px;border-radius:12px;text-decoration:none;font-size:18px;transition:transform .2s,box-shadow .2s}
.cta-btn:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(212,175,55,0.4)}

/* SECTIONS */
section{padding:80px 20px;max-width:1000px;margin:0 auto}
.sec-label{color:var(--gold);font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:12px}
.sec-title{font-size:clamp(22px,4vw,38px);font-weight:900;line-height:1.3;margin-bottom:12px}
.sec-sub{color:#aaa;font-size:16px;margin-bottom:40px;max-width:600px}
.gold-text{background:var(--gg);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.divider{height:1px;background:var(--border);margin:0 20px}

/* PAIN POINTS */
.pain-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
.pain-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:28px;transition:border-color .3s}
.pain-card:hover{border-color:rgba(212,175,55,0.5)}
.pain-icon{font-size:32px;margin-bottom:12px}
.pain-title{font-size:16px;font-weight:700;margin-bottom:8px}
.pain-desc{color:var(--muted);font-size:14px;line-height:1.6}

/* GUARANTEE */
.guarantee-bar{background:rgba(212,175,55,0.1);border:1px solid var(--border);border-radius:16px;padding:20px 28px;display:flex;align-items:center;gap:16px;margin:0 20px 60px;flex-wrap:wrap}

/* SAPIR MESSAGE */
.sapir-msg{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:32px;display:flex;gap:20px;align-items:flex-start;max-width:780px;margin:0 auto}
.sapir-avatar{width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--gold);flex-shrink:0}
.sapir-avatar-placeholder{width:80px;height:80px;border-radius:50%;background:var(--gg);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:#000;flex-shrink:0}
.sapir-msg-text{font-size:16px;line-height:1.7;color:#ddd;font-style:italic}
.sapir-msg-name{font-size:14px;font-weight:700;color:var(--gold);margin-top:12px}

/* PROGRAMS */
.programs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:30px}
.program-card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:32px}
.program-card.featured{border-color:var(--gold);background:linear-gradient(135deg,rgba(212,175,55,0.08),var(--card))}
.prog-track{font-size:11px;font-weight:700;letter-spacing:2px;color:var(--gold);margin-bottom:8px}
.prog-title{font-size:22px;font-weight:800;margin-bottom:6px}
.prog-sub{font-size:13px;color:var(--muted);margin-bottom:24px;line-height:1.5}
.prog-features{list-style:none;display:flex;flex-direction:column;gap:10px}
.prog-features li{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#ddd}
.prog-features li::before{content:'✓';color:var(--gold);font-weight:700;margin-top:1px;flex-shrink:0}

/* PRICING */
.pricing-card{background:var(--card);border:2px solid var(--gold);border-radius:24px;padding:40px;max-width:600px;margin:0 auto;text-align:center}
.price-original{font-size:16px;color:var(--muted);text-decoration:line-through;margin-bottom:4px}
.price-label{font-size:12px;font-weight:700;letter-spacing:2px;color:var(--gold);margin-bottom:12px;text-transform:uppercase}
.price-amount{font-size:clamp(40px,8vw,64px);font-weight:900;color:var(--gold);line-height:1}
.price-vat{font-size:14px;color:var(--muted);margin-bottom:6px;margin-top:4px}
.price-saving{display:inline-block;background:rgba(212,175,55,0.15);border:1px solid var(--gold);color:var(--gold);font-size:14px;font-weight:700;padding:6px 16px;border-radius:20px;margin-bottom:28px}
.price-features{list-style:none;text-align:right;display:flex;flex-direction:column;gap:10px;margin-bottom:32px}
.price-features li{display:flex;align-items:center;gap:10px;font-size:14px}
.price-features li .check{color:var(--gold);font-weight:700;flex-shrink:0}

/* VIDEO */
.video-wrap{position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:16px;border:1px solid var(--border)}
.video-wrap iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}

/* FAQ */
.faq-item{background:var(--card);border:1px solid var(--border);border-radius:12px;margin-bottom:12px;overflow:hidden}
.faq-q{padding:20px 24px;font-weight:600;cursor:pointer;display:flex;justify-content:space-between;align-items:center}
.faq-q:hover{color:var(--gold)}
.faq-icon{color:var(--gold);font-size:20px;flex-shrink:0}
.faq-a{padding:0 24px 20px;color:#aaa;font-size:14px;line-height:1.7;display:none}
.faq-item.open .faq-a{display:block}
.faq-item.open .faq-icon{transform:rotate(45deg)}

/* ABOUT */
.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
@media(max-width:600px){.about-grid{grid-template-columns:1fr}}
.about-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:28px;text-align:center}
.about-avatar{width:80px;height:80px;background:var(--gg);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 16px}
.about-name{font-size:20px;font-weight:800;margin-bottom:4px}
.about-role{font-size:13px;color:var(--gold);margin-bottom:12px;font-weight:600}
.about-desc{font-size:13px;color:#aaa;line-height:1.6}
.about-stats{display:flex;gap:12px;justify-content:center;margin-top:16px;flex-wrap:wrap}
.about-stat{font-size:12px;background:rgba(212,175,55,0.1);border:1px solid var(--border);padding:4px 12px;border-radius:20px;color:var(--gold);font-weight:600}

footer{text-align:center;padding:40px 20px;border-top:1px solid var(--border);color:var(--muted);font-size:13px}
.footer-logo{color:var(--gold);font-weight:700;font-size:16px;margin-bottom:8px}
</style>
</head>
<body>
<nav>
  <div class="nav-logo">
    <img src="https://ldb.sapzis.co.il/wp-content/uploads/2024/07/lets-do-businnes-logo-white.png" alt="ספיר זיסמן" onerror="this.style.display='none'">
    <span>מכללת ספיר זיסמן</span>
  </div>
  <a href="${calendarLink}" class="nav-cta" target="_blank">שריין שיחה ←</a>
</nav>

<!-- HERO -->
<div class="hero">
  <div>
    <div class="hero-label" data-aos="fade-down">הצעה אישית — הוכנה עבורך, ${clientName}</div>
    ${clientPhoto}
    ${rolesBadges ? `<div class="roles-row" data-aos="fade-up" data-aos-delay="50">${rolesBadges}</div>` : ''}
    <h1 data-aos="fade-up" data-aos-delay="100">
      ${clientProfession || clientBusiness ? `${clientProfession || clientBusiness} — ` : ''}הגיע הזמן שה-AI<br>
      <span>יעבוד בשבילך גם כשאתה לא.</span>
    </h1>
    <p class="hero-sub" data-aos="fade-up" data-aos-delay="150">${goal || 'הידע, הכלים והמנטורינג הנכון — כדי שתוכל לצמוח מעבר לשעות שלך.'}</p>
    ${currentRevenue ? `
    <div class="hero-stats" data-aos="fade-up" data-aos-delay="200">
      <div class="hero-stat"><div class="num">₪${currentRevenue}</div><div class="lbl">הכנסה נוכחית</div></div>
      <div class="hero-stat"><div class="num">90 יום</div><div class="lbl">לתוצאה מוכחת</div></div>
      ${targetRevenue ? `<div class="hero-stat"><div class="num">₪${targetRevenue}</div><div class="lbl">הפוטנציאל שלך</div></div>` : ''}
    </div>` : ''}
    <a href="${calendarLink}" class="cta-btn" data-aos="zoom-in" data-aos-delay="250" target="_blank">📅 שריין שיחה עם דניס ←</a>
  </div>
</div>

<!-- GUARANTEE -->
<div style="max-width:1000px;margin:0 auto">
  <div class="guarantee-bar" data-aos="fade-up">
    <span style="font-size:28px">🔒</span>
    <span style="font-size:15px;font-weight:600">מכפילים את מחזור ההכנסות ב-90 יום — או מחזירים כל שקל. בכתב. ללא תנאים נסתרים.</span>
  </div>
</div>

<!-- PAIN POINTS -->
<section>
  <div class="sec-label" data-aos="fade-right">בואי נדבר בכנות</div>
  <h2 class="sec-title" data-aos="fade-right" data-aos-delay="50">את מכירה את<br><span class="gold-text">התחושות האלה?</span></h2>
  <p class="sec-sub" data-aos="fade-right" data-aos-delay="100">אלו הדפוסים שאנחנו שומעים מכל בעלי העסקים שמגיעים אלינו.</p>
  <div class="pain-grid">
    ${displayPainPoints.map((p, i) => `
    <div class="pain-card" data-aos="fade-up" data-aos-delay="${i * 70}">
      <div class="pain-icon">${p.icon || '⚡'}</div>
      <div class="pain-title">${p.title}</div>
      ${p.desc ? `<div class="pain-desc">${p.desc}</div>` : ''}
    </div>`).join('')}
  </div>
</section>

<div class="divider"></div>

<!-- SAPIR PERSONAL MESSAGE -->
<section style="text-align:center">
  <div class="sec-label" data-aos="fade-up">מסר אישי מספיר</div>
  <h2 class="sec-title" data-aos="fade-up" data-aos-delay="50">ספיר <span class="gold-text">שלחה לך הודעה</span></h2>
  <div class="sapir-msg" data-aos="fade-up" data-aos-delay="100">
    <div class="sapir-avatar-placeholder">ס</div>
    <div>
      <div class="sapir-msg-text">"${saMessage}"</div>
      <div class="sapir-msg-name">— ספיר זיסמן, מייסדת המכללה</div>
    </div>
  </div>
</section>

<div class="divider"></div>

<!-- PROGRAMS -->
<section>
  <div class="sec-label" data-aos="fade-right">מה מקבלים</div>
  <h2 class="sec-title" data-aos="fade-right" data-aos-delay="50"><span class="gold-text">שני מסלולים</span> — שלובים בשבילך</h2>
  <div class="programs-grid">
    ${showLDB ? `
    <div class="program-card featured" data-aos="fade-up">
      <div class="prog-track">TRACK 01</div>
      <div class="prog-title">Let's Do Business</div>
      <div class="prog-sub">ליווי עסקי מלא להכפלת המחזור</div>
      <ul class="prog-features">
        <li>4 פגישות פיצוח 1×1 אישיות</li>
        <li>12 זומים שבועיים עם מומחים</li>
        <li>תמיכה יומיומית בוואטסאפ</li>
        <li>20+ קורסים — גישה לכל החיים</li>
        <li>ארגז כלים: תסריטים, אקסלים, חוזים</li>
        <li>כרטיס VIP לסמינר שנתי</li>
      </ul>
    </div>` : ''}
    ${showABM ? `
    <div class="program-card ${!showLDB ? 'featured' : ''}" data-aos="fade-up" data-aos-delay="100">
      <div class="prog-track">TRACK 02</div>
      <div class="prog-title">AI Business Mastery</div>
      <div class="prog-sub">6 שבועות של הטמעת AI מעשית</div>
      <ul class="prog-features">
        <li>6 מפגשי לייב (2+ שעות כל אחד)</li>
        <li>מנטור אישי + 6 שיחות 1×1</li>
        <li>The AI Toolkit — כל הפרומפטים</li>
        <li>6 מאסטר-קלאסים: שיווק, מכירות, AI</li>
        <li>קהילת WhatsApp חלוצי AI</li>
        <li>כרטיס VIP לסמינר עסקים</li>
      </ul>
    </div>` : ''}
  </div>
</section>

<div class="divider"></div>

<!-- BOOKING CTA -->
<section style="text-align:center">
  <div class="sec-label" data-aos="fade-up">הצעד הבא</div>
  <h2 class="sec-title" data-aos="fade-up" data-aos-delay="50">שריין שיחה עם דניס<br><span class="gold-text">— 20 דקות שישנו הכל</span></h2>
  <p class="sec-sub" style="margin:0 auto 40px" data-aos="fade-up" data-aos-delay="100">שיחה חינמית, ממוקדת, ללא מחויבות. דניס ייבנה הצעה אישית שמתאימה לך בדיוק.</p>
  <a href="${calendarLink}" class="cta-btn" target="_blank" data-aos="zoom-in" data-aos-delay="150">📅 שריין שיחה עם דניס ←</a>
</section>

<div class="divider"></div>

<!-- ABOUT -->
<section>
  <div class="sec-label" data-aos="fade-right">האנשים שמלווים אותך</div>
  <h2 class="sec-title" data-aos="fade-right" data-aos-delay="50">ספיר ואיתי —<br><span class="gold-text">יד ביד איתך</span></h2>
  <div class="about-grid" data-aos="fade-up" data-aos-delay="100">
    <div class="about-card">
      <div class="about-avatar">ס</div>
      <div class="about-name">ספיר זיסמן</div>
      <div class="about-role">יזמית, מאסטר NLP, מייסדת LDB</div>
      <div class="about-desc">מאסטר NLP שהוכשרה על ידי ד"ר ריצ'רד בנדלר. 120K+ עוקבים. מייסדת מכללה המתמחה בפיתוח עסקי ואישי.</div>
      <div class="about-stats"><span class="about-stat">120K+ עוקבים</span><span class="about-stat">מאסטר NLP</span></div>
    </div>
    <div class="about-card">
      <div class="about-avatar">א</div>
      <div class="about-name">איתי סלע</div>
      <div class="about-role">יזם, מומחה AI ואוטומציות</div>
      <div class="about-desc">יזם בן 33, גייס הון ל-2 סטארטאפים, מנהל קמפיינים לחברות הגדולות בישראל. מפתח ExtraBe עם AI.</div>
      <div class="about-stats"><span class="about-stat">2 סטארטאפים</span><span class="about-stat">מומחה AI</span></div>
    </div>
  </div>
</section>

<div class="divider"></div>

<!-- TESTIMONIALS VIDEO -->
<section style="text-align:center">
  <div class="sec-label" data-aos="fade-up">הם כבר עשו את זה</div>
  <h2 class="sec-title" data-aos="fade-up" data-aos-delay="50">סיפורי הצלחה <span class="gold-text">אמיתיים</span></h2>
  <div style="max-width:700px;margin:0 auto 32px" data-aos="fade-up" data-aos-delay="100">
    <div class="video-wrap">
      <iframe src="https://player.vimeo.com/video/1035248852?badge=0&autopause=0&player_id=0&app_id=58479" allow="autoplay; fullscreen; picture-in-picture" title="testimonials"></iframe>
    </div>
  </div>
  <a href="https://www.sapzis.co.il/סיפורי-הצלחה/" target="_blank" class="cta-btn" style="font-size:15px;padding:14px 28px" data-aos="fade-up" data-aos-delay="150">ראה עוד סיפורי הצלחה ←</a>
</section>

<div class="divider"></div>

<!-- PRICING -->
<section>
  <div class="sec-label" style="text-align:center" data-aos="fade-up">ההצעה האישית שלך</div>
  <h2 class="sec-title" style="text-align:center" data-aos="fade-up" data-aos-delay="50"><span class="gold-text">הכל ביחד</span> — בהצעה אחת</h2>
  <div class="pricing-card" data-aos="zoom-in" data-aos-delay="100">
    <div class="price-label">הצעה אישית ל${clientName} — ${programTitle}</div>
    ${originalPrice && originalPrice !== price ? `<div class="price-original">מחיר רגיל: ₪${originalPrice}</div>` : ''}
    <div class="price-amount">₪${price}</div>
    <div class="price-vat">כולל מע"מ | ניתן לפריסה לתשלומים</div>
    ${savings}
    <ul class="price-features">
      ${showABM ? `
      <li><span class="check">✓</span> 6 מפגשי לייב AI (2+ שעות כל אחד)</li>
      <li><span class="check">✓</span> מנטור אישי + 6 שיחות 1×1 שבועיות</li>
      <li><span class="check">✓</span> The AI Toolkit: פרומפטים ואוטומציות</li>` : ''}
      ${showLDB ? `
      <li><span class="check">✓</span> 4 פגישות פיצוח 1×1 אישיות</li>
      <li><span class="check">✓</span> 12 זומים קבוצתיים שבועיים</li>
      <li><span class="check">✓</span> תמיכה יומיומית בוואטסאפ</li>
      <li><span class="check">✓</span> 20+ קורסים — גישה לכל החיים</li>
      <li><span class="check">✓</span> ארגז כלים מלא</li>` : ''}
      <li><span class="check">✓</span> 🔒 ערבות: הכפלת מחזור ב-90 יום או החזר מלא</li>
    </ul>
    <a href="${calendarLink}" class="cta-btn" target="_blank" style="display:block;width:100%;text-align:center">📅 שריין שיחה עם דניס ←</a>
  </div>
</section>

<div class="divider"></div>

<!-- FAQ -->
<section>
  <div class="sec-label" data-aos="fade-right">שאלות שאולי יש לך</div>
  <h2 class="sec-title" data-aos="fade-right" data-aos-delay="50">שאלות נפוצות <span class="gold-text">— בשבילך</span></h2>
  <div data-aos="fade-up" data-aos-delay="100">
    ${[
      ['האם צריך ידע טכנולוגי?','לא. בכלל לא. המנטור האישי שלך ילווה אותך צעד אחר צעד, בקצב שלך.'],
      ['כמה זמן בשבוע צריך?','מפגש שבועי + עבודה עצמית קצרה. בנינו את זה לבעלי עסקים עסוקים.'],
      ['מה קורה אם לא מבין משהו?','יש מנטור אישי שנמצא לצד שלך. לא מסתדרים לבד. כל שאלה — יש מי שעונה.'],
      ['ניתן לפרוס לתשלומים?','כן. דניס ימצא איתך את הפתרון הפיננסי שמתאים לך.'],
      ['מה הערבות בדיוק?','מכפילים מחזור ב-90 יום — או מחזירים כל שקל. בכתב. ללא תנאים נסתרים.'],
    ].map(([q,a]) => `
    <div class="faq-item">
      <div class="faq-q">${q} <span class="faq-icon">+</span></div>
      <div class="faq-a">${a}</div>
    </div>`).join('')}
  </div>
</section>

<section style="text-align:center;padding-bottom:100px">
  <h2 class="sec-title" data-aos="fade-up">מוכן/ה להתחיל?<br><span class="gold-text">שריין שיחה עכשיו.</span></h2>
  <div style="margin-top:32px" data-aos="zoom-in" data-aos-delay="100">
    <a href="${calendarLink}" class="cta-btn" target="_blank">📅 שריין שיחה עם דניס ←</a>
  </div>
</section>

<footer>
  <div class="footer-logo">מכללת ספיר זיסמן</div>
  <div>${programTitle} | הצעה אישית ל${clientName}</div>
  <div style="margin-top:8px">© 2025 כל הזכויות שמורות</div>
</footer>

<script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
<script>
AOS.init({duration:700,once:true,offset:60});
document.querySelectorAll('.faq-q').forEach(q=>{q.addEventListener('click',()=>q.parentElement.classList.toggle('open'))});
</script>
</body>
</html>`;
}

module.exports = { generateProposalHTML };
