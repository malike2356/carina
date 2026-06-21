(function () {
  let currentPending = [];

  async function load() {
    const res = await fetch('/api/actions/pending', { headers: window.H ? H() : {} });
    if (!res.ok) return;
    const data = await res.json();
    currentPending = data.pending || [];
    render(currentPending);
    updateBadge(currentPending.length);
  }

  function updateBadge(count) {
    const badge = document.getElementById('pending-action-count');
    if (badge) {
      badge.textContent = String(count);
      badge.style.display = count > 0 ? 'inline-block' : 'none';
      badge.style.background = count >= 3 ? 'var(--red)' : 'var(--amber)';
    }
    const tabBadge = document.getElementById('pending-tab-badge');
    if (tabBadge) {
      tabBadge.textContent = String(count);
      tabBadge.style.display = count > 0 ? 'inline-block' : 'none';
      tabBadge.style.background = count >= 3 ? 'var(--red)' : 'var(--amber)';
    }
  }

  function timeAgo(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' minute' + (mins === 1 ? '' : 's') + ' ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' hour' + (hrs === 1 ? '' : 's') + ' ago';
    return Math.floor(hrs / 24) + ' days ago';
  }

  function severityClass(severity) {
    return { info: 'cyan', warning: 'amber', critical: 'red', breach: 'red' }[severity] || 'cyan';
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function render(items) {
    const el = document.getElementById('pending-actions-list');
    if (!el) return;

    if (items.length === 0) {
      el.innerHTML = '<div class="spec-empty">No pending actions - all clear</div>';
      return;
    }

    el.innerHTML = items.map(function (item) {
      const cls = severityClass(item.eventSeverity);
      const title = item.playbook ? item.playbook.title : item.playbookId;
      return (
        '<div class="pending-action-row" data-id="' + escHtml(item.id) + '">' +
          '<span class="sev-label ' + cls + '">' + escHtml((item.eventSeverity || 'info').toUpperCase()) + '</span>' +
          '<div class="pending-action-body">' +
            '<strong>' + escHtml(title) + '</strong>' +
            '<span class="pending-time">' + timeAgo(item.createdAt) + '</span>' +
          '</div>' +
          '<button class="btn-resolve" data-pending-id="' + escHtml(item.id) + '">' +
            'Review' +
          '</button>' +
        '</div>'
      );
    }).join('');

    el.querySelectorAll('.btn-resolve').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-pending-id');
        if (id) openModal(id);
      });
    });
  }

  function openModal(pendingId) {
    const item = currentPending.find(function (p) { return p.id === pendingId; });
    if (!item) return;
    renderModal(item);
    document.getElementById('resolve-modal-overlay').style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('resolve-modal-overlay').style.display = 'none';
  }

  function renderModal(item) {
    const modal = document.getElementById('resolve-modal');
    if (!modal) return;
    const playbook = item.playbook;
    if (!playbook) return;

    const actions = (playbook.actions || []).map(function (action) {
      const btnClass = action.destructive ? 'btn-action destructive' : 'btn-action';
      const stepsHtml = action.steps
        ? '<details class="action-steps"><summary>Show manual steps</summary><ol>' +
          action.steps.map(function (s) {
            return '<li>' + escHtml(s.replace(/\{\{instance_id\}\}/g, item.instanceId || '')) + '</li>';
          }).join('') +
          '</ol></details>'
        : '';
      const scriptHtml = action.script
        ? '<details class="action-steps"><summary>Show command</summary><pre class="action-script">' + escHtml(action.script) + '</pre></details>'
        : '';
      const actionBtn = action.type === 'button'
        ? '<button class="' + btnClass + '" data-pending-id="' + escHtml(item.id) +
          '" data-action-id="' + escHtml(action.id) + '" data-action-label="' + escHtml(action.label) +
          '" data-requires-confirm="' + (action.requiresConfirmation ? '1' : '0') + '">' +
          escHtml(action.label) + '</button>'
        : '';
      return (
        '<div class="action-option">' +
          '<div class="action-option-header">' +
            '<strong>' + escHtml(action.label) + '</strong>' +
            (action.reversible ? '<span class="tag reversible">Reversible</span>' : '<span class="tag permanent">Permanent</span>') +
          '</div>' +
          '<p class="action-desc">' + escHtml(action.description) + '</p>' +
          stepsHtml + scriptHtml + actionBtn +
        '</div>'
      );
    }).join('');

    modal.innerHTML =
      '<div class="modal-header">' +
        '<h2>' + escHtml(playbook.title) + '</h2>' +
        '<button class="modal-close" type="button" id="resolve-modal-close">Close</button>' +
      '</div>' +
      '<div class="modal-section">' +
        '<h3>What happened</h3>' +
        '<p>' + escHtml(playbook.summary) + '</p>' +
      '</div>' +
      '<div class="modal-section risk">' +
        '<h3>What is at risk</h3>' +
        '<p>' + escHtml(playbook.riskNote) + '</p>' +
      '</div>' +
      '<div class="modal-section">' +
        '<h3>Available actions</h3>' +
        '<div class="actions-list">' + actions + '</div>' +
      '</div>' +
      '<div class="modal-section dismiss">' +
        '<button class="btn-dismiss" type="button" id="resolve-modal-dismiss" data-pending-id="' + escHtml(item.id) + '">' +
          'Dismiss without action' +
        '</button>' +
        '<span class="dismiss-note">Only dismiss if you have reviewed this and are confident no action is needed.</span>' +
      '</div>';

    const closeBtn = document.getElementById('resolve-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    const dismissBtn = document.getElementById('resolve-modal-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        const pid = dismissBtn.getAttribute('data-pending-id');
        if (pid) void dismiss(pid);
      });
    }

    modal.querySelectorAll('.btn-action').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const pid = btn.getAttribute('data-pending-id');
        const aid = btn.getAttribute('data-action-id');
        const label = btn.getAttribute('data-action-label');
        const confirm = btn.getAttribute('data-requires-confirm') === '1';
        if (pid && aid && label) void executeAction(pid, aid, label, confirm);
      });
    });
  }

  async function executeAction(pendingId, actionId, actionLabel, requiresConfirmation) {
    if (requiresConfirmation) {
      const confirmed = window.confirm(
        'Execute "' + actionLabel + '"? ' +
        'This action will be logged and cannot be undone if marked permanent.'
      );
      if (!confirmed) return;
    }

    const res = await fetch('/api/actions/' + encodeURIComponent(pendingId) + '/execute', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, window.H ? H() : {}),
      body: JSON.stringify({ action_id: actionId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(function () { return {}; });
      alert('Action failed: ' + (err.error || 'Unknown error'));
      return;
    }

    const result = await res.json();
    closeModal();
    alert(result.message || 'Action executed successfully.');
    void load();
    if (window.DashboardActionAudit) void DashboardActionAudit.load(null);
  }

  async function dismiss(pendingId) {
    const confirmed = window.confirm(
      'Dismiss this alert without taking action? It will be marked as reviewed.'
    );
    if (!confirmed) return;

    const res = await fetch('/api/actions/' + encodeURIComponent(pendingId) + '/dismiss', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, window.H ? H() : {}),
      body: JSON.stringify({ notes: 'Dismissed by operator via dashboard' }),
    });

    if (!res.ok) {
      alert('Could not dismiss: ' + res.statusText);
      return;
    }

    closeModal();
    void load();
    if (window.DashboardActionAudit) void DashboardActionAudit.load(null);
  }

  window.DashboardPendingActions = { load, openModal, closeModal, executeAction, dismiss };

  window.addEventListener('load', function () {
    void load();
    setInterval(load, 30000);
  });
})();
