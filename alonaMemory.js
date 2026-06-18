const fs = require('fs');
const path = require('path');
const axios = require('axios');

const MEMORY_FILE = path.join(__dirname, 'alona-memory.json');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN_ALONA || process.env.GH_READ_TOKEN;
const REPO = 'denis0134-cell/sapir-bot';

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
}

function addLesson(lesson) {
  const items = loadMemory();
  // Avoid duplicates
  if (!items.includes(lesson)) {
    items.push(lesson);
    saveMemory(items);
    console.log('[AlonaMemory] Learned:', lesson);
  }
  return items;
}

function formatMemoryForPrompt() {
  const items = loadMemory();
  if (!items.length) return '';
  return '\n\nזיכרון — דברים שלמדתי מדניס:\n' + items.map((m, i) => `${i+1}. ${m}`).join('\n');
}

// Parse a correction message from Denis
async function parseLessonFromText(text) {
  try {
    const resp = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `דניס מתקן את אלונה הבוט שלו. חלץ את ה"כלל" שאלונה צריכה ללמוד מהטקסט הבא.
החזר משפט אחד קצר וברור שמתאר מה לעשות בעתיד.
אם אין כלל ברור — החזר null.

טקסט: "${text}"

החזר JSON: {"lesson": "הכלל שנלמד" | null}`
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

module.exports = { loadMemory, addLesson, formatMemoryForPrompt, parseLessonFromText };
