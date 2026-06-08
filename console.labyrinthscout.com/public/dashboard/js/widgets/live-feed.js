(function () {
  function handleNamedEvent(event) {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'live_event' && msg.data && window.onLiveEvent) {
        window.onLiveEvent(msg.data);
      }
      if (msg.type === 'threat_update' && window.DashboardThreatMetrics) {
        void window.DashboardThreatMetrics.load();
      }
      if (msg.type === 'agent_update' && window.DashboardAgentStatus) {
        void window.DashboardAgentStatus.load();
      }
      if (msg.type === 'token_update' && window.DashboardUsageAnalytics) {
        void window.DashboardUsageAnalytics.load();
      }
      const updated = document.getElementById('last-updated');
      if (updated) updated.textContent = new Date().toLocaleTimeString();
    } catch {}
  }

  window.DashboardLiveFeed = { handleNamedEvent };
})();
