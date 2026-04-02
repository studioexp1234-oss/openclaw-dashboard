const SESSION_KEY = 'openclaw-dashboard-pin';

const state = {
  pin: sessionStorage.getItem(SESSION_KEY) || '',
  availableModels: [],
  agents: [],
  workflows: [],
  news: [],
  employees: [],
  activeTab: 'bots'
};

const elements = {
  loginView: document.getElementById('login-view'),
  dashboardView: document.getElementById('dashboard-view'),
  loginForm: document.getElementById('login-form'),
  pinInput: document.getElementById('pin-input'),
  loginError: document.getElementById('login-error'),
  refreshButton: document.getElementById('refresh-button'),
  logoutButton: document.getElementById('logout-button'),
  agentsGrid: document.getElementById('agents-grid'),
  workflowsList: document.getElementById('workflow-list'),
  newsList: document.getElementById('news-list'),
  employeesGrid: document.getElementById('employees-grid'),
  agentCount: document.getElementById('agent-count'),
  workflowCount: document.getElementById('workflow-count'),
  newsCount: document.getElementById('news-count'),
  employeeCount: document.getElementById('employee-count'),
  tabNav: document.getElementById('tab-nav'),
  toast: document.getElementById('toast')
};

function api(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (state.pin) {
    headers.set('x-pin', state.pin);
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(path, {
    ...options,
    headers
  });
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  elements.toast.style.borderColor = isError ? 'rgba(233, 69, 96, 0.45)' : 'rgba(70, 229, 164, 0.35)';
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2600);
}

function setView(authenticated) {
  elements.loginView.classList.toggle('hidden', authenticated);
  elements.dashboardView.classList.toggle('hidden', !authenticated);
  elements.loginView.classList.toggle('active', !authenticated);
  elements.dashboardView.classList.toggle('active', authenticated);

  if (!authenticated) {
    elements.pinInput.focus();
  }
}

// Tab navigation
function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    const isActive = panel.id === `tab-${tabId}`;
    panel.classList.toggle('active', isActive);
    panel.classList.toggle('hidden', !isActive);
  });
}

elements.tabNav.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

function statusClass(status) {
  if (status === 'Online' || status === 'Ready') return 'status-pill';
  if (status === 'Unknown') return 'status-pill unknown';
  return 'status-pill warning';
}

function renderAgents() {
  elements.agentCount.textContent = String(state.agents.length);

  if (!state.agents.length) {
    elements.agentsGrid.innerHTML = '<div class="empty-state">No agents available in openclaw.json.</div>';
    return;
  }

  elements.agentsGrid.innerHTML = state.agents
    .map((agent) => {
      const options = state.availableModels
        .map((model) => `<option value="${escapeHtml(model)}" ${model === agent.model ? 'selected' : ''}>${escapeHtml(model)}</option>`)
        .join('');

      const emoji = agent.emoji || '🤖';
      const role = agent.role || '';
      const desc = agent.description || '';
      const discord = agent.discordChannel || '';

      return `
        <article class="agent-card">
          <div class="agent-header">
            <div>
              <div class="agent-name"><span class="agent-emoji">${emoji}</span> ${escapeHtml(agent.name)}</div>
              <div class="agent-role">${escapeHtml(role)}</div>
            </div>
            <span class="${statusClass(agent.status)}">${escapeHtml(agent.status)}</span>
          </div>
          <div class="agent-body">
            ${desc ? `<div class="agent-description">${escapeHtml(desc)}</div>` : ''}
            <div class="meta-row">
              <div class="meta-label">Model</div>
              <div class="agent-meta">${escapeHtml(agent.model)}</div>
            </div>
            <label class="field">
              <span>Switch model</span>
              <select data-agent-model="${escapeHtml(agent.id)}">${options}</select>
            </label>
            ${discord ? `<div class="meta-row"><div class="meta-label">Discord</div><div class="agent-meta">${escapeHtml(discord)}</div></div>` : ''}
            <div class="card-actions">
              <a class="link-chip" href="${escapeHtml(agent.trelloUrl)}" target="_blank" rel="noreferrer">📋 Trello</a>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  elements.agentsGrid.querySelectorAll('select[data-agent-model]').forEach((select) => {
    select.addEventListener('change', async (event) => {
      const agentId = event.target.dataset.agentModel;
      const model = event.target.value;
      const original = state.agents.find((item) => item.id === agentId)?.model || '';
      event.target.disabled = true;

      try {
        const response = await api(`/api/agents/${encodeURIComponent(agentId)}/model`, {
          method: 'POST',
          body: JSON.stringify({ model })
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Unable to update model');
        }

        const index = state.agents.findIndex((item) => item.id === agentId);
        if (index !== -1) {
          state.agents[index] = payload.agent;
        }
        renderAgents();
        showToast(`Model updated for ${payload.agent.name}`);
      } catch (error) {
        event.target.value = original;
        showToast(error.message, true);
      } finally {
        event.target.disabled = false;
      }
    });
  });
}

function renderWorkflows() {
  elements.workflowCount.textContent = String(state.workflows.length);

  if (state._n8nNotConfigured) {
    elements.workflowsList.innerHTML = `
      <div class="empty-state" style="text-align:center;padding:32px 20px;">
        <div style="font-size:2.4rem;margin-bottom:12px;">⚡</div>
        <div style="font-size:1.1rem;font-weight:600;margin-bottom:8px;">N8N Not Configured</div>
        <div>Set the <code style="background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:6px;">N8N_API_KEY</code> environment variable to connect your N8N instance.</div>
      </div>`;
    return;
  }

  if (!state.workflows.length) {
    elements.workflowsList.innerHTML = '<div class="empty-state">No workflows returned by N8N, or N8N is currently unavailable.</div>';
    return;
  }

  elements.workflowsList.innerHTML = state.workflows
    .map((workflow) => `
      <article class="workflow-card">
        <div class="workflow-header">
          <div>
            <div class="workflow-name">${escapeHtml(workflow.name || 'Untitled workflow')}</div>
            <div class="workflow-meta">ID: ${escapeHtml(workflow.id || 'Unknown')}</div>
          </div>
          <span class="badge">${workflow.active ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="workflow-body">
          <div class="toggle-row">
            <div class="workflow-meta">Toggle workflow state directly from the dashboard.</div>
            <label class="switch" aria-label="Toggle workflow ${escapeHtml(workflow.name || workflow.id || '')}">
              <input type="checkbox" data-workflow-toggle="${escapeHtml(workflow.id || '')}" ${workflow.active ? 'checked' : ''} />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </article>
    `)
    .join('');

  elements.workflowsList.querySelectorAll('input[data-workflow-toggle]').forEach((input) => {
    input.addEventListener('change', async (event) => {
      const workflowId = event.target.dataset.workflowToggle;
      const active = event.target.checked;
      event.target.disabled = true;

      try {
        const response = await api(`/api/n8n/workflows/${encodeURIComponent(workflowId)}/toggle`, {
          method: 'POST',
          body: JSON.stringify({ active })
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to update workflow');
        }

        const index = state.workflows.findIndex((item) => String(item.id) === String(workflowId));
        if (index !== -1) {
          state.workflows[index] = payload.data || payload;
          state.workflows[index].active = active;
        }
        renderWorkflows();
        showToast(`Workflow ${active ? 'activated' : 'deactivated'}`);
      } catch (error) {
        event.target.checked = !active;
        showToast(error.message, true);
      } finally {
        event.target.disabled = false;
      }
    });
  });
}

function renderNews() {
  elements.newsCount.textContent = String(state.news.length);

  if (!state.news.length) {
    elements.newsList.innerHTML = '<div class="empty-state">No news available. Try refreshing.</div>';
    return;
  }

  elements.newsList.innerHTML = state.news
    .map((item) => {
      const timeAgo = formatTimeAgo(item.time * 1000);
      return `
        <article class="news-card">
          <div class="news-header">
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer" class="news-title">${escapeHtml(item.title)}</a>
          </div>
          <div class="news-meta-row">
            <span class="news-source">${escapeHtml(item.source)}</span>
            <span class="news-dot">·</span>
            <span class="news-time">${escapeHtml(timeAgo)}</span>
            <span class="news-dot">·</span>
            <span class="news-score">▲ ${item.score}</span>
            <span class="news-dot">·</span>
            <a href="${escapeHtml(item.hnUrl)}" target="_blank" rel="noreferrer" class="news-comments">${item.comments} comments</a>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderEmployees() {
  elements.employeeCount.textContent = String(state.employees.length);

  if (!state.employees.length) {
    elements.employeesGrid.innerHTML = '<div class="empty-state">No employees loaded.</div>';
    return;
  }

  elements.employeesGrid.innerHTML = state.employees
    .map((emp) => `
      <article class="employee-card">
        <div class="employee-avatar">${emp.avatar || '👤'}</div>
        <div class="employee-info">
          <div class="employee-name">${escapeHtml(emp.name)}</div>
          <div class="employee-role">${escapeHtml(emp.role)}</div>
          <div class="employee-company">${escapeHtml(emp.company)}</div>
        </div>
        <div class="employee-actions">
          <span class="status-pill">${escapeHtml(emp.status)}</span>
          ${emp.trelloUrl ? `<a class="link-chip small" href="${escapeHtml(emp.trelloUrl)}" target="_blank" rel="noreferrer">📋 Trello</a>` : ''}
        </div>
      </article>
    `)
    .join('');
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function loadDashboard() {
  elements.refreshButton.disabled = true;

  try {
    const [agentsResponse, workflowsResponse, newsResponse, employeesResponse] = await Promise.all([
      api('/api/agents'),
      api('/api/n8n/workflows'),
      api('/api/news'),
      api('/api/employees')
    ]);

    if (agentsResponse.status === 401) {
      logout();
      showToast('Session expired. Please log in again.', true);
      return;
    }

    const agentsPayload = await agentsResponse.json();

    if (agentsResponse.ok) {
      state.availableModels = agentsPayload.availableModels || [];
      state.agents = agentsPayload.agents || [];
    }

    // Load workflows
    state._n8nNotConfigured = false;
    try {
      const workflowsPayload = await workflowsResponse.json();
      if (workflowsPayload._notConfigured) {
        state._n8nNotConfigured = true;
        state.workflows = [];
      } else if (workflowsResponse.ok) {
        state.workflows = Array.isArray(workflowsPayload)
          ? workflowsPayload
          : workflowsPayload.data || workflowsPayload.workflows || [];
      } else {
        state.workflows = [];
      }
    } catch {
      state.workflows = [];
    }

    // Load news
    try {
      const newsPayload = await newsResponse.json();
      if (newsResponse.ok) {
        state.news = newsPayload.news || [];
      } else {
        state.news = [];
      }
    } catch {
      state.news = [];
    }

    // Load employees
    try {
      const employeesPayload = await employeesResponse.json();
      if (employeesResponse.ok) {
        state.employees = employeesPayload.employees || [];
      } else {
        state.employees = [];
      }
    } catch {
      state.employees = [];
    }

    renderAgents();
    renderWorkflows();
    renderNews();
    renderEmployees();
    setView(true);

    if (!agentsResponse.ok) {
      showToast(agentsPayload.error || 'Failed to load agents', true);
    }
  } catch (error) {
    renderAgents();
    renderWorkflows();
    renderNews();
    renderEmployees();
    setView(true);
    showToast(error.message, true);
  } finally {
    elements.refreshButton.disabled = false;
  }
}

async function login(pin) {
  elements.loginError.classList.add('hidden');

  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pin })
  });

  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Login failed');
  }

  state.pin = pin;
  sessionStorage.setItem(SESSION_KEY, pin);
}

function logout() {
  state.pin = '';
  state.agents = [];
  state.workflows = [];
  state.news = [];
  state.employees = [];
  sessionStorage.removeItem(SESSION_KEY);
  setView(false);
}

elements.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const pin = elements.pinInput.value.trim();
  const submitButton = elements.loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    await login(pin);
    elements.pinInput.value = '';
    await loadDashboard();
    showToast('Dashboard unlocked');
  } catch (error) {
    elements.loginError.textContent = error.message;
    elements.loginError.classList.remove('hidden');
  } finally {
    submitButton.disabled = false;
  }
});

elements.refreshButton.addEventListener('click', () => {
  loadDashboard();
});

elements.logoutButton.addEventListener('click', () => {
  logout();
  showToast('Logged out');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

if (state.pin) {
  loadDashboard();
} else {
  setView(false);
}
