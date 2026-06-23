(function () {
  async function loadUsageAnalytics() {
    const res = await fetch('/api/dashboard/usage-analytics', { headers: window.H ? H() : {} });
    if (!res.ok) return;
    renderUsageAnalytics(await res.json());
  }

  function renderUsageAnalytics(data) {
    const pct = data.percentage || 0;
    setText('tile-token-value', pct + '%');
    setText('tile-token-detail', format(data.used || 0) + ' / ' + format(data.limit || 0) + ' tokens (estimated)');
    const label = document.getElementById('usage-estimate-label');
    if (label) label.textContent = data.label || 'Estimated from event metadata; not billing-grade usage';
    const bar = document.getElementById('token-usage-bar');
    if (bar) bar.style.width = Math.min(100, pct) + '%';
  }

  function format(value) {
    return new Intl.NumberFormat('en-GB').format(value);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  window.DashboardUsageAnalytics = { load: loadUsageAnalytics, render: renderUsageAnalytics };
  window.addEventListener('load', function () { void loadUsageAnalytics(); });
})();
