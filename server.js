const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3458;
const PIN = process.env.DASHBOARD_PIN || '1337';
const CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || '/Users/mylilbitch/.openclaw/openclaw.json';
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const TRELLO_BOARD_URL = process.env.TRELLO_BOARD_URL || 'https://trello.com/b/ZTblLRG1';

// ═══════════════════════════════════════════════════════════════
// Real OpenClaw agent registry — the source of truth
// ═══════════════════════════════════════════════════════════════
const AGENT_REGISTRY = {
  main: {
    displayName: 'Alpine',
    emoji: '🤙',
    role: 'COO / Delegator',
    description: 'Dirigent die taken delegeert naar de juiste bot. Scherp, direct, chill.',
    trelloUrl: 'https://trello.com/b/ZTblLRG1',
    discordChannel: '#alpine'
  },
  mary: {
    displayName: 'Mia',
    emoji: '💕',
    role: 'Relatie-agent',
    description: 'Vriendin voor Mary. Luisteren, meevoelen, ordenen. Date nights, oppas, agenda.',
    trelloUrl: 'https://trello.com/b/ZTblLRG1',
    discordChannel: '#mia'
  },
  dev: {
    displayName: 'Nerd',
    emoji: '💻',
    role: 'Developer / Code & Scripts',
    description: 'Bouwt, fixt en debugt. Installaties, updates, configuraties, code schrijven.',
    trelloUrl: 'https://trello.com/b/ZTblLRG1',
    discordChannel: '#nerd'
  },
  candy: {
    displayName: 'Candy',
    emoji: '🍬',
    role: 'Communicatie / HR',
    description: 'Teamcommunicatie, Trello bewaken, agenda. Dagelijks overzicht van wat loopt en stokt.',
    trelloUrl: 'https://trello.com/b/ZTblLRG1',
    discordChannel: '#candy'
  },
  whizza: {
    displayName: 'Whizza',
    emoji: '🧠',
    role: 'Senior Consultant / Research',
    description: 'Slimste fallback bot. Deep research, complexe analyse, advies.',
    trelloUrl: 'https://trello.com/b/ZTblLRG1',
    discordChannel: '#whizza'
  },
  emma: {
    displayName: 'Emma',
    emoji: '🏠',
    role: 'Huismanager',
    description: 'Dagelijks WhatsApp briefing naar Ibu Kadek. Schoonmaak planning, organisatie.',
    trelloUrl: 'https://trello.com/b/ZTblLRG1',
    discordChannel: '#emma'
  },
  whelle: {
    displayName: 'Whelle',
    emoji: '🌐',
    role: 'WordPress Webmaster',
    description: 'De WordPress tante. Websites piekfijn via Elementor. SEO, performance, design.',
    trelloUrl: 'https://trello.com/b/ZTblLRG1',
    discordChannel: '#whelle'
  },
  marquise: {
    displayName: 'Marquise',
    emoji: '📊',
    role: 'Marketing Intelligence',
    description: 'Data-driven marketing researcher. Dagelijkse AI/markt briefings, concurrentie-analyse.',
    trelloUrl: 'https://trello.com/b/ZTblLRG1',
    discordChannel: '#marquise'
  }
};

// ═══════════════════════════════════════════════════════════════
// Real employees with their Trello boards
// ═══════════════════════════════════════════════════════════════
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
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function resolveAgents(config) {
  // Try to read real agents from openclaw.json
  const agentList = config?.agents?.list || [];
  const defaultModel = config?.agents?.defaults?.model?.primary || 'unknown';

  if (agentList.length > 0) {
    return agentList.map((agent) => {
      const meta = AGENT_REGISTRY[agent.id] || {};
      return {
        id: agent.id,
        name: meta.displayName || agent.name || agent.id,
        emoji: meta.emoji || '🤖',
        role: meta.role || 'Agent',
        description: meta.description || '',
        model: agent.model || defaultModel,
        status: agent.workspace && fs.existsSync(agent.workspace) ? 'Online' : 'Offline',
        workspace: agent.workspace || '',
        trelloUrl: meta.trelloUrl || TRELLO_BOARD_URL,
        discordChannel: meta.discordChannel || ''
      };
    });
  }

  // Fallback: build from registry (for Railway where no config exists)
  return Object.entries(AGENT_REGISTRY).map(([id, meta]) => ({
    id,
    name: meta.displayName,
    emoji: meta.emoji,
    role: meta.role,
    description: meta.description,
    model: defaultModel,
    status: 'Unknown',
    workspace: '',
    trelloUrl: meta.trelloUrl || TRELLO_BOARD_URL,
    discordChannel: meta.discordChannel || ''
  }));
}

function getAvailableModels(config) {
  const knownModels = [
    'anthropic/claude-sonnet-4-6',
    'anthropic/claude-opus-4-6',
    'openai/gpt-5.4',
    'minimax-portal/MiniMax-M2.7',
    'minimax-portal/MiniMax-M2.5',
    'zai/glm-5-turbo',
    'deepseek/deepseek-chat'
  ];
  const configured = Object.keys(config?.agents?.defaults?.models || {});
  const current = (config?.agents?.list || []).map((a) => a.model).filter(Boolean);
  return Array.from(new Set([...knownModels, ...configured, ...current])).sort();
}

function requirePin(req, res, next) {
  if (req.path === '/auth') return next();
  const pin = req.get('x-pin');
  if (pin !== PIN) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

async function proxyN8n(req, res, targetPath, options = {}) {
  if (!N8N_API_KEY) {
    return res.json({ data: [], _notConfigured: true, message: 'N8N API key not configured.' });
  }
  try {
    const fetchHeaders = { ...(options.headers || {}), 'X-N8N-API-KEY': N8N_API_KEY };
    const response = await fetch(`${N8N_BASE_URL}${targetPath}`, { ...options, headers: fetchHeaders });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) return res.status(response.status).json({ error: 'N8N request failed', details: payload });
    if (typeof payload === 'string') return res.type('text/plain').send(payload);
    return res.json(payload);
  } catch (error) {
    return res.status(502).json({ error: 'Unable to reach N8N', details: error.message });
  }
}

app.use('/api', requirePin);

app.post('/api/auth', (req, res) => {
  const { pin } = req.body || {};
  const ok = String(pin || '') === PIN;
  if (!ok) return res.status(401).json({ ok: false, error: 'Invalid PIN' });
  return res.json({ ok: true });
});

app.get('/api/agents', (req, res) => {
  try {
    const config = readConfig();
    const agents = resolveAgents(config);
    const models = getAvailableModels(config);
    res.json({
      agents,
      availableModels: models,
      defaultModel: config?.agents?.defaults?.model?.primary || 'anthropic/claude-sonnet-4-6'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load agents', details: error.message });
  }
});

app.post('/api/agents/:id/model', (req, res) => {
  try {
    const { id } = req.params;
    const { model } = req.body || {};
    if (!model || typeof model !== 'string') return res.status(400).json({ error: 'Model is required' });

    const config = readConfig();
    if (config) {
      const agents = config?.agents?.list || [];
      const idx = agents.findIndex((a) => a.id === id);
      if (idx !== -1) {
        agents[idx].model = model;
        try { writeConfig(config); } catch { /* Railway: read-only */ }
      }
    }

    const meta = AGENT_REGISTRY[id] || {};
    return res.json({
      ok: true,
      agent: { id, name: meta.displayName || id, model, emoji: meta.emoji || '🤖', role: meta.role || 'Agent' }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update model', details: error.message });
  }
});

app.get('/api/n8n/workflows', async (req, res) => {
  await proxyN8n(req, res, '/workflows');
});

app.post('/api/n8n/workflows/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const { active } = req.body || {};
  if (typeof active !== 'boolean') return res.status(400).json({ error: 'Boolean active is required' });
  await proxyN8n(req, res, `/workflows/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active })
  });
});

app.get('/api/news', async (req, res) => {
  try {
    const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const topStoryIds = await topStoriesRes.json();
    const ids = topStoryIds.slice(0, 20);
    const stories = await Promise.all(
      ids.map(async (id) => {
        try {
          const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          return await itemRes.json();
        } catch { return null; }
      })
    );
    const news = stories.filter(Boolean).map((story) => ({
      id: story.id,
      title: story.title || 'Untitled',
      url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
      source: story.url ? new URL(story.url).hostname.replace('www.', '') : 'news.ycombinator.com',
      score: story.score || 0,
      by: story.by || 'unknown',
      time: story.time || 0,
      comments: story.descendants || 0,
      hnUrl: `https://news.ycombinator.com/item?id=${story.id}`
    }));
    res.json({ news });
  } catch (error) {
    res.status(502).json({ error: 'Failed to fetch news', details: error.message });
  }
});

app.get('/api/employees', (req, res) => {
  res.json({ employees: EMPLOYEES });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`OpenClaw Dashboard listening on http://localhost:${PORT}`);
});
