const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3458;
const PIN = process.env.DASHBOARD_PIN || '1337';
const CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || '/Users/mylilbitch/.openclaw/openclaw.json';
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbG...ldaA';
const TRELLO_BOARD_URL = process.env.TRELLO_BOARD_URL || 'https://trello.com/b/ZTblLRG1';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function getAvailableModels(config) {
  const configured = Object.keys(config?.agents?.defaults?.models || {});
  const current = (config?.agents?.list || []).map((agent) => agent.model).filter(Boolean);
  return Array.from(new Set([...configured, ...current])).sort((a, b) => a.localeCompare(b));
}

function getAgentStatus(agent) {
  if (agent.workspace && fs.existsSync(agent.workspace)) {
    return 'Ready';
  }
  return 'Missing workspace';
}

function requirePin(req, res, next) {
  if (req.path === '/auth') {
    return next();
  }

  const pin = req.get('x-pin');
  if (pin !== PIN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

async function proxyN8n(req, res, targetPath, options = {}) {
  try {
    const fetchHeaders = { ...(options.headers || {}), 'X-N8N-API-KEY': N8N_API_KEY };
    const response = await fetch(`${N8N_BASE_URL}${targetPath}`, { ...options, headers: fetchHeaders });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'N8N request failed',
        details: payload
      });
    }

    if (typeof payload === 'string') {
      return res.type('text/plain').send(payload);
    }

    return res.json(payload);
  } catch (error) {
    return res.status(502).json({
      error: 'Unable to reach N8N',
      details: error.message
    });
  }
}

app.use('/api', requirePin);

app.post('/api/auth', (req, res) => {
  const { pin } = req.body || {};
  const ok = String(pin || '') === PIN;

  if (!ok) {
    return res.status(401).json({ ok: false, error: 'Invalid PIN' });
  }

  return res.json({ ok: true });
});

app.get('/api/agents', (req, res) => {
  try {
    const config = readConfig();
    const models = getAvailableModels(config);
    const agents = (config?.agents?.list || []).map((agent) => ({
      id: agent.id,
      name: agent.name || agent.id,
      model: agent.model || config?.agents?.defaults?.model?.primary || '',
      status: getAgentStatus(agent),
      workspace: agent.workspace || '',
      trelloUrl: TRELLO_BOARD_URL
    }));

    res.json({
      agents,
      availableModels: models,
      defaultModel: config?.agents?.defaults?.model?.primary || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load agents', details: error.message });
  }
});

app.post('/api/agents/:id/model', (req, res) => {
  try {
    const { id } = req.params;
    const { model } = req.body || {};

    if (!model || typeof model !== 'string') {
      return res.status(400).json({ error: 'Model is required' });
    }

    const config = readConfig();
    const agents = config?.agents?.list || [];
    const agentIndex = agents.findIndex((agent) => agent.id === id);

    if (agentIndex === -1) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    agents[agentIndex].model = model;
    writeConfig(config);

    return res.json({
      ok: true,
      agent: {
        id: agents[agentIndex].id,
        name: agents[agentIndex].name || agents[agentIndex].id,
        model: agents[agentIndex].model,
        status: getAgentStatus(agents[agentIndex]),
        workspace: agents[agentIndex].workspace || '',
        trelloUrl: TRELLO_BOARD_URL
      }
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

  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'Boolean active is required' });
  }

  await proxyN8n(req, res, `/workflows/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ active })
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`OpenClaw Dashboard listening on http://localhost:${PORT}`);
});
