const SESSION_KEY = 'openclaw-dashboard-pin';

const state = {
  pin: sessionStorage.getItem(SESSION_KEY) || '',
  availableModels: [],
  agents: [],
  workflows: []
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
  agentCount: document.getElementById('agent-count'),
  workflowCount: document.getElementById('workflow-count'),
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

function statusClass(status) {
  return status === 'Ready' ? 'status-pill' : 'status-pill warning';
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

      return `
        <article class="agent-card">
          <div class="agent-header">
            <div>
              <div class="agent-name">${escapeHtml(agent.name)}</div>
              <div class="agent-id">${escapeHtml(agent.id)}</div>
            </div>
            <span class="${statusClass(agent.status)}">${escapeHtml(agent.status)}</span>
          </div>
          <div class="agent-body">
            <div class="meta-row">
              <div class="meta-label">Current model</div>
              <div class="agent-meta">${escapeHtml(agent.model)}</div>
            </div>
            <label class="field">
              <span>Switch model</span>
              <select data-agent-model="${escapeHtml(agent.id)}">${options}</select>
            </label>
            <div class="meta-row">
              <div class="meta-label">Workspace</div>
              <div class="agent-meta">${escapeHtml(agent.workspace || 'Unknown')}</div>
            </div>
            <div class="card-actions">
              <a class="link-chip" href="${escapeHtml(agent.trelloUrl)}" target="_blank" rel="noreferrer">Open Trello</a>
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
    const [agentsResponse, workflowsResponse] = await Promise.all([
      api('/api/agents'),
      api('/api/n8n/workflows')
    ]);

    if (agentsResponse.status === 401 || workflowsResponse.status === 401) {
      logout();
      showToast('Session expired. Please log in again.', true);
      return;
    }

    const agentsPayload = await agentsResponse.json();

    if (agentsResponse.ok) {
      state.availableModels = agentsPayload.availableModels || [];
      state.agents = agentsPayload.agents || [];
    }

    // Load workflows separately so N8N failures don't block agents
    try {
      const workflowsPayload = await workflowsResponse.json();
      if (workflowsResponse.ok) {
        state.workflows = Array.isArray(workflowsPayload)
          ? workflowsPayload
          : workflowsPayload.data || workflowsPayload.workflows || [];
      } else {
        state.workflows = [];
      }
    } catch {
      state.workflows = [];
    }

    renderAgents();
    renderWorkflows();
    setView(true);

    if (!agentsResponse.ok) {
      showToast(agentsPayload.error || 'Failed to load agents', true);
    }
  } catch (error) {
    renderAgents();
    renderWorkflows();
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
