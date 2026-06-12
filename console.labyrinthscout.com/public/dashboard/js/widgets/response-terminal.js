(function () {
  function authHeaders() {
    return window.__SCOUT_KEY ? { 'X-Scout-Key': window.__SCOUT_KEY } : {};
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function renderTerminal(data) {
    const el = document.getElementById('response-terminal-panel');
    if (!el || !data) return;

    const actions = (data.available_actions || []).map(function (action) {
      return (
        '<button class="op-btn ' + escapeHtml(action.severity) + '" data-action="' + escapeHtml(action.id) + '">' +
          escapeHtml(action.label) +
        '</button>'
      );
    }).join('');

    el.innerHTML =
      '<div class="op-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">' +
        '<div class="op-metric"><div class="label">Risk Score</div><div class="value">' + escapeHtml(data.risk_score) + '</div><div class="detail">' + escapeHtml(data.risk_tier) + '</div></div>' +
        '<div class="op-metric"><div class="label">Shield Mode</div><div class="value">' + escapeHtml(data.shield_mode || 'observe') + '</div><div class="detail">session policy</div></div>' +
        '<div class="op-metric"><div class="label">Blocked (24h)</div><div class="value">' + escapeHtml(data.blocked_actions_24h) + '</div><div class="detail">policy decisions</div></div>' +
      '</div>' +
      '<p class="spec-empty" style="margin-top:.5rem"><b>Recommended:</b> ' + escapeHtml(data.recommended_action) + '</p>' +
      (data.last_unsafe_event
        ? '<p class="spec-empty"><b>Last unsafe:</b> ' + escapeHtml(data.last_unsafe_event.event_type) + ' - ' + escapeHtml(data.last_unsafe_event.description) + '</p>'
        : '') +
      '<div class="op-action-row" style="margin-top:.65rem;display:flex;gap:.4rem;flex-wrap:wrap">' + actions + '</div>';
  }

  function bindActions(sessionId, instanceId) {
    const panel = document.getElementById('response-terminal-panel');
    if (!panel) return;
    panel.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const actionId = btn.getAttribute('data-action');
        if (!actionId) return;
        fetch('/api/response-terminal/actions/' + encodeURIComponent(actionId), {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
          body: JSON.stringify({ session_id: sessionId, instance_id: instanceId, reason: 'dashboard action' }),
        }).then(function () { loadTerminal(sessionId, instanceId); });
      });
    });
  }

  function loadTerminal(sessionId, instanceId) {
    const params = new URLSearchParams();
    if (sessionId) params.set('session_id', sessionId);
    if (instanceId) params.set('instance_id', instanceId);
    fetch('/api/response-terminal?' + params.toString(), { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        renderTerminal(data);
        bindActions(sessionId, instanceId);
      })
      .catch(function () {
        const el = document.getElementById('response-terminal-panel');
        if (el) el.innerHTML = '<div class="spec-empty">Response terminal unavailable</div>';
      });
  }

  window.DashboardResponseTerminal = { load: loadTerminal, render: renderTerminal };
})();
