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

module.exports = {
  loadFromGitHub,
  setGoal, getGoalStatus,
  logIncome, logExpense, addDebt, getFinanceReport,
  logHealth, getHealthReport,
  addTask, completeTask, getTasks, getTaskList,
  getMorningQuestions, getEveningQuestions, buildDailyReport
};
