(function () {
  function handleNamedEvent(event) {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'heartbeat') return;

      if (msg.type === 'live_event' && msg.data && window.onLiveEvent) {
        window.onLiveEvent(msg.data);
      }
      if (msg.type === 'threat_update' && window.DashboardThreatMetrics) {
        void window.DashboardThreatMetrics.load();
      }
      if (msg.type === 'agent_update' && window.DashboardAgentStatus) {
        void window.DashboardAgentStatus.load();
      }
      if ((msg.type === 'agent_update' || msg.type === 'heartbeat') && window.DashboardFleetTab) {
        window.DashboardFleetTab.handleAgentUpdateEvent(msg.data || msg);
      }
      if (msg.type === 'token_update' && window.DashboardUsageAnalytics) {
        void window.DashboardUsageAnalytics.load();
      }
      if (msg.type === 'audit_results' || msg.type === 'threat_update' || msg.type === 'agent_update') {
        if (window.DashboardPosture) void window.DashboardPosture.load();
      }
    } catch {}
  }

  window.DashboardLiveFeed = { handleNamedEvent };
})();
