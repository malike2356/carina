(function () {
  async function searchAuditLog(query = '') {
    const url = '/api/dashboard/audit-log?limit=80&q=' + encodeURIComponent(query);
    const res = await fetch(url, { headers: window.H ? H() : {} });
    if (!res.ok) return;
    renderAuditLog(await res.json());
  }

  function renderAuditLog(data) {
    const el = document.getElementById('audit-log-results');
    if (!el) return;
    el.innerHTML = (data.events || []).map((ev) =>
      `<div class="audit-row ${ev.severity}">
        <span>${new Date(ev.created_at).toLocaleTimeString()}</span>
        <b>${escapeHtml(ev.event_type)}</b>
        <em>${escapeHtml(ev.instance_id || 'unknown')}</em>
        <small>${escapeHtml(ev.description || '')}</small>
      </div>`
    ).join('') || '<div class="spec-empty">No audit results</div>';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  window.DashboardAuditLog = { search: searchAuditLog, render: renderAuditLog };
  window.addEventListener('load', () => {
    const input = document.getElementById('audit-search');
    if (input) input.addEventListener('input', () => void searchAuditLog(input.value));
    const exportBtn = document.getElementById('audit-export');
    if (exportBtn) exportBtn.addEventListener('click', () => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const dateStr = new Date().toISOString().slice(0, 10);
      const url =
        '/api/export/events?format=csv' +
        '&since=' + encodeURIComponent(since) +
        '&limit=10000';
      if (window.downloadScoutExport) {
        void window.downloadScoutExport(url, 'scout-audit-' + dateStr + '.csv', 'CSV audit log downloaded');
      }
    });
    void searchAuditLog();
  });
})();
