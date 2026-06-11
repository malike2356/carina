(function () {
  function renderActionQueue(items) {
    const el = document.getElementById('action-queue-list');
    if (!el) return;
    if (!items.length) {
      el.innerHTML = '<div class="spec-empty">No operator actions required</div>';
      return;
    }
    el.innerHTML = items.map(function (item) {
      return (
        '<div class="op-queue-row ' + escapeHtml(item.severity) + '">' +
          '<b>' + escapeHtml(item.severity.toUpperCase()) + '</b>' +
          '<span>' + escapeHtml(item.label) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  window.DashboardActionQueue = { render: renderActionQueue };
})();
