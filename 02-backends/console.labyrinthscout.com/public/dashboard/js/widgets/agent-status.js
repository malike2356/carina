(function () {
  async function loadAgentStatus() {
    const res = await fetch('/api/dashboard/agent-status', { headers: window.H ? H() : {} });
    if (!res.ok) return;
    renderAgentStatus(await res.json());
  }

  function renderAgentStatus(data) {
    const tile = document.getElementById('tile-agents-value');
    const detail = document.getElementById('tile-agents-detail');
    const list = document.getElementById('agent-status-list');
    if (tile) tile.textContent = String(data.active || 0);
    if (detail) detail.textContent = `${data.total || 0} total · ${data.offline || 0} offline · ${data.suspended || 0} suspended`;
    if (list) {
      list.innerHTML = (data.agents || []).slice(0, 8).map((agent) =>
        `<div class="spec-row"><span>${escapeHtml(agent.name)}</span><b class="${agent.status}">${agent.status}</b></div>`
      ).join('') || '<div class="spec-empty">No agents registered</div>';
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  window.DashboardAgentStatus = { load: loadAgentStatus, render: renderAgentStatus };
  window.addEventListener('load', () => void loadAgentStatus());
})();
