const fs = require('fs');
const path = require('path');
const axios = require('axios');

const MEMORY_FILE = path.join(__dirname, 'alona-memory.json');
const REPO = 'denis0134-cell/sapir-bot';
const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

// ── Load / Save ──
function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8')) || [];
    }
  } catch {}
  return [];
}

function saveMemory(items) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(items, null, 2));
  // Persist to GitHub so it survives Railway restarts
  persistToGitHub(items).catch(() => {});
}

async function persistToGitHub(items) {
  try {
    const content = Buffer.from(JSON.stringify(items, null, 2)).toString('base64');
    let sha;
    try {
      const res = await axios.get(
        `https://api.github.com/repos/${REPO}/contents/alona-memory.json`,
        { headers: { Authorization: `Bearer ${GH_TOKEN}` } }
      );
      sha = res.data.sha;
    } catch {}
    const body = { message: 'Alona learned something new', content };
    if (sha) body.sha = sha;
    await axios.put(
      `https://api.github.com/repos/${REPO}/contents/alona-memory.json`,
      body,
      { headers: { Authorization: `Bearer ${GH_TOKEN}`, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[AlonaMemory] GitHub persist failed:', e.message);
  }
}

// Load from GitHub on startup
async function loadFromGitHub() {
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${REPO}/contents/alona-memory.json`,
      { headers: { Authorization: `Bearer ${GH_TOKEN}` } }
    );
    const items = JSON.parse(Buffer.from(res.data.content, 'base64').toString());
    if (items && items.length > 0) {
      saveMemory(items);
      console.log(`[AlonaMemory] Loaded ${items.length} lessons from GitHub`);
    }
  } catch {}
}

// ── Operations ──
function addLesson(lesson) {
  const items = loadMemory();
  if (!items.includes(lesson)) {
    items.push(lesson);
    saveMemory(items);
    return { added: true, total: items.length };
  }
  return { added: false, total: items.length };
}

function removeLesson(index) {
  const items = loadMemory();
  const idx = parseInt(index) - 1;
  if (idx >= 0 && idx < items.length) {
    const removed = items.splice(idx, 1)[0];
    saveMemory(items);
    return removed;
  }
  return null;
}

function clearAll() {
  saveMemory([]);
}

function getAll() {
  return loadMemory();
}

function formatMemoryForPrompt() {
  const items = loadMemory();
  if (!items.length) return '';
  return '\n\n📚 זיכרון — כללים שלמדתי מדניס:\n' + items.map((m, i) => `${i+1}. ${m}`).join('\n');
}

// ── Parse correction with Claude ──
async function parseLessonFromText(text) {
  try {
    const resp = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `דניס מתקן את אלונה (בוט AI שלו). חלץ כלל ברור ומעשי מהטקסט.
הכלל צריך להיות משפט אחד שמתחיל ב"כש" או "תמיד" או "לעולם לא".

טקסט: "${text}"

JSON בלבד: {"lesson": "הכלל" | null}`
      }]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });
    const raw = resp.data.content[0].text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    return parsed.lesson || null;
  } catch { return null; }
}

// ── Rewrite response with correction ──
async function rewriteWithCorrection(originalResponse, correction, context) {
  try {
    const memory = formatMemoryForPrompt();
    const resp = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: `אתה אלונה, עוזרת AI של דניס. כתבי מחדש את התגובה לפי הביקורת.${memory}`,
      messages: [{
        role: 'user',
        content: `הבקשה המקורית: "${context}"\nהתגובה שנתתי: "${originalResponse}"\nהביקורת של דניס: "${correction}"\n\nכתבי תגובה חדשה ומשופרת:`
      }]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });
    return resp.data.content[0].text.trim();
  } catch { return null; }
}

module.exports = {
  loadMemory, addLesson, removeLesson, clearAll, getAll,
  formatMemoryForPrompt, parseLessonFromText, rewriteWithCorrection, loadFromGitHub
};
