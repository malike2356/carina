(function () {
  async function loadThreatMetrics() {
    const res = await fetch('/api/dashboard/threat-metrics', { headers: window.H ? H() : {} });
    if (!res.ok) return;
    renderThreatMetrics(await res.json());
  }

  function renderThreatMetrics(data) {
    setText('tile-threats-value', data.attacks ?? data.threats ?? 0);
    setText('tile-blocked-value', data.blocked ?? 0);
    setText('tile-threats-detail', `attacks ${data.attacks ?? 0} · anomalies ${data.anomalies ?? 0}`);
    setText('tile-blocked-detail', `blocked ${data.blocked ?? 0} · admin ${data.admin_actions ?? 0}`);
    renderBars('attack-sources', data.topAttackSources || [], 'source');
    renderBars('attacks-24h', data.attacks24h || [], 'hour');
  }

  function renderBars(id, rows, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const max = Math.max.apply(null, rows.map(function (row) { return row.count; }).concat([1]));
    el.innerHTML = rows.slice(0, 8).map(function (row) {
      const pct = Math.max(4, Math.round((row.count / max) * 100));
      return '<div class="spec-bar"><span>' + escapeHtml(row[key]) + '</span><i style="width:' + pct + '%"></i><b>' + row.count + '</b></div>';
    }).join('') || '<div class="spec-empty">No attack activity</div>';
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  window.DashboardThreatMetrics = { load: loadThreatMetrics, render: renderThreatMetrics };
  window.addEventListener('load', function () { void loadThreatMetrics(); });
})();
