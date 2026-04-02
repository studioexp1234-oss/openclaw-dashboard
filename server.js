const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3458;
const PIN = process.env.DASHBOARD_PIN || '1337';
const CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || '/Users/mylilbitch/.openclaw/openclaw.json';
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const TRELLO_BOARD_URL = process.env.TRELLO_BOARD_URL || 'https://trello.com/b/ZTblLRG1';

// ═══════════════════════════════════════
// Agent registry
// ═══════════════════════════════════════
const AGENT_REGISTRY = {
  main: { displayName: 'Alpine', emoji: '🤙', role: 'COO / Delegator', description: 'Dirigent die taken delegeert naar de juiste bot. Scherp, direct, chill.', trelloUrl: 'https://trello.com/b/ZTblLRG1', discordAccount: 'default' },
  mary: { displayName: 'Mia', emoji: '💕', role: 'Relatie-agent', description: 'Vriendin voor Mary. Date nights, oppas, agenda.', trelloUrl: 'https://trello.com/b/ZTblLRG1', discordAccount: 'mia' },
  dev: { displayName: 'Nerd', emoji: '💻', role: 'Developer', description: 'Bouwt, fixt en debugt. Code, scripts, installaties.', trelloUrl: 'https://trello.com/b/ZTblLRG1', discordAccount: 'nerd' },
  candy: { displayName: 'Candy', emoji: '🍬', role: 'Communicatie / HR', description: 'Teamcommunicatie, Trello, dagelijks overzicht.', trelloUrl: 'https://trello.com/b/ZTblLRG1', discordAccount: 'candy' },
  whizza: { displayName: 'Whizza', emoji: '🧠', role: 'Senior Consultant', description: 'Deep research, complexe analyse, advies.', trelloUrl: 'https://trello.com/b/ZTblLRG1', discordAccount: 'whizza' },
  emma: { displayName: 'Emma', emoji: '🏠', role: 'Huismanager', description: 'WhatsApp briefing naar Ibu Kadek. Schoonmaak, organisatie.', trelloUrl: 'https://trello.com/b/ZTblLRG1', discordAccount: 'emma' },
  whelle: { displayName: 'Whelle', emoji: '🌐', role: 'WordPress Webmaster', description: 'Websites via Elementor. SEO, performance, design.', trelloUrl: 'https://trello.com/b/ZTblLRG1', discordAccount: 'whelle' },
  marquise: { displayName: 'Marquise', emoji: '📊', role: 'Marketing Intelligence', description: 'Data-driven marketing, AI briefings, concurrentie-analyse.', trelloUrl: 'https://trello.com/b/ZTblLRG1', discordAccount: 'marquise' }
};

const EMPLOYEES = [
  { id: 1, name: 'Taam', role: 'Sales', status: 'Active', company: 'Helden', avatar: '🧑‍💼', trelloUrl: 'https://trello.com/b/xIE688ee' },
  { id: 2, name: 'Bagus', role: 'Delivery Manager', status: 'Active', company: 'Helden', avatar: '👨‍💻', trelloUrl: 'https://trello.com/b/wKdc5V7X' },
  { id: 3, name: 'Sharon', role: 'Project Manager', status: 'Active', company: 'Helden', avatar: '📋', trelloUrl: 'https://trello.com/b/gThF0QlX' },
  { id: 4, name: 'Arbiyan', role: 'Marketing', status: 'Active', company: 'Helden', avatar: '📈', trelloUrl: 'https://trello.com/b/F2lPKrB6' },
  { id: 5, name: 'Dito', role: 'Developer', status: 'Active', company: 'Helden', avatar: '🚀', trelloUrl: 'https://trello.com/b/CBznQepJ/dito-dev' },
  { id: 6, name: 'Andy', role: 'Full Stack Developer', status: 'Active', company: 'Helden', avatar: '⚙️', trelloUrl: null }
];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return null; }
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

// Get live bot status via openclaw CLI
function getLiveStatus() {
  try {
    const output = execSync('openclaw channels status 2>&1', { timeout: 10000, encoding: 'utf8' });
    const statuses = {};
    for (const line of output.split('\n')) {
      if (!line.startsWith('- Discord')) continue;
      const accountMatch = line.match(/Discord (\w+):/);
      if (!accountMatch) continue;
      const account = accountMatch[1];
      const connected = line.includes('connected');
      const running = line.includes('running');
      const stopped = line.includes('stopped');
      const error = line.includes('error');
      statuses[account] = error ? 'error' : (connected && running) ? 'online' : stopped ? 'offline' : 'unknown';
    }
    return statuses;
  } catch { return {}; }
}

// Get cron errors per agent
function getCronErrors() {
  try {
    const output = execSync('openclaw cron list 2>&1', { timeout: 10000, encoding: 'utf8' });
    const errors = {};
    for (const line of output.split('\n')) {
      if (!line.includes('error')) continue;
      const agentMatch = line.match(/\s(main|mary|dev|candy|whizza|emma|whelle|marquise)\s/);
      if (agentMatch) errors[agentMatch[1]] = true;
    }
    return errors;
  } catch { return {}; }
}

function resolveAgents(config) {
  const liveStatus = getLiveStatus();
  const cronErrors = getCronErrors();
  const agentList = config?.agents?.list || [];
  const defaultModel = config?.agents?.defaults?.model?.primary || 'unknown';

  const buildAgent = (id, agentData) => {
    const meta = AGENT_REGISTRY[id] || {};
    const discordAccount = meta.discordAccount || id;
    const channelStatus = liveStatus[discordAccount] || 'unknown';
    const hasCronErrors = cronErrors[id] || false;
    let status = channelStatus === 'online' ? 'Online' : channelStatus === 'offline' ? 'Offline' : channelStatus === 'error' ? 'Error' : 'Unknown';
    if (hasCronErrors && status === 'Online') status = 'Repair';
    return {
      id,
      name: meta.displayName || agentData?.name || id,
      emoji: meta.emoji || '🤖',
      role: meta.role || 'Agent',
      description: meta.description || '',
      model: agentData?.model || defaultModel,
      status,
      trelloUrl: meta.trelloUrl || TRELLO_BOARD_URL,
      discordChannel: `#${meta.displayName?.toLowerCase() || id}`
    };
  };

  if (agentList.length > 0) {
    return agentList.map((a) => buildAgent(a.id, a));
  }
  return Object.entries(AGENT_REGISTRY).map(([id, meta]) => buildAgent(id, null));
}

function getAvailableModels(config) {
  const knownModels = ['anthropic/claude-sonnet-4-6','anthropic/claude-opus-4-6','openai/gpt-5.4','minimax-portal/MiniMax-M2.7','minimax-portal/MiniMax-M2.5','zai/glm-5-turbo','deepseek/deepseek-chat'];
  const current = (config?.agents?.list || []).map((a) => a.model).filter(Boolean);
  return Array.from(new Set([...knownModels, ...current])).sort();
}

function requirePin(req, res, next) {
  if (req.path === '/auth') return next();
  if (req.get('x-pin') !== PIN) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

async function proxyN8n(req, res, targetPath, options = {}) {
  if (!N8N_API_KEY) return res.json({ data: [], _notConfigured: true, message: 'N8N API key not configured.' });
  try {
    const fetchHeaders = { ...(options.headers || {}), 'X-N8N-API-KEY': N8N_API_KEY };
    const response = await fetch(`${N8N_BASE_URL}${targetPath}`, { ...options, headers: fetchHeaders });
    const ct = response.headers.get('content-type') || '';
    const payload = ct.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) return res.status(response.status).json({ error: 'N8N request failed', details: payload });
    return typeof payload === 'string' ? res.type('text/plain').send(payload) : res.json(payload);
  } catch (error) { return res.status(502).json({ error: 'Unable to reach N8N', details: error.message }); }
}

app.use('/api', requirePin);

app.post('/api/auth', (req, res) => {
  const ok = String(req.body?.pin || '') === PIN;
  if (!ok) return res.status(401).json({ ok: false, error: 'Invalid PIN' });
  return res.json({ ok: true });
});

app.get('/api/agents', (req, res) => {
  try {
    const config = readConfig();
    res.json({ agents: resolveAgents(config), availableModels: getAvailableModels(config), defaultModel: config?.agents?.defaults?.model?.primary || 'anthropic/claude-sonnet-4-6' });
  } catch (error) { res.status(500).json({ error: 'Failed to load agents', details: error.message }); }
});

app.post('/api/agents/:id/model', (req, res) => {
  try {
    const { id } = req.params;
    const { model } = req.body || {};
    if (!model) return res.status(400).json({ error: 'Model is required' });
    const config = readConfig();
    if (config) {
      const agents = config?.agents?.list || [];
      const idx = agents.findIndex((a) => a.id === id);
      if (idx !== -1) { agents[idx].model = model; try { writeConfig(config); } catch {} }
    }
    // Restart gateway to pick up model change
    try { execSync('openclaw gateway restart 2>&1', { timeout: 15000 }); } catch {}
    const meta = AGENT_REGISTRY[id] || {};
    return res.json({ ok: true, agent: { id, name: meta.displayName || id, model, emoji: meta.emoji || '🤖', role: meta.role || 'Agent', status: 'Online' } });
  } catch (error) { return res.status(500).json({ error: 'Failed to update model', details: error.message }); }
});

app.get('/api/n8n/workflows', async (req, res) => { await proxyN8n(req, res, '/workflows'); });

app.post('/api/n8n/workflows/:id/toggle', async (req, res) => {
  const { active } = req.body || {};
  if (typeof active !== 'boolean') return res.status(400).json({ error: 'Boolean active is required' });
  await proxyN8n(req, res, `/workflows/${encodeURIComponent(req.params.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) });
});

app.post('/api/n8n/workflows', async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  await proxyN8n(req, res, '/workflows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, nodes: [], connections: {}, settings: {} }) });
});

app.get('/api/news', async (req, res) => {
  try {
    const topIds = await (await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')).json();
    const stories = await Promise.all(topIds.slice(0, 20).map(async (id) => {
      try { return await (await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)).json(); } catch { return null; }
    }));
    const news = stories.filter(Boolean).map((s) => ({
      id: s.id, title: s.title || 'Untitled',
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
      source: s.url ? new URL(s.url).hostname.replace('www.', '') : 'news.ycombinator.com',
      score: s.score || 0, by: s.by || 'unknown', time: s.time || 0,
      comments: s.descendants || 0,
      hnUrl: `https://news.ycombinator.com/item?id=${s.id}`
    }));
    res.json({ news });
  } catch (error) { res.status(502).json({ error: 'Failed to fetch news', details: error.message }); }
});

app.get('/api/employees', (req, res) => { res.json({ employees: EMPLOYEES }); });

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.listen(PORT, () => { console.log(`OpenClaw Dashboard listening on http://localhost:${PORT}`); });
