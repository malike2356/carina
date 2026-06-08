(function () {
  let activeAgents = 0;

  async function refreshAgentCount() {
    const res = await fetch('/api/dashboard/agent-status', { headers: window.H ? H() : {} });
    if (!res.ok) return;
    const data = await res.json();
    activeAgents = data.active || 0;
  }

  async function openGlobalKillSwitch() {
    await refreshAgentCount();
    const desc = document.getElementById('kill-desc');
    if (desc) desc.textContent = `This will immediately stop all ${activeAgents} active agents. Are you sure?`;
    if (window.openKill && window.killTargetId) {
      window.openKill(window.killTargetId, 'all active agents');
      return;
    }
    const overlay = document.getElementById('kill-overlay');
    if (overlay) overlay.hidden = false;
  }

  function renderKillStatus(data) {
    const el = document.getElementById('kill-status');
    if (!el) return;
    if (data?.confirmation) {
      el.textContent = data.confirmation;
      el.classList.add('active');
    }
  }

  window.DashboardKillSwitch = {
    refreshAgentCount,
    openGlobalKillSwitch,
    renderKillStatus,
  };
  window.addEventListener('load', () => {
    const btn = document.getElementById('global-kill-button');
    if (btn) btn.addEventListener('click', () => void openGlobalKillSwitch());
    void refreshAgentCount();
  });
})();
