(function () {
  function renderAttackDetail(attacks, controlPlane) {
    renderBars('attack-top-tools', attacks.topTools || [], 'tool');
    renderBars('attack-top-destinations', attacks.topBlockedDestinations || [], 'destination');
    renderBars('attack-by-type', (attacks.attacksByIncidentType || []).map(function (row) {
      return { label: row.incident_type, count: row.count };
    }), 'label');
    renderControlPlane(controlPlane || {});
  }

  function renderControlPlane(cp) {
    const el = document.getElementById('control-plane-status');
    if (!el) return;
    const egressValue = cp.egress_filter_enabled
      ? 'enabled'
      : 'disabled';
    const sandboxValue = cp.sandbox_enabled
      ? 'enabled'
      : 'disabled';
    const rows = [
      ['Alerts', cp.alert_channels_configured ? cp.alert_channel_count + ' channel(s)' : 'none'],
      ['Deception', cp.deception_enabled ? 'active honeypots' : 'none deployed'],
      ['Egress filter', egressValue + (cp.egress_filter_source ? ` · ${cp.egress_filter_source}` : '')],
      ['Sandbox', sandboxValue + (cp.sandbox_source ? ` · ${cp.sandbox_source}` : '')],
      ['Database', cp.database_connected ? 'connected' : 'offline'],
      ['Redis', cp.redis_connected ? 'connected' : 'offline'],
      ['SSE subscribers', String(cp.sse_subscribers ?? 0)],
    ];
    el.innerHTML = rows.map(function (row) {
      return '<div class="spec-row"><span>' + escapeHtml(row[0]) + '</span><b>' + escapeHtml(row[1]) + '</b></div>';
    }).join('');
  }

  function renderBars(id, rows, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const max = Math.max.apply(null, rows.map(function (row) { return row.count; }).concat([1]));
    el.innerHTML = rows.slice(0, 8).map(function (row) {
      const pct = Math.max(4, Math.round((row.count / max) * 100));
      return '<div class="spec-bar"><span>' + escapeHtml(row[key]) + '</span><i style="width:' + pct + '%"></i><b>' + row.count + '</b></div>';
    }).join('') || '<div class="spec-empty">No data</div>';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  window.DashboardAttackDetail = { render: renderAttackDetail };
})();
