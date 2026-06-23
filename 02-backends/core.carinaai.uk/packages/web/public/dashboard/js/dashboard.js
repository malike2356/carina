(function () {
  const FEED_PAGE_SIZE = 7;

  const state = {
    apiKey: document.querySelector('meta[name="scout-api-key"]')?.content || window.SCOUT_API_KEY || '',
    agents: [],
    events: [],
    feedPage: 0,
    threatChart: null,
    activeInstanceId: null,
  };

  const $ = (id) => document.getElementById(id);

  function headers(extra) {
    return {
      ...(state.apiKey ? { 'X-Scout-Key': state.apiKey } : {}),
      ...(extra || {}),
    };
  }

  async function fetchJson(path, options) {
    const res = await fetch(path, { ...options, headers: headers(options && options.headers) });
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
    return res.json();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function timeLabel(value) {
    if (!value) return 'never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'unknown';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function setUpdated() {
    $('last-updated').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function setConnection(online) {
    const el = $('connection-state');
    el.textContent = online ? 'Scout live' : 'Scout offline';
    el.classList.toggle('online', online);
    el.classList.toggle('offline', !online);
  }

  function setHostConnection(online) {
    const el = $('host-state');
    if (!el) return;
    el.textContent = online ? 'Host live' : 'Host offline';
    el.classList.toggle('online', online);
    el.classList.toggle('offline', !online);
  }

  function formatUptime(seconds) {
    if (!seconds && seconds !== 0) return 'uptime unknown';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m uptime` : `${m}m uptime`;
  }

  function renderHost(data) {
    const host = data.host || data;
    setHostConnection(Boolean(host.running));
    $('host-gateway').textContent = host.running ? 'online' : 'offline';
    $('host-uptime').textContent = formatUptime(host.uptimeSeconds);
    $('host-agents').textContent = String(host.agents ?? 0);
    $('host-memory').textContent = `memory: ${host.memoryBackend || 'unknown'}`;
    $('host-devices').textContent = String(host.pairedDevices ?? 0);
    $('host-cron').textContent = host.cronJobs === null ? 'n/a' : String(host.cronJobs ?? 0);
    const enabled = (host.channels || []).filter((c) => c.enabled).map((c) => c.name);
    $('host-channels').textContent = enabled.length ? `channels: ${enabled.join(', ')}` : 'no channels enabled';
    if ($('host-version')) $('host-version').textContent = `v${host.version || '0.1.0'} @ ${host.hostname || 'host'}`;
  }

  function renderDevices(devices) {
    const el = $('device-list');
    if (!el) return;
    const rows = devices || [];
    el.innerHTML = rows.length ? rows.map((d) => `
      <div class="device-row">
        <span><strong>${escapeHtml(d.name)}</strong> (${escapeHtml(d.platform)})</span>
        <span class="agent-meta">${escapeHtml(d.id.slice(0, 8))} · last seen ${escapeHtml(timeLabel(d.lastSeenAt))}</span>
      </div>
    `).join('') : '<div class="device-row"><span class="agent-meta">No paired devices</span></div>';
  }

  async function loadHost() {
    try {
      const data = await fetchJson('/api/control/status');
      renderHost(data);
    } catch {
      setHostConnection(false);
    }
    try {
      const data = await fetchJson('/api/control/devices');
      renderDevices(data.devices || []);
    } catch {
      renderDevices([]);
    }
  }

  function normalizeEvent(raw) {
    return raw && raw.data ? raw.data : raw;
  }

  function renderAgents(data) {
    const agents = data.agents || data.instances || [];
    state.agents = agents;
    state.activeInstanceId = agents.find((agent) => agent.status === 'active')?.id || agents[0]?.id || state.activeInstanceId;

    const active = Number(data.active ?? agents.filter((agent) => agent.status === 'active').length);
    const suspended = Number(data.suspended ?? agents.filter((agent) => agent.status === 'suspended').length);
    $('metric-agents').textContent = String(data.total ?? agents.length);
    $('metric-agents-detail').textContent = `${active} active, ${suspended} suspended`;

    $('agent-list').innerHTML = agents.length ? agents.map((agent) => `
      <div class="agent-row">
        <strong>${escapeHtml(agent.name || agent.id || 'unknown')}</strong>
        <span class="agent-meta">${escapeHtml(agent.status || 'unknown')} - last seen ${escapeHtml(timeLabel(agent.last_heartbeat || agent.lastSeen))}</span>
        ${agent.suspension_reason ? `<span class="agent-meta">${escapeHtml(agent.suspension_reason)}</span>` : ''}
      </div>
    `).join('') : '<div class="agent-row"><span class="agent-meta">No agents reporting yet</span></div>';
  }

  function renderThreats(data) {
    const bySeverity = data.bySeverity || data.severity || {};
    const critical = Number(bySeverity.critical || data.critical || 0);
    const breach = Number(bySeverity.breach || data.breach || 0);
    const warning = Number(bySeverity.warning || data.warning || 0);
    const info = Number(bySeverity.info || data.info || 0);
    const total = Number(data.total || critical + breach + warning + info);
    const blocked = Number(data.blocked || data.blockedCount || 0);

    $('metric-threats').textContent = String(total);
    $('metric-threats-detail').textContent = `${critical} critical, ${breach} breach`;
    $('metric-blocked').textContent = String(blocked);

    updateThreatChart([info, warning, critical, breach]);

    const sources = data.topSources || data.sources || [];
    $('top-sources').innerHTML = sources.length ? sources.slice(0, 6).map((source) => `
      <div class="source-row"><span>${escapeHtml(source.ip || source.source || 'unknown')}</span><strong>${escapeHtml(source.count || 0)}</strong></div>
    `).join('') : '<div class="source-row"><span>No attack sources in the current window</span><strong>0</strong></div>';
  }

  function updateThreatChart(values) {
    const canvas = $('threat-chart');
    if (!window.Chart || !canvas) return;
    if (!state.threatChart) {
      state.threatChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['Info', 'Warning', 'Critical', 'Breach'],
          datasets: [{ data: values, backgroundColor: ['#60a5fa', '#f4bf50', '#ff5c6c', '#b455ff'], borderWidth: 0 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e7eef4' } } } },
      });
      return;
    }
    state.threatChart.data.datasets[0].data = values;
    state.threatChart.update();
  }

  function renderUsage(data) {
    const used = Number(data.used || data.tokens_used || 0);
    const limit = Number(data.limit || data.token_limit || 0);
    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : Number(data.percent || 0);
    $('metric-tokens').textContent = `${pct}%`;
    $('metric-tokens-detail').textContent = `${used.toLocaleString()} / ${limit.toLocaleString()} tokens`;
    $('token-meter').style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }

  function pushLiveEvent(raw) {
    const event = normalizeEvent(raw);
    if (!event || event.type === 'heartbeat') return;
    state.events = [event, ...state.events.filter((item) => item.id !== event.id)].slice(0, 80);
    renderLiveFeed();
  }

  function renderLiveFeed() {
    const total = state.events.length;
    const totalPages = Math.max(1, Math.ceil(total / FEED_PAGE_SIZE));
    if (state.feedPage >= totalPages) state.feedPage = totalPages - 1;
    const start = state.feedPage * FEED_PAGE_SIZE;
    const pageEvents = state.events.slice(start, start + FEED_PAGE_SIZE);

    $('live-feed').innerHTML = pageEvents.length ? pageEvents.map((event, i) => `
      <li class="feed-item" data-idx="${start + i}" title="Click for details">
        <div class="feed-meta">${escapeHtml(timeLabel(event.created_at))} &middot; <span class="severity-${escapeHtml(event.severity)}">${escapeHtml(event.severity || 'info')}</span> &middot; ${escapeHtml(event.instance_id || 'system')}</div>
        <strong class="feed-type">${escapeHtml(event.event_type || event.type || 'event')}</strong>
        <span class="feed-desc">${escapeHtml(event.description || '')}</span>
      </li>
    `).join('') : '<li class="feed-item"><span class="feed-meta">Waiting for live events</span></li>';

    const label = $('feed-page-label');
    const prev = $('feed-prev');
    const next = $('feed-next');
    if (label) label.textContent = `${state.feedPage + 1} / ${totalPages}`;
    if (prev) prev.disabled = state.feedPage === 0;
    if (next) next.disabled = state.feedPage >= totalPages - 1;
  }

  function showEventDetail(idx) {
    const event = state.events[idx];
    if (!event) return;
    const dialog = $('event-detail-dialog');
    if (!dialog) return;
    $('detail-type').textContent = event.event_type || event.type || 'Event';
    $('detail-body').innerHTML = [
      ['Time', timeLabel(event.created_at)],
      ['Severity', event.severity],
      ['Instance', event.instance_id || 'system'],
      ['Session', event.session_id],
      ['Code', event.code],
      ['Description', event.description],
      ['Raw type', event.type !== event.event_type ? event.type : null],
    ].filter(([, v]) => v).map(([k, v]) => `
      <div class="detail-row">
        <dt>${escapeHtml(String(k))}</dt>
        <dd class="${k === 'Severity' ? `severity-${escapeHtml(String(v))}` : ''}">${escapeHtml(String(v))}</dd>
      </div>
    `).join('');
    dialog.showModal();
  }

  function renderAudit(rows) {
    $('audit-log').innerHTML = rows.length ? rows.map((event) => `
      <tr>
        <td>${escapeHtml(timeLabel(event.created_at))}</td>
        <td class="severity-${escapeHtml(event.severity)}">${escapeHtml(event.severity)}</td>
        <td>${escapeHtml(event.event_type)}</td>
        <td>${escapeHtml(event.instance_id || 'system')}</td>
        <td>${escapeHtml(event.description)}</td>
      </tr>
    `).join('') : '<tr><td colspan="5">No audit events found</td></tr>';
  }

  async function loadAgents() {
    try { renderAgents(await fetchJson('/api/dashboard/agent-status')); } catch { renderAgents({ agents: [] }); }
  }

  async function loadThreats() {
    try { renderThreats(await fetchJson('/api/dashboard/threat-metrics')); } catch { renderThreats({}); }
  }

  async function loadUsage() {
    try { renderUsage(await fetchJson('/api/dashboard/usage-analytics')); } catch { renderUsage({ used: 0, limit: 0, percent: 0 }); }
  }

  async function loadFeed() {
    try {
      const data = await fetchJson('/api/events?limit=40');
      state.events = data.events || [];
      renderLiveFeed();
    } catch {
      renderLiveFeed();
    }
  }

  async function loadAudit(query) {
    const q = query ? `?q=${encodeURIComponent(query)}&limit=100` : '?limit=100';
    try {
      const data = await fetchJson(`/api/dashboard/audit-log${q}`);
      renderAudit(data.events || []);
    } catch {
      try {
        const fallback = await fetchJson('/api/events?limit=100');
        renderAudit(fallback.events || []);
      } catch {
        renderAudit([]);
      }
    }
  }

  function connectRealtime() {
    if (window.SCOUT_REALTIME === 'websocket') {
      const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
      const socket = new WebSocket(`${scheme}://${location.host}/api/dashboard/ws`);
      socket.addEventListener('open', () => {
        setConnection(true);
        socket.send(JSON.stringify({ type: 'subscribe', channels: ['live_event', 'threat_update', 'agent_update', 'kill_switch_status', 'audit_results', 'token_update'] }));
      });
      socket.addEventListener('message', (message) => handleRealtimeMessage(JSON.parse(message.data)));
      socket.addEventListener('close', () => setConnection(false));
      socket.addEventListener('error', () => setConnection(false));
      return;
    }

    if (!window.EventSource) return;
    const stream = new EventSource('/api/sse');
    stream.addEventListener('open', () => setConnection(true));
    stream.addEventListener('error', () => setConnection(false));
    ['live_event', 'threat_update', 'agent_update', 'audit_results', 'token_update', 'kill_switch_status'].forEach((name) => {
      stream.addEventListener(name, (message) => handleRealtimeMessage(JSON.parse(message.data)));
    });
  }

  function handleRealtimeMessage(message) {
    const type = message.type;
    const data = message.data || message;
    if (type === 'live_event' || type === 'event') pushLiveEvent(data);
    if (type === 'threat_update') void loadThreats();
    if (type === 'agent_update') void loadAgents();
    if (type === 'audit_results') void loadAudit($('audit-query').value.trim());
    if (type === 'token_update') void loadUsage();
    if (type === 'kill_switch_status') $('kill-result').textContent = data.confirmation || data.description || 'Kill switch status updated';
    setUpdated();
  }

  async function activateKillSwitch() {
    const reason = $('kill-reason').value.trim();
    if (!reason) return;
    const instanceId = state.activeInstanceId || 'all';
    $('kill-result').textContent = 'Activating...';
    try {
      const data = await fetchJson(`/api/kill/${encodeURIComponent(instanceId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      $('kill-result').textContent = data.confirmation || `KILL SWITCH ACTIVATED - ${new Date().toISOString()} by operator`;
      await Promise.allSettled([loadAgents(), loadAudit($('audit-query').value.trim())]);
    } catch (err) {
      $('kill-result').textContent = err.message || 'Kill switch failed';
    }
  }

  async function refreshAll() {
    await Promise.allSettled([
      loadHost(),
      loadAgents(),
      loadThreats(),
      loadUsage(),
      loadFeed(),
      loadAudit($('audit-query').value.trim()),
    ]);
    setUpdated();
  }

  async function createPairingCode() {
    try {
      const data = await fetchJson('/api/pairing/code', { method: 'POST' });
      window.alert(`Pairing code: ${data.code}\nExpires: ${data.expiresAt}`);
    } catch (err) {
      window.alert(err.message || 'Failed to create pairing code');
    }
  }

  async function reloadSecrets() {
    try {
      const data = await fetchJson('/api/control/reload-secrets', { method: 'POST' });
      window.alert(`Reloaded ${data.reloaded} env key(s)`);
    } catch (err) {
      window.alert(err.message || 'Reload failed');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const isControl = document.body.dataset.controlCenter === 'true';
    if (isControl && $('top-eyebrow')) {
      $('top-eyebrow').textContent = 'Carina Host';
      $('top-title').textContent = 'Control Center';
    }
    const navControl = $('nav-control');
    const navSecurity = $('nav-security');
    if (navControl) navControl.classList.toggle('nav--active', isControl);
    if (navSecurity) navSecurity.classList.toggle('nav--active', !isControl);
    const navChat = $('nav-chat');
    if (navChat) navChat.classList.remove('nav--active');
    if (document.body.dataset.tenantScout === 'true') {
      const killBtn = $('kill-switch');
      if (killBtn) killBtn.hidden = true;
      const adminName = $('admin-name');
      if (adminName) adminName.textContent = 'tenant';
    }
    $('refresh-feed').addEventListener('click', () => { state.feedPage = 0; void loadFeed(); });
    $('live-feed').addEventListener('click', (e) => {
      const item = e.target.closest('.feed-item[data-idx]');
      if (item) showEventDetail(Number(item.dataset.idx));
    });
    const prevBtn = $('feed-prev');
    const nextBtn = $('feed-next');
    if (prevBtn) prevBtn.addEventListener('click', () => { state.feedPage = Math.max(0, state.feedPage - 1); renderLiveFeed(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { state.feedPage = Math.min(Math.ceil(state.events.length / FEED_PAGE_SIZE) - 1, state.feedPage + 1); renderLiveFeed(); });
    const detailDialog = $('event-detail-dialog');
    if (detailDialog) detailDialog.addEventListener('click', (e) => { if (e.target === detailDialog) detailDialog.close(); });
    const pairBtn = $('pairing-code');
    if (pairBtn) pairBtn.addEventListener('click', () => void createPairingCode());
    const reloadBtn = $('reload-secrets');
    if (reloadBtn) reloadBtn.addEventListener('click', () => void reloadSecrets());
    $('audit-search').addEventListener('submit', (event) => {
      event.preventDefault();
      const query = $('audit-query').value.trim();
      $('audit-export').href = `/api/export/events?format=csv${query ? `&q=${encodeURIComponent(query)}` : ''}`;
      void loadAudit(query);
    });
    $('kill-switch').addEventListener('click', () => {
      const active = state.agents.filter((agent) => agent.status === 'active').length;
      $('kill-message').textContent = `This will immediately stop all ${active} active agents. Are you sure?`;
      $('kill-result').textContent = '';
      $('kill-dialog').showModal();
    });
    $('confirm-kill').addEventListener('click', () => void activateKillSwitch());

    renderLiveFeed();
    connectRealtime();
    void refreshAll();
    setInterval(refreshAll, 30000);
  });
}());
