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
    el.innerHTML = (data.events || []).map(function (ev) {
      const detailText = typeof ev.detail === 'object'
        ? JSON.stringify(ev.detail).slice(0, 120)
        : String(ev.detail || '');
      return (
        '<div class="audit-row ' + escapeHtml(ev.severity) + '">' +
          '<span>' + new Date(ev.created_at).toLocaleTimeString() + '</span>' +
          '<b>' + escapeHtml(ev.event_type + ':' + ev.action) + '</b>' +
          '<em>' + escapeHtml(ev.admin_email || ev.tenant_id || 'system') + '</em>' +
          '<small>' + escapeHtml(detailText) + '</small>' +
        '</div>'
      );
    }).join('') || '<div class="spec-empty">No audit log entries</div>';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  window.DashboardAuditLog = { search: searchAuditLog, render: renderAuditLog };
  window.addEventListener('load', function () {
    const input = document.getElementById('audit-search');
    if (input) input.addEventListener('input', function () { void searchAuditLog(input.value); });
    const exportBtn = document.getElementById('audit-export');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const dateStr = new Date().toISOString().slice(0, 10);
      const url = '/api/export/events?format=csv&since=' + encodeURIComponent(since) + '&limit=10000';
      if (window.downloadScoutExport) {
        void window.downloadScoutExport(url, 'scout-security-events-' + dateStr + '.csv', 'CSV security events downloaded');
      }
    });
    void searchAuditLog();
  });
})();
