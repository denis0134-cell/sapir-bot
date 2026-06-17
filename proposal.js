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
    denisPhotoUrl = null,
    headline = null,
    subheadline = null,
    highlightPhrase = null
  } = data;

  const showABM = program === 'ABM' || program === 'BOTH';
  const showLDB = program === 'LDB' || program === 'BOTH';
  const programTitle = program === 'BOTH' ? "AI Business Mastery × Let's Do Business"
    : program === 'ABM' ? 'AI Business Mastery' : "Let's Do Business";

  // Build hero headline with highlight
  const heroHeadline = headline || `${clientName}, הגיע הזמן שה-AI יעבוד בשבילך גם כשאתה לא.`;
  const heroSub = subheadline || (goal ? goal : 'הידע והניסיון שלך — זה הבסיס. עכשיו הגיע הזמן לבנות מנגנון שמביא לקוחות, מוכר ומנהל בלי שתצטרך להיות שם כל הזמן.');
  const hlPhrase = highlightPhrase || 'הגיע הזמן שה-AI';

  // Highlight phrase in headline
  const heroHeadlineHTML = hlPhrase && heroHeadline.includes(hlPhrase)
    ? heroHeadline.replace(hlPhrase, `<span class="teal-text">${hlPhrase}</span>`)
    : heroHeadline;

  // Role badges
  const rolesArr = clientRoles.length > 0 ? clientRoles
    : clientProfession ? [`💼 ${clientProfession}`, '🤖 AI שעובד בשבילך — חדש!']
    : [];

  // Pain points
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

  // Stats row
  const statsHTML = (currentRevenue || targetRevenue) ? `
  <div class="stats-row">
    ${currentRevenue ? `<div class="stat-box"><div class="stat-num red-text">₪${currentRevenue}</div><div class="stat-lbl">הכנסה נוכחית</div></div>` : ''}
    ${targetRevenue ? `<div class="stat-box"><div class="stat-num teal-text">₪${targetRevenue}</div><div class="stat-lbl">מה שצריך להתקיים</div></div>` : ''}
    <div class="stat-box"><div class="stat-num">מאות K</div><div class="stat-lbl">הפוטנציאל האמיתי שלך</div></div>
    <div class="stat-box"><div class="stat-num">6 שבועות</div><div class="stat-lbl">לבנות מנגנון שעובד</div></div>
  </div>` : '';

  // Pricing
  const origNum = originalPrice ? parseInt(String(originalPrice).replace(/,/g,'')) : null;
  const priceNum = parseInt(String(price).replace(/,/g,''));
  const savingsAmount = origNum && origNum > priceNum ? (origNum - priceNum).toLocaleString('he-IL') : null;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>הצעה אישית ל${clientName} | מכללת ספיר זיסמן</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://unpkg.com/aos@2.3.1/dist/aos.css">
<style>
:root{--gold:#D4AF37;--gold2:#F5D078;--teal:#4ECDC4;--gg:linear-gradient(135deg,#D4AF37,#F5D078,#D4AF37);--bg:#0a0a0a;--card:#111;--card2:#161616;--text:#fff;--muted:#888;--border:rgba(212,175,55,0.2)}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Heebo',sans-serif;background:var(--bg);color:var(--text);direction:rtl}

/* NAV */
nav{position:fixed;top:0;width:100%;z-index:100;background:rgba(10,10,10,0.97);border-bottom:1px solid var(--border);padding:0 24px;display:flex;justify-content:space-between;align-items:center;height:64px;backdrop-filter:blur(12px)}
.nav-left{display:flex;align-items:center;gap:10px}
.nav-logo-img{height:36px}
.nav-logo-txt{color:var(--gold);font-size:15px;font-weight:700}
.nav-cta{background:var(--gg);color:#000;font-weight:800;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:14px;white-space:nowrap}

/* HERO */
.hero{min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:110px 24px 70px;background:radial-gradient(ellipse at top,rgba(212,175,55,0.07) 0%,transparent 65%)}
.hero-inner{max-width:860px}
.hero-pill{display:inline-flex;align-items:center;gap:8px;color:var(--gold);font-size:13px;font-weight:600;letter-spacing:1px;border:1px solid rgba(212,175,55,0.4);padding:7px 18px;border-radius:20px;margin-bottom:28px}
.hero-pill span{width:7px;height:7px;background:var(--gold);border-radius:50%;display:inline-block}
.hero h1{font-size:clamp(28px,4.8vw,56px);font-weight:900;line-height:1.2;margin-bottom:24px;letter-spacing:-0.5px}
.gold-text{background:var(--gg);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.teal-text{color:var(--teal) !important;-webkit-text-fill-color:var(--teal) !important}
.red-text{color:#FF6B6B}
.hero-sub{font-size:17px;color:#bbb;line-height:1.75;margin-bottom:32px;max-width:680px;margin-left:auto;margin-right:auto}

/* CLIENT PHOTO */
.client-photo-row{display:flex;justify-content:center;margin-bottom:24px}
.client-photo{width:88px;height:88px;border-radius:50%;object-fit:cover;border:3px solid var(--gold);box-shadow:0 0 20px rgba(212,175,55,0.3)}

/* ROLES */
.roles-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:32px}
.role-badge{background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.3);color:var(--gold);font-size:13px;font-weight:600;padding:7px 18px;border-radius:20px}

/* STATS */
.stats-row{display:flex;gap:0;justify-content:center;margin-bottom:36px;flex-wrap:wrap;border:1px solid var(--border);border-radius:16px;overflow:hidden;max-width:700px;margin-left:auto;margin-right:auto}
.stat-box{flex:1;min-width:120px;padding:18px 12px;text-align:center;border-left:1px solid var(--border)}
.stat-box:last-child{border-left:none}
.stat-num{font-size:26px;font-weight:900;color:var(--gold)}
.stat-lbl{font-size:11px;color:var(--muted);margin-top:4px}

/* CTA */
.cta-btn{display:inline-block;background:var(--gg);color:#000;font-weight:800;padding:18px 44px;border-radius:12px;text-decoration:none;font-size:18px;transition:transform .2s,box-shadow .2s}
.cta-btn:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(212,175,55,0.45)}

/* SECTIONS */
.section{padding:80px 24px;max-width:1000px;margin:0 auto}
.sec-label{color:var(--gold);font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.sec-label::after{content:'';flex:1;height:1px;background:var(--border)}
.sec-title{font-size:clamp(22px,3.8vw,38px);font-weight:900;line-height:1.3;margin-bottom:12px}
.sec-sub{color:#aaa;font-size:16px;margin-bottom:44px;max-width:580px;line-height:1.6}
.divider{height:1px;background:var(--border)}

/* PAIN POINTS */
.pain-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
.pain-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:28px;transition:border-color .3s,transform .2s}
.pain-card:hover{border-color:rgba(212,175,55,0.5);transform:translateY(-2px)}
.pain-icon{font-size:30px;margin-bottom:12px}
.pain-title{font-size:15px;font-weight:700;margin-bottom:8px}
.pain-desc{color:var(--muted);font-size:13px;line-height:1.6}

/* SAPIR MESSAGE */
.sapir-section{background:linear-gradient(135deg,rgba(212,175,55,0.06),rgba(212,175,55,0.02));border:1px solid var(--border);border-radius:24px;padding:48px 40px;max-width:820px;margin:0 auto;position:relative;overflow:hidden}
.sapir-section::before{content:'"';position:absolute;top:10px;right:30px;font-size:140px;color:rgba(212,175,55,0.08);font-family:serif;line-height:1}
.sapir-inner{display:flex;gap:28px;align-items:flex-start;position:relative}
.sapir-avatar{width:88px;height:88px;border-radius:50%;border:3px solid var(--gold);flex-shrink:0;background:var(--gg);display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:900;color:#000}
.sapir-quote{font-size:18px;line-height:1.8;color:#ddd;font-style:italic;margin-bottom:16px}
.sapir-name{font-size:14px;font-weight:700;color:var(--gold)}
.sapir-title{font-size:12px;color:var(--muted)}
@media(max-width:600px){.sapir-inner{flex-direction:column;align-items:center;text-align:center}}

/* PROGRAMS */
.programs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}
.prog-card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:32px}
.prog-card.featured{border-color:var(--gold);background:linear-gradient(135deg,rgba(212,175,55,0.07),var(--card))}
.prog-track{font-size:10px;font-weight:700;letter-spacing:3px;color:var(--gold);margin-bottom:8px}
.prog-name{font-size:22px;font-weight:800;margin-bottom:6px}
.prog-sub{font-size:13px;color:var(--muted);margin-bottom:24px;line-height:1.5}
.prog-features{list-style:none;display:flex;flex-direction:column;gap:10px}
.prog-features li{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#ddd}
.prog-features li::before{content:'✓';color:var(--gold);font-weight:800;flex-shrink:0;margin-top:1px}

/* PRICING */
.pricing-wrap{max-width:620px;margin:0 auto}
.pricing-card{background:var(--card);border:2px solid var(--gold);border-radius:24px;padding:44px;text-align:center;position:relative;overflow:hidden}
.pricing-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:var(--gg)}
.price-orig{font-size:16px;color:var(--muted);text-decoration:line-through;margin-bottom:4px}
.price-label{font-size:11px;font-weight:700;letter-spacing:2px;color:var(--gold);margin-bottom:12px;text-transform:uppercase}
.price-amount{font-size:clamp(44px,8vw,72px);font-weight:900;color:var(--gold);line-height:1;font-feature-settings:"tnum"}
.price-sym{font-size:0.45em;vertical-align:top;margin-top:10px;display:inline-block}
.price-vat{font-size:14px;color:var(--muted);margin:8px 0}
.price-saving{display:inline-block;background:rgba(78,205,196,0.1);border:1px solid rgba(78,205,196,0.4);color:var(--teal);font-size:14px;font-weight:700;padding:6px 18px;border-radius:20px;margin-bottom:32px}
.price-features{list-style:none;text-align:right;display:flex;flex-direction:column;gap:10px;margin-bottom:36px}
.price-features li{display:flex;align-items:center;gap:10px;font-size:14px;color:#ddd}
.price-features li .ck{color:var(--gold);font-weight:700;flex-shrink:0}
.price-cta{display:block;background:var(--gg);color:#000;font-weight:800;padding:18px;border-radius:12px;text-decoration:none;font-size:17px;text-align:center;transition:transform .2s,box-shadow .2s}
.price-cta:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(212,175,55,0.45)}

/* VIDEO */
.video-wrap{position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:16px;border:1px solid var(--border)}
.video-wrap iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}

/* ABOUT */
.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:580px){.about-grid{grid-template-columns:1fr}}
.about-card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:28px;text-align:center}
.about-avatar{width:76px;height:76px;background:var(--gg);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;color:#000;margin:0 auto 16px}
.about-name{font-size:19px;font-weight:800;margin-bottom:4px}
.about-role{font-size:12px;color:var(--gold);margin-bottom:12px;font-weight:600;letter-spacing:.5px}
.about-bio{font-size:13px;color:#aaa;line-height:1.6}
.about-tags{display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap}
.about-tag{font-size:11px;background:rgba(212,175,55,0.08);border:1px solid var(--border);padding:4px 12px;border-radius:20px;color:var(--gold)}

/* GUARANTEE */
.guarantee-bar{background:linear-gradient(135deg,rgba(212,175,55,0.08),rgba(212,175,55,0.04));border:1px solid rgba(212,175,55,0.3);border-radius:16px;padding:20px 28px;display:flex;align-items:center;gap:16px;margin:0 24px 60px;flex-wrap:wrap}
.guarantee-icon{font-size:32px;flex-shrink:0}
.guarantee-text{font-size:15px;font-weight:600;line-height:1.5}

/* FAQ */
.faq-item{background:var(--card);border:1px solid var(--border);border-radius:12px;margin-bottom:10px;overflow:hidden}
.faq-q{padding:20px 24px;font-weight:600;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:15px;transition:color .2s}
.faq-q:hover{color:var(--gold)}
.faq-icon{color:var(--gold);font-size:22px;flex-shrink:0;transition:transform .3s}
.faq-a{padding:0 24px 20px;color:#aaa;font-size:14px;line-height:1.7;display:none}
.faq-item.open .faq-a{display:block}
.faq-item.open .faq-icon{transform:rotate(45deg)}

footer{text-align:center;padding:40px 24px;border-top:1px solid var(--border);color:var(--muted);font-size:13px}
.footer-brand{color:var(--gold);font-weight:700;font-size:16px;margin-bottom:6px}

@media(max-width:600px){
  .stats-row{flex-direction:column}
  .stat-box{border-left:none;border-bottom:1px solid var(--border)}
  .stat-box:last-child{border-bottom:none}
  .sapir-section{padding:32px 24px}
}
</style>
</head>
<body>

<!-- NAV -->
<nav>
  <div class="nav-left">
    <img class="nav-logo-img" src="https://ldb.sapzis.co.il/wp-content/uploads/2024/07/lets-do-businnes-logo-white.png" alt="Let's do Business" onerror="this.style.display='none'">
    <span class="nav-logo-txt">מכללת ספיר זיסמן</span>
  </div>
  <a href="${calendarLink}" class="nav-cta" target="_blank">שריין שיחה ←</a>
</nav>

<!-- HERO -->
<div class="hero">
  <div class="hero-inner">
    <div class="hero-pill" data-aos="fade-down"><span></span> הצעה אישית - הוכנה עבורך, ${clientName}</div>
    ${clientPhotoUrl ? `<div class="client-photo-row" data-aos="zoom-in" data-aos-delay="50"><img class="client-photo" src="${clientPhotoUrl}" alt="${clientName}" onerror="this.parentElement.style.display='none'"></div>` : ''}
    <h1 data-aos="fade-up" data-aos-delay="80">${heroHeadlineHTML}</h1>
    <p class="hero-sub" data-aos="fade-up" data-aos-delay="140">${heroSub}</p>
    ${rolesArr.length ? `<div class="roles-row" data-aos="fade-up" data-aos-delay="170">${rolesArr.map(r=>`<span class="role-badge">${r}</span>`).join('')}</div>` : ''}
    ${statsHTML ? `<div data-aos="fade-up" data-aos-delay="200">${statsHTML}</div>` : ''}
    <div data-aos="zoom-in" data-aos-delay="240">
      <a href="${calendarLink}" class="cta-btn" target="_blank">📅 שריין שיחה עם דניס ←</a>
    </div>
  </div>
</div>

<!-- GUARANTEE -->
<div style="max-width:1000px;margin:0 auto">
  <div class="guarantee-bar" data-aos="fade-up">
    <span class="guarantee-icon">🔒</span>
    <span class="guarantee-text">מכפילים את מחזור ההכנסות ב-90 יום — <strong>או מחזירים כל שקל. בכתב. ללא תנאים נסתרים.</strong></span>
  </div>
</div>

<!-- PAIN POINTS -->
<div class="section">
  <div class="sec-label" data-aos="fade-right">בואי נדבר בכנות</div>
  <h2 class="sec-title" data-aos="fade-right" data-aos-delay="60">את מכיר/ה את<br><span class="gold-text">התחושות האלה?</span></h2>
  <p class="sec-sub" data-aos="fade-right" data-aos-delay="100">אלו הדפוסים שאנחנו שומעים מכל בעלי העסקים שמגיעים אלינו.</p>
  <div class="pain-grid">
    ${displayPainPoints.map((p,i)=>`
    <div class="pain-card" data-aos="fade-up" data-aos-delay="${i*60}">
      <div class="pain-icon">${p.icon||'⚡'}</div>
      <div class="pain-title">${p.title}</div>
      ${p.desc?`<div class="pain-desc">${p.desc}</div>`:''}
    </div>`).join('')}
  </div>
</div>

<div class="divider"></div>

<!-- SAPIR PERSONAL MESSAGE -->
<div class="section" style="text-align:center">
  <div class="sec-label" data-aos="fade-up" style="justify-content:center">מסר אישי מספיר</div>
  <h2 class="sec-title" data-aos="fade-up" data-aos-delay="60">ספיר <span class="gold-text">שלחה לך הודעה</span></h2>
  <p class="sec-sub" style="margin:0 auto 40px" data-aos="fade-up" data-aos-delay="100">לפני שאת מחליט/ה — קרא/י מה ספיר כתבה לך ישירות.</p>
  <div class="sapir-section" data-aos="fade-up" data-aos-delay="140">
    <div class="sapir-inner">
      <div class="sapir-avatar">ס</div>
      <div>
        <div class="sapir-quote">"${clientName} יקר/ה, ראיתי בדיוק את הפוטנציאל שלך. הידע, הניסיון, השליחות — הכל שם. מה שחסר הוא המנגנון הנכון. זה בדיוק מה שאנחנו נבנה יחד."</div>
        <div class="sapir-name">ספיר זיסמן</div>
        <div class="sapir-title">מייסדת המכללה | מאסטר NLP</div>
      </div>
    </div>
  </div>
</div>

<div class="divider"></div>

<!-- PROGRAMS -->
<div class="section">
  <div class="sec-label" data-aos="fade-right">מה מקבלים</div>
  <h2 class="sec-title" data-aos="fade-right" data-aos-delay="60">${program==='BOTH'?`<span class="gold-text">שני מסלולים</span> — שלובים בשבילך`:`<span class="gold-text">${programTitle}</span>`}</h2>
  <div class="programs-grid">
    ${showLDB?`
    <div class="prog-card featured" data-aos="fade-up">
      <div class="prog-track">TRACK 01</div>
      <div class="prog-name">Let's Do Business</div>
      <div class="prog-sub">ליווי עסקי מלא להכפלת המחזור</div>
      <ul class="prog-features">
        <li>4 פגישות פיצוח עסקיות 1×1</li>
        <li>12 זומים קבוצתיים שבועיים עם מומחים</li>
        <li>תמיכה יומיומית בוואטסאפ — ללא הגבלה</li>
        <li>20+ קורסים — גישה לכל החיים</li>
        <li>ארגז כלים מלא: תסריטים, אקסלים, חוזים</li>
        <li>כרטיס VIP לסמינר עסקים שנתי</li>
      </ul>
    </div>`:''}
    ${showABM?`
    <div class="prog-card ${!showLDB?'featured':''}" data-aos="fade-up" data-aos-delay="100">
      <div class="prog-track">TRACK 02</div>
      <div class="prog-name">AI Business Mastery</div>
      <div class="prog-sub">6 שבועות להטמעת AI מעשית בעסק שלך</div>
      <ul class="prog-features">
        <li>6 מפגשי לייב (2+ שעות כל אחד)</li>
        <li>מנטור אישי + 6 שיחות 1×1 שבועיות</li>
        <li>The AI Toolkit — כל הפרומפטים</li>
        <li>6 מאסטר-קלאסים: שיווק, מכירות, AI</li>
        <li>קהילת WhatsApp חלוצי AI</li>
        <li>כרטיס VIP לסמינר עסקים שנתי</li>
      </ul>
    </div>`:''}
  </div>
</div>

<div class="divider"></div>

<!-- BOOKING -->
<div class="section" style="text-align:center">
  <div class="sec-label" data-aos="fade-up" style="justify-content:center">הצעד הבא</div>
  <h2 class="sec-title" data-aos="fade-up" data-aos-delay="60">שריין שיחה עם דניס<br><span class="teal-text">— 20 דקות שישנו הכל</span></h2>
  ${denisPhotoUrl ? `
  <div style="display:flex;align-items:center;gap:20px;justify-content:center;margin:0 auto 32px;max-width:480px;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:24px" data-aos="fade-up" data-aos-delay="80">
    <img src="${denisPhotoUrl}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);flex-shrink:0" onerror="this.parentElement.style.display='none'" alt="דניס פול">
    <div style="text-align:right">
      <div style="font-size:17px;font-weight:800;margin-bottom:4px">דניס פול</div>
      <div style="font-size:13px;color:var(--gold);margin-bottom:8px">יועץ מכירות בכיר | מכללת ספיר זיסמן</div>
      <div style="font-size:13px;color:#aaa">20 דקות ממוקדות ← תוצאה ברורה</div>
    </div>
  </div>` : '<div style="height:16px"></div>'}
  <a href="${calendarLink}" class="cta-btn" target="_blank" data-aos="zoom-in" data-aos-delay="120">📅 שריין שיחה עם דניס ←</a>
</div>

<div class="divider"></div>

<!-- ABOUT -->
<div class="section">
  <div class="sec-label" data-aos="fade-right">האנשים שמלווים אותך</div>
  <h2 class="sec-title" data-aos="fade-right" data-aos-delay="60">ספיר ואיתי —<br><span class="gold-text">יד ביד איתך</span></h2>
  <div class="about-grid" data-aos="fade-up" data-aos-delay="100">
    <div class="about-card">
      <div class="about-avatar">ס</div>
      <div class="about-name">ספיר זיסמן</div>
      <div class="about-role">מייסדת | יזמית | מאסטר NLP</div>
      <div class="about-bio">הוכשרה על ידי ד"ר ריצ'רד בנדלר. 120K+ עוקבים. בנתה מכללה המתמחה בפיתוח עסקי ואישי.</div>
      <div class="about-tags"><span class="about-tag">120K+ עוקבים</span><span class="about-tag">מאסטר NLP</span><span class="about-tag">Let's Do Business</span></div>
    </div>
    <div class="about-card">
      <div class="about-avatar">א</div>
      <div class="about-name">איתי סלע</div>
      <div class="about-role">יזם | מומחה AI | אוטומציות</div>
      <div class="about-bio">גייס הון ל-2 סטארטאפים. מנהל קמפיינים לחברות הגדולות בישראל. מפתח ExtraBe עם AI.</div>
      <div class="about-tags"><span class="about-tag">2 סטארטאפים</span><span class="about-tag">AI Expert</span><span class="about-tag">Automation</span></div>
    </div>
  </div>
</div>

<div class="divider"></div>

<!-- TESTIMONIALS -->
<div class="section" style="text-align:center">
  <div class="sec-label" data-aos="fade-up" style="justify-content:center">הם כבר עשו את זה</div>
  <h2 class="sec-title" data-aos="fade-up" data-aos-delay="60">סיפורי הצלחה <span class="gold-text">אמיתיים</span></h2>
  <div style="max-width:720px;margin:0 auto 32px" data-aos="fade-up" data-aos-delay="100">
    <div class="video-wrap">
      <iframe src="https://player.vimeo.com/video/1035248852?badge=0&autopause=0" allow="autoplay; fullscreen; picture-in-picture" title="testimonials"></iframe>
    </div>
  </div>
  <a href="https://www.sapzis.co.il/סיפורי-הצלחה/" target="_blank" class="cta-btn" style="font-size:15px;padding:13px 28px" data-aos="zoom-in" data-aos-delay="140">ראה עוד סיפורי הצלחה ←</a>
</div>

<div class="divider"></div>

<!-- PRICING -->
<div class="section">
  <div class="sec-label" style="justify-content:center" data-aos="fade-up">ההצעה שלך</div>
  <h2 class="sec-title" style="text-align:center" data-aos="fade-up" data-aos-delay="60"><span class="gold-text">הכל ביחד</span> — בהצעה אחת</h2>
  <div class="pricing-wrap" data-aos="zoom-in" data-aos-delay="100">
    <div class="pricing-card">
      <div class="price-label">הצעה אישית ל${clientName} · ${programTitle}</div>
      ${origNum&&origNum>priceNum?`<div class="price-orig">₪${originalPrice}</div>`:''}
      ${origNum&&origNum>priceNum?`<div class="price-label" style="font-size:12px;color:var(--muted)">מחיר מיוחד עבורך</div>`:''}
      <div class="price-amount"><span class="price-sym">₪</span>${price}</div>
      <div class="price-vat">כולל מע"מ | ניתן לפריסה לתשלומים</div>
      ${savingsAmount?`<div class="price-saving">חיסכון של ₪${savingsAmount}!</div>`:'<div style="height:20px"></div>'}
      <ul class="price-features">
        ${showABM?`<li><span class="ck">✓</span>6 מפגשי לייב AI + מנטור אישי</li><li><span class="ck">✓</span>The AI Toolkit + קהילת חלוצי AI</li>`:''}
        ${showLDB?`<li><span class="ck">✓</span>4 פגישות פיצוח 1×1 + 12 זומים שבועיים</li><li><span class="ck">✓</span>20+ קורסים — גישה לכל החיים</li><li><span class="ck">✓</span>ארגז כלים מלא + תמיכה יומיומית</li>`:''}
        <li><span class="ck">✓</span>🔒 ערבות: הכפלת מחזור ב-90 יום או החזר מלא</li>
        <li><span class="ck">✓</span>כרטיס VIP לסמינר עסקים שנתי</li>
      </ul>
      <a href="${calendarLink}" class="price-cta" target="_blank">📅 שריין שיחה עם דניס ←</a>
    </div>
  </div>
</div>

<div class="divider"></div>

<!-- FAQ -->
<div class="section">
  <div class="sec-label" data-aos="fade-right">שאלות שאולי יש לך</div>
  <h2 class="sec-title" data-aos="fade-right" data-aos-delay="60">שאלות נפוצות <span class="gold-text">— בשבילך</span></h2>
  <div data-aos="fade-up" data-aos-delay="100">
    ${[
      ['האם צריך ידע טכנולוגי?','לא. בכלל לא. המנטור האישי שלך ילווה אותך צעד אחר צעד, בקצב שלך.'],
      ['כמה זמן בשבוע צריך?','מפגש שבועי + עבודה עצמית קצרה. בנינו את זה לבעלי עסקים עסוקים.'],
      ['מה קורה אם לא מבין משהו?','יש מנטור אישי שנמצא לצד שלך. כל שאלה — יש מי שעונה.'],
      ['ניתן לפרוס לתשלומים?','כן. דניס ימצא איתך את הפתרון הפיננסי שמתאים לך.'],
      ['מה הערבות בדיוק?','מכפילים מחזור ב-90 יום — או מחזירים כל שקל. בכתב. ללא תנאים נסתרים.'],
    ].map(([q,a])=>`
    <div class="faq-item">
      <div class="faq-q">${q} <span class="faq-icon">+</span></div>
      <div class="faq-a">${a}</div>
    </div>`).join('')}
  </div>
</div>

<div class="section" style="text-align:center;padding-bottom:100px">
  ${denisPhotoUrl ? `<img src="${denisPhotoUrl}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--gold);margin-bottom:20px;box-shadow:0 0 24px rgba(212,175,55,0.3)" onerror="this.style.display='none'" alt="דניס פול" data-aos="zoom-in">` : ''}
  <h2 class="sec-title" data-aos="fade-up">מוכן/ה להתחיל?<br><span class="teal-text">שריין שיחה עכשיו.</span></h2>
  <div style="margin-top:32px" data-aos="zoom-in" data-aos-delay="100">
    <a href="${calendarLink}" class="cta-btn" target="_blank">📅 שריין שיחה עם דניס ←</a>
  </div>
</div>

<footer>
  <div class="footer-brand">מכללת ספיר זיסמן</div>
  <div>${programTitle} · הצעה אישית ל${clientName}</div>
  <div style="margin-top:8px">© 2025 כל הזכויות שמורות</div>
</footer>

<script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
<script>
AOS.init({duration:800,once:true,offset:50,easing:'ease-out-quart'});
document.querySelectorAll('.faq-q').forEach(q=>q.addEventListener('click',()=>q.parentElement.classList.toggle('open')));
</script>
</body>
</html>`;
}

module.exports = { generateProposalHTML };
