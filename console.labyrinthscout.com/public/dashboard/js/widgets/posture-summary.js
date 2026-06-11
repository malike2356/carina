(function () {
  let previousRiskScore = null;

  async function loadPosture() {
    const res = await fetch('/api/dashboard/posture', { headers: window.H ? H() : {} });
    if (!res.ok) return;
    renderPosture(await res.json());
  }

  function renderPosture(data) {
    setText('posture-risk-value', data.risk_score ?? '-');
    setText('trust-risk-tier', data.risk_score ?? '-');
    setText('trust-risk-tier-label', data.risk_tier_label || data.risk_tier || '-');

    const deltaEl = document.getElementById('posture-risk-delta');
    if (deltaEl) {
      const delta = previousRiskScore === null ? null : (data.risk_score - previousRiskScore);
      previousRiskScore = data.risk_score;
      if (delta === null) {
        deltaEl.textContent = 'baseline set';
        deltaEl.className = 'delta flat';
      } else if (delta > 0) {
        deltaEl.textContent = '+' + delta + ' since last refresh';
        deltaEl.className = 'delta up';
      } else if (delta < 0) {
        deltaEl.textContent = String(delta) + ' since last refresh';
        deltaEl.className = 'delta down';
      } else {
        deltaEl.textContent = 'no change since last refresh';
        deltaEl.className = 'delta flat';
      }
    }

    const agents = data.agents || {};
    setText('posture-agents-active', agents.active ?? 0);
    setText('posture-agents-detail', `${agents.total ?? 0} protected · ${agents.suspended ?? 0} suspended · ${agents.offline ?? 0} offline`);
    setText('tile-agents-value', agents.active ?? 0);
    setText('tile-agents-detail', `${agents.total ?? 0} total · ${agents.offline ?? 0} offline`);

    const freshness = data.freshness || {};
    setText('posture-heartbeat-age', freshness.heartbeat_age_label || '-');
    setText('posture-event-age', freshness.last_event_age_label || '-');
    setText('posture-freshness-state', freshness.stale ? 'STALE' : 'FRESH');
    setText('posture-freshness-detail', freshness.stale_reason || ('SSE subscribers: ' + (freshness.sse_subscribers ?? 0)));

    const freshCard = document.getElementById('posture-freshness-card');
    if (freshCard) freshCard.classList.toggle('stale', !!freshness.stale);
    if (freshCard) freshCard.classList.toggle('fresh', !freshness.stale);

    const kill = data.control_plane || {};
    setText('posture-kill-state', kill.kill_switch_triggered ? 'TRIGGERED' : (kill.kill_switch_armed ? 'ARMED' : 'OFF'));
    setText('posture-kill-detail', kill.kill_switch_triggered ? 'all agents stopped' : 'ready');

    const incidents = data.incidents || {};
    setText('incident-open-critical', incidents.open_critical ?? 0);
    setText('incident-unresolved-detail', `${incidents.unresolved_critical ?? 0} unresolved critical`);
    setText('incident-blocked', incidents.blocked_actions_24h ?? 0);
    setText('incident-injection', incidents.injection_blocks_24h ?? 0);
    setText('incident-acknowledged', incidents.acknowledged_count ?? 0);
    setText('incident-runtime', incidents.unresolved_runtime_incidents ?? 0);
    const tta = incidents.avg_time_to_acknowledge_ms;
    setText('incident-tta', tta ? ('avg ack: ' + formatDuration(tta)) : 'time to ack: n/a');
    const rate = incidents.incident_rate_change_pct;
    setText('incident-rate-change', rate === null || rate === undefined ? '-' : (rate > 0 ? '+' : '') + rate + '%');

    const trust = data.trust || {};
    setText('trust-attestation-age', trust.last_attestation_age || 'none');
    setText('trust-verification-age', trust.last_verification_age || 'none');
    setText('trust-erc8004', 'ERC-8004: ' + (trust.erc8004_label || trust.erc8004_status || '-'));
    setText('trust-erc8126', 'ERC-8126: ' + (trust.erc8126_label || trust.erc8126_status || '-'));
    setText('trust-wallet-state', trust.wallet_configured ? 'CONFIGURED' : 'NOT SET');
    const txBits = [];
    if (trust.on_chain_request_tx) txBits.push('request tx');
    if (trust.on_chain_response_tx) txBits.push('response tx');
    setText('trust-chain-tx', txBits.length ? txBits.join(' · ') : 'no on-chain txs');

    if (window.DashboardActionQueue) window.DashboardActionQueue.render(data.action_queue || []);
    if (window.DashboardAttackDetail) window.DashboardAttackDetail.render(data.attacks || {}, data.control_plane || {});

    const updated = document.getElementById('last-updated');
    if (updated) updated.textContent = new Date().toLocaleTimeString();
  }

  function formatDuration(ms) {
    if (ms < 60000) return Math.round(ms / 1000) + 's';
    if (ms < 3600000) return Math.round(ms / 60000) + 'm';
    return Math.round(ms / 3600000) + 'h';
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  window.DashboardPosture = { load: loadPosture, render: renderPosture };
  window.addEventListener('load', function () {
    void loadPosture();
    setInterval(function () { void loadPosture(); }, 30000);
  });
})();
