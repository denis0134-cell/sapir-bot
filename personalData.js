/**
 * personalData.js
 * ניהול מטרות, כספים, בריאות ומשימות של דניס
 * כל הנתונים נשמרים ב-JSON + GitHub
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DATA_FILE = path.join(__dirname, 'denis-data.json');
const REPO = 'denis0134-cell/sapir-bot';
const GH_TOKEN = () => process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

// ── Load / Save ──────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch {}
  return getDefaultData();
}

function getDefaultData() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  return {
    goals: {
      monthly: { income: 0, closures: 0, calls: 0 },
      weekly: { closures: 0, calls: 0 },
      daily: { closures: 0, calls: 0 }
    },
    finance: {
      month,
      income: [],
      expenses: [],
      debts: []
    },
    health: {
      weight: null,
      workouts: [],
      steps: [],
      sleep: [],
      water: [],
      smoking: []
    },
    tasks: [],
    checkIns: {
      lastMorning: null,
      lastEvening: null,
      pendingMorning: false,
      pendingEvening: false
    },
    nextTaskId: 1,
    updatedAt: new Date().toISOString()
  };
}

function saveData(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  persistToGitHub(data).catch(() => {});
}

async function persistToGitHub(data) {
  const token = GH_TOKEN();
  if (!token) return;
  try {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    let sha;
    try {
      const res = await axios.get(
        `https://api.github.com/repos/${REPO}/contents/denis-data.json`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      sha = res.data.sha;
    } catch {}
    const body = { message: 'Update Denis personal data', content };
    if (sha) body.sha = sha;
    await axios.put(
      `https://api.github.com/repos/${REPO}/contents/denis-data.json`,
      body,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
  } catch {}
}

async function loadFromGitHub() {
  const token = GH_TOKEN();
  if (!token) return;
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${REPO}/contents/denis-data.json`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = JSON.parse(Buffer.from(res.data.content, 'base64').toString());
    saveData(data);
    console.log('[PersonalData] Loaded from GitHub');
  } catch {}
}

// ── Goals ────────────────────────────────────
function setGoal(type, field, value) {
  const data = loadData();
  if (!data.goals[type]) data.goals[type] = {};
  data.goals[type][field] = parseInt(value) || 0;
  saveData(data);
  return data.goals;
}

function getGoalStatus() {
  const data = loadData();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  // Reset monthly data if new month
  if (data.finance.month !== month) {
    data.finance.month = month;
    data.finance.income = [];
    data.finance.expenses = [];
    saveData(data);
  }

  const monthlyIncome = data.finance.income.reduce((s, i) => s + i.amount, 0);
  const closures = data.finance.income.filter(i => i.type === 'closure').length;
  const g = data.goals;

  const lines = ['📊 *מצב יעדים חודשי*\n'];

  if (g.monthly.income > 0) {
    const pct = Math.round((monthlyIncome / g.monthly.income) * 100);
    lines.push(`💰 הכנסה: ₪${monthlyIncome.toLocaleString()} / ₪${g.monthly.income.toLocaleString()} (${pct}%)`);
  }
  if (g.monthly.closures > 0) {
    lines.push(`🤝 סגירות: ${closures} / ${g.monthly.closures}`);
  }

  const tasks = data.tasks.filter(t => !t.done);
  lines.push(`\n📋 משימות פתוחות: ${tasks.length}`);
  if (tasks.length > 0) {
    tasks.slice(0, 3).forEach(t => lines.push(`  ${t.priority === 'high' ? '🔴' : '🟡'} ${t.text}`));
  }

  return lines.join('\n');
}

// ── Finance ───────────────────────────────────
function logIncome(amount, source, type = 'sale') {
  const data = loadData();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if (data.finance.month !== month) {
    data.finance.month = month;
    data.finance.income = [];
    data.finance.expenses = [];
  }
  data.finance.income.push({
    amount: parseInt(amount) || 0,
    source: source || 'לא צוין',
    type,
    date: now.toISOString().split('T')[0]
  });
  saveData(data);

  const total = data.finance.income.reduce((s, i) => s + i.amount, 0);
  const goal = data.goals.monthly?.income || 0;
  const pct = goal > 0 ? ` (${Math.round(total/goal*100)}% מהיעד)` : '';
  return `✅ נרשמה הכנסה: ₪${parseInt(amount).toLocaleString()}\nסה"כ החודש: ₪${total.toLocaleString()}${pct}`;
}

function logExpense(amount, description) {
  const data = loadData();
  data.finance.expenses.push({
    amount: parseInt(amount) || 0,
    description: description || 'לא צוין',
    date: new Date().toISOString().split('T')[0]
  });
  saveData(data);
  const total = data.finance.expenses.reduce((s, e) => s + e.amount, 0);
  return `✅ הוצאה נרשמה: ₪${parseInt(amount).toLocaleString()} — ${description}\nסה"כ הוצאות החודש: ₪${total.toLocaleString()}`;
}

function addDebt(name, amount, monthly) {
  const data = loadData();
  if (!data.finance.debts) data.finance.debts = [];
  const existing = data.finance.debts.findIndex(d => d.name === name);
  if (existing >= 0) {
    data.finance.debts[existing] = { name, amount: parseInt(amount), monthly: parseInt(monthly) || 0 };
  } else {
    data.finance.debts.push({ name, amount: parseInt(amount), monthly: parseInt(monthly) || 0 });
  }
  saveData(data);
  const total = data.finance.debts.reduce((s, d) => s + d.amount, 0);
  return `✅ חוב נרשם: ${name} ₪${parseInt(amount).toLocaleString()}\nסה"כ חובות: ₪${total.toLocaleString()}`;
}

function getFinanceReport() {
  const data = loadData();
  const income = data.finance.income.reduce((s, i) => s + i.amount, 0);
  const expenses = data.finance.expenses.reduce((s, e) => s + e.amount, 0);
  const net = income - expenses;
  const debts = data.finance.debts || [];
  const totalDebt = debts.reduce((s, d) => s + d.amount, 0);

  let report = `💰 *דוח כספי — ${data.finance.month}*\n\n`;
  report += `הכנסות: ₪${income.toLocaleString()}\n`;
  report += `הוצאות: ₪${expenses.toLocaleString()}\n`;
  report += `נטו: ₪${net.toLocaleString()}\n`;

  if (data.goals.monthly?.income > 0) {
    const pct = Math.round(income / data.goals.monthly.income * 100);
    report += `יעד: ₪${data.goals.monthly.income.toLocaleString()} — הושג ${pct}%\n`;
  }

  if (debts.length > 0) {
    report += `\n🏦 *חובות:*\n`;
    debts.forEach(d => report += `${d.name}: ₪${d.amount.toLocaleString()}${d.monthly ? ` (₪${d.monthly}/חודש)` : ''}\n`);
    report += `סה"כ: ₪${totalDebt.toLocaleString()}`;
  }

  return report;
}

// ── Health ────────────────────────────────────
function logHealth(metric, value, note) {
  const data = loadData();
  const today = new Date().toISOString().split('T')[0];

  const entry = { value, date: today };
  if (note) entry.note = note;

  switch (metric) {
    case 'weight':
      data.health.weight = parseFloat(value);
      if (!data.health.weights) data.health.weights = [];
      data.health.weights.push(entry);
      break;
    case 'workout':
      if (!data.health.workouts) data.health.workouts = [];
      data.health.workouts.push({ type: value, note, date: today });
      break;
    case 'steps':
      if (!data.health.steps) data.health.steps = [];
      data.health.steps.push({ value: parseInt(value), date: today });
      break;
    case 'sleep':
      if (!data.health.sleep) data.health.sleep = [];
      data.health.sleep.push({ hours: parseFloat(value), note, date: today });
      break;
    case 'water':
      if (!data.health.water) data.health.water = [];
      data.health.water.push({ glasses: parseInt(value), date: today });
      break;
    case 'smoking':
      if (!data.health.smoking) data.health.smoking = [];
      data.health.smoking.push({ cigarettes: parseInt(value), date: today });
      break;
  }

  saveData(data);

  const labels = {
    weight: `משקל: ${value} ק"ג`,
    workout: `אימון: ${value}${note ? ' — '+note : ''}`,
    steps: `צעדים: ${parseInt(value).toLocaleString()}`,
    sleep: `שינה: ${value} שעות`,
    water: `מים: ${value} כוסות`,
    smoking: `עישון: ${value} סיגריות`
  };
  return `✅ ${labels[metric] || `${metric}: ${value}`}`;
}

function getHealthReport() {
  const data = loadData();
  const h = data.health;
  const last7 = (arr, field) => {
    if (!arr?.length) return null;
    const recent = arr.slice(-7);
    const vals = recent.map(i => i[field] || i.value);
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return { avg: Math.round(avg * 10) / 10, last: vals[vals.length - 1] };
  };

  let report = `💪 *דוח בריאות — 7 ימים אחרונים*\n\n`;
  if (h.weight) report += `משקל נוכחי: ${h.weight} ק"ג\n`;
  const workouts = h.workouts?.filter(w => {
    const d = new Date(w.date);
    return (Date.now() - d) < 7 * 86400000;
  });
  if (workouts?.length) report += `אימונים: ${workouts.length} השבוע\n`;
  const steps = last7(h.steps, 'value');
  if (steps) report += `צעדים ממוצע: ${steps.avg.toLocaleString()}/יום\n`;
  const sleep = last7(h.sleep, 'hours');
  if (sleep) report += `שינה ממוצע: ${sleep.avg} שעות\n`;
  const smoking = last7(h.smoking, 'cigarettes');
  if (smoking) report += `עישון ממוצע: ${smoking.avg} ליום\n`;

  if (report === `💪 *דוח בריאות — 7 ימים אחרונים*\n\n`) {
    report += 'עוד אין נתונים. תתחיל לדווח:\n"כושר | ריצה 30 דקות"\n"משקל | 82"\n"שינה | 7"';
  }
  return report;
}

// ── Tasks ─────────────────────────────────────
function addTask(text, priority = 'normal') {
  const data = loadData();
  if (!data.tasks) data.tasks = [];
  if (!data.nextTaskId) data.nextTaskId = 1;
  const task = {
    id: data.nextTaskId++,
    text,
    priority, // high / normal / low
    done: false,
    createdAt: new Date().toISOString()
  };
  data.tasks.unshift(task);
  saveData(data);
  return task.id;
}

function completeTask(id) {
  const data = loadData();
  const task = data.tasks.find(t => t.id === parseInt(id));
  if (!task) return null;
  task.done = true;
  task.completedAt = new Date().toISOString();
  saveData(data);
  return task.text;
}

function getTasks(onlyOpen = true) {
  const data = loadData();
  if (!data.tasks) return [];
  return onlyOpen ? data.tasks.filter(t => !t.done) : data.tasks;
}

function getTaskList() {
  const tasks = getTasks(true);
  if (!tasks.length) return 'אין משימות פתוחות 🎉';
  const high = tasks.filter(t => t.priority === 'high');
  const normal = tasks.filter(t => t.priority !== 'high');
  let msg = '';
  if (high.length) msg += `🔴 *דחוף:*\n${high.map(t => `${t.id}. ${t.text}`).join('\n')}\n\n`;
  if (normal.length) msg += `📋 *רגיל:*\n${normal.map(t => `${t.id}. ${t.text}`).join('\n')}`;
  return msg.trim();
}

// ── Daily Check-in ────────────────────────────
function getMorningQuestions() {
  const data = loadData();
  data.checkIns.pendingMorning = true;
  data.checkIns.lastMorning = new Date().toISOString();
  saveData(data);
  return `☀️ בוקר דניס!\n\n4 שאלות בוקר:\n1. מה 3 הדברים הכי חשובים היום?\n2. איזה ליד הכי חשוב לקדם?\n3. כמה שיחות אתה מכוון לעשות?\n4. מה המשימה שאסור שתידחה?\n\nענה בפורמט:\n1. [תשובה]\n2. [תשובה]\n3. [תשובה]\n4. [תשובה]`;
}

function getEveningQuestions() {
  const data = loadData();
  data.checkIns.pendingEvening = true;
  data.checkIns.lastEvening = new Date().toISOString();
  saveData(data);
  return `🌙 סיכום יום — ענה מהר:\n\n1. כמה שיחות?\n2. כמה הצעות נתת?\n3. כמה סגירות?\n4. מי צריך פולואפ מחר?\n5. התאמנת? (כן/לא)\n6. מה הכי חשוב לשפר מחר?\n\nפורמט: 1. [תשובה] ...`;
}

function buildDailyReport() {
  const data = loadData();
  const today = new Date().toISOString().split('T')[0];

  const todayIncome = data.finance.income.filter(i => i.date === today).reduce((s, i) => s + i.amount, 0);
  const monthIncome = data.finance.income.reduce((s, i) => s + i.amount, 0);
  const openTasks = getTasks(true).length;
  const highPrio = getTasks(true).filter(t => t.priority === 'high');
  const todayWorkout = data.health.workouts?.some(w => w.date === today);

  let report = `📊 *דוח יומי — ${today}*\n\n`;
  if (todayIncome > 0) report += `💰 הכנסה היום: ₪${todayIncome.toLocaleString()}\n`;
  if (monthIncome > 0) report += `📈 סה"כ החודש: ₪${monthIncome.toLocaleString()}`;
  if (data.goals.monthly?.income > 0) {
    const pct = Math.round(monthIncome / data.goals.monthly.income * 100);
    report += ` (${pct}% מהיעד)`;
  }
  report += `\n\n`;
  if (openTasks > 0) {
    report += `📋 משימות פתוחות: ${openTasks}\n`;
    if (highPrio.length) report += `🔴 דחוף: ${highPrio.map(t => t.text).join(', ')}\n`;
  }
  report += `\n💪 אימון היום: ${todayWorkout ? '✅' : '❌'}\n`;

  return report;
}


// ── User Profile ──────────────────────────────
function getUserProfile() {
  const data = loadData();
  return data.userProfile || {
    name: 'דניס פול', age: 28, location: 'ישראל',
    role: 'איש מכירות High Ticket', company: 'מכללת ספיר זיסמן',
    vision: 'לבנות חיים של חופש, השפעה והגשמה דרך עסקים, מכירות, AI',
    values: ['חופש', 'עצמאות', 'צמיחה', 'השפעה', 'בריאות'],
    strengths: ['מכירות', 'יצירת חיבור', 'זיהוי כאב', 'שיחות עומק'],
    weaknesses: ['פיזור', 'חוסר סבלנות', 'ביצוע לא עקבי'],
    fears: ['להיתקע כלכלית', 'להיות תלוי במשכורת', 'לא לממש פוטנציאל'],
    motivators: ['התקדמות', 'ניצחון', 'הישגים', 'חופש כלכלי']
  };
}

function updateProfile(updates) {
  const data = loadData();
  data.userProfile = { ...(data.userProfile || {}), ...updates };
  saveData(data);
  return data.userProfile;
}

// ── Structured Goals ──────────────────────────
function createGoal({ title, category, priority = 'high', successMetric, targetDate, whyItMatters, nextAction }) {
  const data = loadData();
  if (!data.activeGoals) data.activeGoals = [];
  const goal = {
    id: 'g_' + Date.now(),
    title, category: category || 'business',
    priority, successMetric: successMetric || '',
    whyItMatters: whyItMatters || '',
    targetDate: targetDate || null,
    nextAction: nextAction || '',
    status: 'active',
    blockers: [],
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
  data.activeGoals.push(goal);
  saveData(data);
  return goal;
}

function listGoals(statusFilter = 'active') {
  const data = loadData();
  const goals = data.activeGoals || [];
  return statusFilter ? goals.filter(g => g.status === statusFilter) : goals;
}

function updateGoal(id, updates) {
  const data = loadData();
  if (!data.activeGoals) return null;
  const idx = data.activeGoals.findIndex(g => g.id === id);
  if (idx < 0) return null;
  data.activeGoals[idx] = { ...data.activeGoals[idx], ...updates, lastUpdated: new Date().toISOString() };
  saveData(data);
  return data.activeGoals[idx];
}

function getGoalsText() {
  const goals = listGoals('active');
  if (!goals.length) return 'אין מטרות פעילות. הגדר מטרה: "רוצה להגדיר מטרה: [שם] — [מה מודד הצלחה]"';
  return goals.map((g, i) => {
    const icon = g.priority === 'critical' ? '🔴' : g.priority === 'high' ? '🟠' : '🟡';
    let line = `${icon} ${g.title}`;
    if (g.successMetric) line += `
   מדד: ${g.successMetric}`;
    if (g.nextAction) line += `
   פעולה הבאה: ${g.nextAction}`;
    return line;
  }).join('

');
}

// ── Decisions Table ───────────────────────────
function storeDecision({ title, category, decision, reasoning, risks, expectedOutcome }) {
  const data = loadData();
  if (!data.decisions) data.decisions = [];
  const rec = {
    id: 'd_' + Date.now(),
    title, category: category || 'business',
    decision, reasoning: reasoning || '',
    risks: risks || [],
    expectedOutcome: expectedOutcome || '',
    actualOutcome: null,
    createdAt: new Date().toISOString(),
    reviewDate: null
  };
  data.decisions.push(rec);
  saveData(data);
  return rec;
}

function getDecisions(n = 5) {
  const data = loadData();
  const decisions = data.decisions || [];
  return decisions.slice(-n).reverse();
}

function formatDecisions() {
  const decisions = getDecisions(5);
  if (!decisions.length) return 'אין החלטות רשומות עדיין.';
  return decisions.map(d =>
    `📌 ${d.title}
   ${d.decision}
   ${new Date(d.createdAt).toLocaleDateString('he-IL')}`
  ).join('

');
}

// ── Structured Daily Check-in ─────────────────
function saveCheckIn(type, answers) {
  const data = loadData();
  if (!data.dailyCheckins) data.dailyCheckins = [];
  const today = new Date().toISOString().split('T')[0];
  const existing = data.dailyCheckins.find(c => c.date === today);
  const entry = existing || { date: today };

  if (type === 'morning') {
    entry.morningFocus = answers[0] || '';
    entry.morningTopTasks = [answers[1], answers[2], answers[3]].filter(Boolean);
    entry.hotLead = answers[4] || '';
    entry.callsTarget = parseInt(answers[5]) || 5;
  } else {
    entry.actualCalls = parseInt(answers[0]) || 0;
    entry.offersSent = parseInt(answers[1]) || 0;
    entry.dealsClosed = parseInt(answers[2]) || 0;
    entry.followupNeeded = answers[3] || '';
    entry.workoutDone = /כן|yes|✅|v|1/i.test(answers[4] || '');
    entry.lesson = answers[5] || '';
    entry.fulfillmentScore = parseInt(answers[6]) || 0;
  }

  if (!existing) {
    data.dailyCheckins.push(entry);
  }
  // Keep last 90 days
  if (data.dailyCheckins.length > 90) data.dailyCheckins = data.dailyCheckins.slice(-90);
  data.checkIns.pendingCheckin = null;
  saveData(data);
  return entry;
}

function setPendingCheckin(type) {
  const data = loadData();
  data.checkIns.pendingCheckin = type;
  saveData(data);
}

function getPendingCheckin() {
  return loadData().checkIns?.pendingCheckin || null;
}

function getTodayCheckIn() {
  const data = loadData();
  const today = new Date().toISOString().split('T')[0];
  return (data.dailyCheckins || []).find(c => c.date === today) || null;
}

// ── Scoring Engine ────────────────────────────
function calculateScores() {
  const data = loadData();
  const today = new Date().toISOString().split('T')[0];
  const checkin = getTodayCheckIn();

  // Health Score (0-100)
  const workout = data.health.workouts?.some(w => w.date === today);
  const sleep = data.health.sleep?.filter(s => s.date === today).slice(-1)[0]?.hours || 0;
  const steps = data.health.steps?.filter(s => s.date === today).slice(-1)[0]?.value || 0;
  const water = data.health.water?.filter(w => w.date === today).slice(-1)[0]?.glasses || 0;
  const smoke = data.health.smoking?.filter(s => s.date === today).slice(-1)[0]?.cigarettes || 0;
  const healthScore = Math.min(100, Math.round(
    (workout ? 25 : 0) +
    (sleep >= 7 ? 25 : sleep >= 6 ? 15 : sleep >= 5 ? 8 : 0) +
    (steps >= 10000 ? 25 : steps >= 8000 ? 20 : steps >= 5000 ? 12 : steps > 0 ? 5 : 0) +
    (smoke === 0 ? 15 : smoke <= 5 ? 10 : smoke <= 10 ? 5 : 0) +
    (water >= 8 ? 10 : water >= 5 ? 7 : water >= 3 ? 4 : 0)
  ));

  // Sales Score (0-100)
  const callsDone = checkin?.actualCalls || 0;
  const callsTarget = checkin?.callsTarget || data.goals.daily?.calls || 5;
  const offersSent = checkin?.offersSent || 0;
  const dealsClosed = checkin?.dealsClosed || 0;
  const salesScore = Math.min(100, Math.round(
    Math.min(40, callsTarget > 0 ? (callsDone / callsTarget) * 40 : 0) +
    Math.min(35, offersSent * 12) +
    Math.min(25, dealsClosed * 25)
  ));

  // Productivity Score (0-100)
  const todayTasks = data.tasks.filter(t => !t.done && (t.dueDate === today || t.createdAt?.startsWith(today)));
  const doneTodayTasks = data.tasks.filter(t => t.done && t.completedAt?.startsWith(today));
  const totalForDay = todayTasks.length + doneTodayTasks.length;
  const productivityScore = totalForDay > 0
    ? Math.min(100, Math.round((doneTodayTasks.length / totalForDay) * 100))
    : (checkin?.morningFocus ? 50 : 0);

  // Money Score (0-100)
  const monthIncome = data.finance.income.reduce((s, i) => s + i.amount, 0);
  const monthGoal = data.goals.monthly?.income || 0;
  const moneyScore = monthGoal > 0 ? Math.min(100, Math.round((monthIncome / monthGoal) * 100)) : 0;

  // Fulfillment Score (0-10)
  const fulfillmentScore = checkin?.fulfillmentScore || 0;

  // Overall (weighted)
  const overall = Math.round(
    healthScore * 0.2 + salesScore * 0.3 + productivityScore * 0.2 +
    moneyScore * 0.2 + (fulfillmentScore * 10) * 0.1
  );

  return { healthScore, salesScore, productivityScore, moneyScore, fulfillmentScore, overall };
}

function getScoresText() {
  const s = calculateScores();
  const bar = n => '█'.repeat(Math.round(n/10)) + '░'.repeat(10-Math.round(n/10));
  return `📊 *ציונים יומיים:*

` +
    `💪 בריאות:       ${s.healthScore}/100  ${bar(s.healthScore)}
` +
    `📞 מכירות:       ${s.salesScore}/100  ${bar(s.salesScore)}
` +
    `✅ פרודוקטיביות: ${s.productivityScore}/100  ${bar(s.productivityScore)}
` +
    `💰 כסף:          ${s.moneyScore}/100  ${bar(s.moneyScore)}
` +
    (s.fulfillmentScore > 0 ? `🌟 הגשמה:        ${s.fulfillmentScore}/10
` : '') +
    `
🎯 ציון כולל: ${s.overall}/100`;
}

// ── Accountability Engine ─────────────────────
function checkAccountability() {
  const data = loadData();
  const warnings = [];

  // Tasks delayed 3+ times
  const delayed = data.tasks.filter(t => !t.done && (t.delayCount || 0) >= 3);
  if (delayed.length > 0) {
    warnings.push({
      type: 'DELAYED_TASK',
      message: `דניס, ${delayed.length > 1 ? 'המשימות האלו נדחו' : 'המשימה הזו נדחתה'} 3+ פעמים:
${delayed.map(t => `• "${t.text}"`).join('
')}

יש כאן אחת מ-3 אפשרויות:
1. היא לא באמת חשובה
2. היא גדולה מדי
3. יש חסם

מה נכון?`
    });
  }

  // Goals stale 14+ days
  const now = Date.now();
  const stale = (data.activeGoals || []).filter(g => {
    if (g.status !== 'active' || !g.lastUpdated) return false;
    return (now - new Date(g.lastUpdated)) / 86400000 >= 14;
  });
  if (stale.length > 0) {
    const g = stale[0];
    const days = Math.floor((now - new Date(g.lastUpdated)) / 86400000);
    warnings.push({
      type: 'STALE_GOAL',
      message: `המטרה "${g.title}" לא זזה ${days} ימים.

צריך לבחור:
1. ממשיכים ומגדירים פעולה קטנה
2. מקפיאים
3. מוחקים`
    });
  }

  return warnings;
}

// ── Life Dashboard ─────────────────────────────
function generateLifeDashboard() {
  const scores = calculateScores();
  const data = loadData();
  const tasks = getTasks(true);
  const highPrio = tasks.filter(t => t.priority === 'high');
  const activeGoals = (data.activeGoals || []).filter(g => g.status === 'active');
  const monthIncome = data.finance.income.reduce((s, i) => s + i.amount, 0);
  const incomeGoal = data.goals.monthly?.income || 0;
  const accountability = checkAccountability();
  const today = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

  let dash = `📊 *Dashboard — ${today}*

`;

  // Scores
  dash += `💪 בריאות: ${scores.healthScore}  📞 מכירות: ${scores.salesScore}  ✅ משימות: ${scores.productivityScore}  💰 כסף: ${scores.moneyScore}
`;
  dash += `🎯 ציון כולל: ${scores.overall}/100

`;

  // Money progress
  if (incomeGoal > 0) {
    const pct = Math.round(monthIncome / incomeGoal * 100);
    const filled = Math.round(pct / 10);
    dash += `💰 הכנסות: ₪${monthIncome.toLocaleString()} / ₪${incomeGoal.toLocaleString()} (${pct}%)
${'█'.repeat(Math.min(10,filled))}${'░'.repeat(Math.max(0,10-filled))}

`;
  }

  // Tasks + Goals
  dash += `📋 משימות פתוחות: ${tasks.length}${highPrio.length > 0 ? ` (🔴 ${highPrio.length} דחופות)` : ''}
`;
  dash += `📌 מטרות פעילות: ${activeGoals.length}
`;

  // Top urgent task
  if (highPrio.length > 0) {
    dash += `
⚡ הכי דחוף: "${highPrio[0].text}"
`;
  }

  // Accountability warnings
  if (accountability.length > 0) {
    dash += `
⚠️ ${accountability[0].message}`;
  }

  return dash;
}

// ── Weekly Report ─────────────────────────────
function generateWeeklyReport() {
  const data = loadData();
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);

  const weekCheckins = (data.dailyCheckins || []).filter(c => new Date(c.date) >= weekAgo);
  const totalCalls = weekCheckins.reduce((s, c) => s + (c.actualCalls || 0), 0);
  const totalOffers = weekCheckins.reduce((s, c) => s + (c.offersSent || 0), 0);
  const totalClosures = weekCheckins.reduce((s, c) => s + (c.dealsClosed || 0), 0);
  const workoutDays = weekCheckins.filter(c => c.workoutDone).length;
  const weekIncome = data.finance.income
    .filter(i => new Date(i.date) >= weekAgo)
    .reduce((s, i) => s + i.amount, 0);
  const doneTasks = data.tasks.filter(t => t.done && t.completedAt && new Date(t.completedAt) >= weekAgo).length;

  let report = `📅 *דוח שבועי*

`;
  report += `📞 שיחות: ${totalCalls}
`;
  report += `📄 הצעות: ${totalOffers}
`;
  report += `🤝 סגירות: ${totalClosures}
`;
  report += `💰 הכנסה: ₪${weekIncome.toLocaleString()}
`;
  report += `✅ משימות שבוצעו: ${doneTasks}
`;
  report += `💪 אימונים: ${workoutDays}/7

`;

  const scores = calculateScores();
  report += `🎯 ציון כולל: ${scores.overall}/100

`;

  // Accountability
  const acc = checkAccountability();
  if (acc.length > 0) {
    report += `⚠️ נקודה לשים לב:
${acc[0].message}`;
  }

  return report;
}

// ── Increment task delay counter ──────────────
function delayTask(id) {
  const data = loadData();
  const task = data.tasks.find(t => t.id === parseInt(id));
  if (!task) return null;
  task.delayCount = (task.delayCount || 0) + 1;
  saveData(data);
  return task;
}


module.exports = {
  loadFromGitHub,
  // Profile
  getUserProfile, updateProfile,
  // Goals
  setGoal, getGoalStatus, createGoal, listGoals, updateGoal, getGoalsText,
  // Finance
  logIncome, logExpense, addDebt, getFinanceReport,
  // Health
  logHealth, getHealthReport,
  // Tasks
  addTask, completeTask, delayTask, getTasks, getTaskList,
  // Check-ins
  getMorningQuestions, getEveningQuestions, saveCheckIn, setPendingCheckin, getPendingCheckin, getTodayCheckIn,
  // Reports
  buildDailyReport, generateWeeklyReport, generateLifeDashboard,
  // Scores
  calculateScores, getScoresText,
  // Decisions
  storeDecision, getDecisions, formatDecisions,
  // Accountability
  checkAccountability
};
