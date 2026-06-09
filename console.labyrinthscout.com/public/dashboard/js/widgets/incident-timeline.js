(function () {
  async function loadIncidents(type) {
    const url = '/api/trust/incidents?limit=40' + (type ? '&type=' + encodeURIComponent(type) : '');
    const res = await fetch(url, { headers: window.H ? H() : {} });
    if (!res.ok) return;
    renderIncidents(await res.json());
  }

  function renderIncidents(data) {
    const el = document.getElementById('incident-timeline-results');
    if (!el) return;

    el.innerHTML = (data.incidents || []).map(function (item) {
      return (
        '<div class="audit-row ' + escapeHtml(item.severity) + '">' +
          '<span>' + new Date(item.created_at).toLocaleTimeString() + '</span>' +
          '<b>' + escapeHtml(item.incident_label) + '</b>' +
          '<em>' + escapeHtml(item.instance_id || 'unknown') + '</em>' +
          '<small>' + escapeHtml(item.description || '') + '</small>' +
        '</div>'
      );
    }).join('') || '<div class="spec-empty">No classified incidents</div>';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  window.DashboardIncidentTimeline = { load: loadIncidents };
  window.addEventListener('load', function () {
    const filter = document.getElementById('incident-type-filter');
    if (filter) {
      filter.addEventListener('change', function () {
        void loadIncidents(filter.value || null);
      });
    }
    void loadIncidents(null);
    setInterval(function () { void loadIncidents(filter ? filter.value || null : null); }, 30000);
  });
})();
