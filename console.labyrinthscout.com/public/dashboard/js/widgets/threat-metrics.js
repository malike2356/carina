(function () {
  async function loadThreatMetrics() {
    const res = await fetch('/api/dashboard/threat-metrics', { headers: window.H ? H() : {} });
    if (!res.ok) return;
    renderThreatMetrics(await res.json());
  }

  function renderThreatMetrics(data) {
    setText('tile-threats-value', data.threats || 0);
    setText('tile-blocked-value', data.blocked || 0);
    setText('tile-threats-detail', `critical ${data.bySeverity?.critical || 0} · breach ${data.bySeverity?.breach || 0}`);
    setText('tile-blocked-detail', 'blocked or mitigated events, 24h');
    renderBars('attack-sources', data.topAttackSources || [], 'source');
    renderBars('attack-patterns', data.topPatterns || [], 'pattern');
    renderBars('attacks-24h', data.attacks24h || [], 'hour');
  }

  function renderBars(id, rows, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const max = Math.max(...rows.map((row) => row.count), 1);
    el.innerHTML = rows.slice(0, 8).map((row) => {
      const pct = Math.max(4, Math.round((row.count / max) * 100));
      return `<div class="spec-bar"><span>${escapeHtml(row[key])}</span><i style="width:${pct}%"></i><b>${row.count}</b></div>`;
    }).join('') || '<div class="spec-empty">No attack activity</div>';
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  window.DashboardThreatMetrics = { load: loadThreatMetrics, render: renderThreatMetrics };
  window.addEventListener('load', () => void loadThreatMetrics());
})();
