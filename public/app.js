const SESSION_KEY = 'openclaw-dashboard-pin';
const state = { pin: sessionStorage.getItem(SESSION_KEY) || '', availableModels: [], agents: [], workflows: [], news: [], employees: [], activeTab: 'bots' };

const $ = (id) => document.getElementById(id);
const el = { loginView: $('login-view'), dashboardView: $('dashboard-view'), loginForm: $('login-form'), pinInput: $('pin-input'), loginError: $('login-error'), refreshButton: $('refresh-button'), logoutButton: $('logout-button'), agentsGrid: $('agents-grid'), workflowsList: $('workflow-list'), newsList: $('news-list'), employeesGrid: $('employees-grid'), agentCount: $('agent-count'), workflowCount: $('workflow-count'), newsCount: $('news-count'), employeeCount: $('employee-count'), tabNav: $('tab-nav'), toast: $('toast') };

function api(path, opts = {}) {
  const h = new Headers(opts.headers || {});
  if (state.pin) h.set('x-pin', state.pin);
  if (opts.body && !h.has('Content-Type')) h.set('Content-Type', 'application/json');
  return fetch(path, { ...opts, headers: h });
}

function showToast(msg, err = false) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  el.toast.style.borderColor = err ? 'rgba(233,69,96,0.45)' : 'rgba(70,229,164,0.35)';
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => el.toast.classList.add('hidden'), 2600);
}

function setView(auth) {
  el.loginView.classList.toggle('hidden', auth);
  el.dashboardView.classList.toggle('hidden', !auth);
  el.loginView.classList.toggle('active', !auth);
  el.dashboardView.classList.toggle('active', auth);
  if (!auth) el.pinInput.focus();
}

function switchTab(id) {
  state.activeTab = id;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll('.tab-panel').forEach(p => { const a = p.id === `tab-${id}`; p.classList.toggle('active', a); p.classList.toggle('hidden', !a); });
}
el.tabNav.addEventListener('click', (e) => { const b = e.target.closest('.tab-btn'); if (b) switchTab(b.dataset.tab); });

function esc(v) { return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
function timeAgo(ts) { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return 'just now'; const m = Math.floor(s/60); if (m < 60) return `${m}m ago`; const h = Math.floor(m/60); if (h < 24) return `${h}h ago`; return `${Math.floor(h/24)}d ago`; }

function statusPill(status) {
  const cls = { Online: '', Offline: 'offline', Error: 'error', Repair: 'repair', Unknown: 'unknown' }[status] || 'unknown';
  return `<span class="status-pill ${cls}">${esc(status)}</span>`;
}

function renderAgents() {
  el.agentCount.textContent = String(state.agents.length);
  if (!state.agents.length) { el.agentsGrid.innerHTML = '<div class="empty-state">Geen agents gevonden.</div>'; return; }
  el.agentsGrid.innerHTML = state.agents.map((a) => {
    const opts = state.availableModels.map(m => `<option value="${esc(m)}" ${m === a.model ? 'selected' : ''}>${esc(m)}</option>`).join('');
    return `<article class="agent-card">
      <div class="agent-header">
        <div><div class="agent-name"><span class="agent-emoji">${a.emoji||'🤖'}</span> ${esc(a.name)}</div><div class="agent-role">${esc(a.role||'')}</div></div>
        ${statusPill(a.status)}
      </div>
      <div class="agent-body">
        ${a.description ? `<div class="agent-desc">${esc(a.description)}</div>` : ''}
        <div class="meta-row"><div class="meta-label">Model</div><div class="agent-meta model-tag">${esc(a.model)}</div></div>
        <label class="field"><span>Switch model</span><select data-agent-model="${esc(a.id)}">${opts}</select></label>
        <div class="card-actions"><a class="link-chip" href="${esc(a.trelloUrl)}" target="_blank" rel="noreferrer">📋 Trello</a></div>
      </div>
    </article>`;
  }).join('');

  el.agentsGrid.querySelectorAll('select[data-agent-model]').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const id = e.target.dataset.agentModel, model = e.target.value;
      const orig = state.agents.find(a => a.id === id)?.model || '';
      e.target.disabled = true;
      try {
        const r = await api(`/api/agents/${encodeURIComponent(id)}/model`, { method: 'POST', body: JSON.stringify({ model }) });
        const p = await r.json();
        if (!r.ok) throw new Error(p.error);
        const i = state.agents.findIndex(a => a.id === id);
        if (i !== -1) state.agents[i].model = model;
        renderAgents();
        showToast(`Model updated: ${p.agent?.name || id} → ${model}`);
      } catch (err) { e.target.value = orig; showToast(err.message, true); }
      finally { e.target.disabled = false; }
    });
  });
}

function renderWorkflows() {
  el.workflowCount.textContent = String(state.workflows.length);
  if (state._n8nOff) {
    el.workflowsList.innerHTML = `<div class="empty-state center"><div class="big-icon">⚡</div><div class="title">N8N Not Connected</div><div>Set <code>N8N_API_KEY</code> env var or start N8N locally.</div></div>`;
    return;
  }
  let html = `<div class="workflow-toolbar"><button class="btn-create" id="create-workflow-btn">+ New Workflow</button></div>`;
  if (!state.workflows.length) { html += '<div class="empty-state">Geen workflows. Start N8N of maak een nieuwe aan.</div>'; }
  else {
    html += state.workflows.map(w => `<article class="workflow-card">
      <div class="workflow-header"><div><div class="workflow-name">${esc(w.name||'Untitled')}</div><div class="workflow-meta">ID: ${esc(w.id||'?')}</div></div><span class="badge ${w.active?'active':''}">${w.active?'Active':'Inactive'}</span></div>
      <div class="workflow-body"><div class="toggle-row"><div class="workflow-meta">Toggle workflow</div><label class="switch"><input type="checkbox" data-wf-toggle="${esc(w.id||'')}" ${w.active?'checked':''}/><span class="slider"></span></label></div></div>
    </article>`).join('');
  }
  el.workflowsList.innerHTML = html;

  // Create workflow button
  const createBtn = document.getElementById('create-workflow-btn');
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const name = prompt('Workflow naam:');
      if (!name) return;
      try {
        const r = await api('/api/n8n/workflows', { method: 'POST', body: JSON.stringify({ name }) });
        const p = await r.json();
        if (!r.ok) throw new Error(p.error || 'Failed');
        showToast(`Workflow "${name}" aangemaakt!`);
        await loadDashboard();
      } catch (err) { showToast(err.message, true); }
    });
  }

  // Toggle handlers
  el.workflowsList.querySelectorAll('input[data-wf-toggle]').forEach(inp => {
    inp.addEventListener('change', async (e) => {
      const wfId = e.target.dataset.wfToggle, active = e.target.checked;
      e.target.disabled = true;
      try {
        const r = await api(`/api/n8n/workflows/${encodeURIComponent(wfId)}/toggle`, { method: 'POST', body: JSON.stringify({ active }) });
        if (!r.ok) throw new Error((await r.json()).error);
        const i = state.workflows.findIndex(w => String(w.id) === String(wfId));
        if (i !== -1) state.workflows[i].active = active;
        renderWorkflows();
        showToast(`Workflow ${active ? 'activated' : 'deactivated'}`);
      } catch (err) { e.target.checked = !active; showToast(err.message, true); }
      finally { e.target.disabled = false; }
    });
  });
}

function renderNews() {
  el.newsCount.textContent = String(state.news.length);
  if (!state.news.length) { el.newsList.innerHTML = '<div class="empty-state">Geen nieuws beschikbaar.</div>'; return; }
  el.newsList.innerHTML = state.news.map(n => {
    const domain = esc(n.source);
    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    return `<article class="news-card">
      <div class="news-content">
        <div class="news-icon"><img src="${favicon}" alt="" width="20" height="20" loading="lazy" onerror="this.style.display='none'"/></div>
        <div class="news-text">
          <a href="${esc(n.url)}" target="_blank" rel="noreferrer" class="news-title">${esc(n.title)}</a>
          <div class="news-meta-row">
            <span class="news-source">${domain}</span>
            <span class="news-dot">·</span>
            <span>${esc(timeAgo(n.time*1000))}</span>
            <span class="news-dot">·</span>
            <span>▲ ${n.score}</span>
            <span class="news-dot">·</span>
            <a href="${esc(n.hnUrl)}" target="_blank" rel="noreferrer" class="news-comments">${n.comments} 💬</a>
          </div>
        </div>
      </div>
    </article>`;
  }).join('');
}

function renderEmployees() {
  el.employeeCount.textContent = String(state.employees.length);
  if (!state.employees.length) { el.employeesGrid.innerHTML = '<div class="empty-state">Geen medewerkers.</div>'; return; }
  el.employeesGrid.innerHTML = state.employees.map(e => `<article class="employee-card">
    <div class="employee-avatar">${e.avatar||'👤'}</div>
    <div class="employee-info"><div class="employee-name">${esc(e.name)}</div><div class="employee-role">${esc(e.role)}</div><div class="employee-company">${esc(e.company)}</div></div>
    <div class="employee-actions">
      <span class="status-pill">${esc(e.status)}</span>
      ${e.trelloUrl ? `<a class="link-chip sm" href="${esc(e.trelloUrl)}" target="_blank" rel="noreferrer">📋 Trello</a>` : ''}
    </div>
  </article>`).join('');
}

async function loadDashboard() {
  el.refreshButton.disabled = true;
  try {
    const [aR, wR, nR, eR] = await Promise.all([api('/api/agents'), api('/api/n8n/workflows'), api('/api/news'), api('/api/employees')]);
    if (aR.status === 401) { logout(); showToast('Session expired.', true); return; }
    const aP = await aR.json();
    if (aR.ok) { state.availableModels = aP.availableModels || []; state.agents = aP.agents || []; }
    state._n8nOff = false;
    try { const wP = await wR.json(); if (wP._notConfigured) { state._n8nOff = true; state.workflows = []; } else if (wR.ok) { state.workflows = Array.isArray(wP) ? wP : wP.data || wP.workflows || []; } else { state.workflows = []; } } catch { state.workflows = []; }
    try { const nP = await nR.json(); state.news = nR.ok ? nP.news || [] : []; } catch { state.news = []; }
    try { const eP = await eR.json(); state.employees = eR.ok ? eP.employees || [] : []; } catch { state.employees = []; }
    renderAgents(); renderWorkflows(); renderNews(); renderEmployees(); setView(true);
    if (!aR.ok) showToast(aP.error || 'Failed to load', true);
  } catch (err) { renderAgents(); renderWorkflows(); renderNews(); renderEmployees(); setView(true); showToast(err.message, true); }
  finally { el.refreshButton.disabled = false; }
}

async function login(pin) {
  el.loginError.classList.add('hidden');
  const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
  const p = await r.json();
  if (!r.ok || !p.ok) throw new Error(p.error || 'Login failed');
  state.pin = pin; sessionStorage.setItem(SESSION_KEY, pin);
}

function logout() { state.pin = ''; state.agents = []; state.workflows = []; state.news = []; state.employees = []; sessionStorage.removeItem(SESSION_KEY); setView(false); }

el.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault(); const pin = el.pinInput.value.trim(); const btn = el.loginForm.querySelector('button[type="submit"]'); btn.disabled = true;
  try { await login(pin); el.pinInput.value = ''; await loadDashboard(); showToast('Dashboard unlocked'); } catch (err) { el.loginError.textContent = err.message; el.loginError.classList.remove('hidden'); } finally { btn.disabled = false; }
});
el.refreshButton.addEventListener('click', () => loadDashboard());
el.logoutButton.addEventListener('click', () => { logout(); showToast('Logged out'); });

if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); }
if (state.pin) loadDashboard(); else setView(false);
