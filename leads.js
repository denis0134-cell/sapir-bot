const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'leads.json');

function initDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '{}', 'utf8');
}

function readDB() {
  initDB();
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return {}; }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function getLead(phone) {
  return readDB()[phone] || null;
}

function upsertLead(phone, updates) {
  const db = readDB();
  db[phone] = {
    phone,
    name: null, profession: null, business: null,
    currentRevenue: null, goal: null, painPoints: [], notes: null,
    status: 'new',
    proposalUrl: null, proposalProgram: null, proposalPrice: null,
    followupCount: 0, lastFollowupAt: null,
    lastMessageAt: null, lastResponseAt: new Date().toISOString(),
    conversation: [], createdAt: new Date().toISOString(),
    ...(db[phone] || {}),
    ...updates,
    updatedAt: new Date().toISOString()
  };
  writeDB(db);
  return db[phone];
}

function addMessage(phone, role, content) {
  const db = readDB();
  if (!db[phone]) upsertLead(phone, {});
  db[phone].conversation = db[phone].conversation || [];
  db[phone].conversation.push({ role, content, timestamp: new Date().toISOString() });
  db[phone].updatedAt = new Date().toISOString();
  if (role === 'user') {
    db[phone].lastResponseAt = new Date().toISOString();
    db[phone].lastMessageAt = new Date().toISOString();
  }
  writeDB(db);
}

function getConversation(phone) {
  const lead = getLead(phone);
  if (!lead) return [];
  return (lead.conversation || []).map(m => ({ role: m.role, content: m.content }));
}

function getLeadsForFollowup() {
  const db = readDB();
  const now = new Date();
  return Object.values(db).filter(lead => {
    if (lead.phone === process.env.DENIS_PHONE) return false;
    if (['closed', 'not_relevant', 'booked'].includes(lead.status)) return false;
    if (!lead.lastMessageAt) return false;
    if ((lead.followupCount || 0) >= 6) return false;
    if (lead.lastFollowupAt) {
      const h = (now - new Date(lead.lastFollowupAt)) / 3600000;
      if (h < 12) return false;
    }
    if (lead.lastResponseAt) {
      const h = (now - new Date(lead.lastResponseAt)) / 3600000;
      if (h < 3) return false;
    }
    return true;
  });
}

function markNotRelevant(phone) {
  return upsertLead(phone, { status: 'not_relevant' });
}

module.exports = { getLead, upsertLead, addMessage, getConversation, getLeadsForFollowup, markNotRelevant, findLeadsByName, getNamedLeads };

// Find leads by partial name match
function findLeadsByName(query) {
  const db = readDB();
  const q = query.toLowerCase().trim();
  return Object.values(db).filter(lead => {
    if (!lead.name) return false;
    return lead.name.toLowerCase().includes(q);
  });
}

// Get all leads that have a name
function getNamedLeads() {
  const db = readDB();
  return Object.values(db).filter(l => l.name);
}

