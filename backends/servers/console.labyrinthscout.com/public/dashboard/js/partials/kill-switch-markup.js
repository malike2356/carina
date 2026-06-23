/** Shared kill switch DOM (marketing design). Used in dashboard tab + header compact control. */
(function () {
  function ringMarkup() {
    return [
      '<div class="ks-flash" aria-hidden="true"></div>',
      '<div class="ks-shockwave" aria-hidden="true"></div>',
      '<div class="ks-shockwave" aria-hidden="true"></div>',
      '<div class="ks-switch-ring"></div>',
      '<div class="ks-switch-ring"></div>',
      '<div class="ks-switch-ring"></div>',
    ].join('');
  }

  function buttonMarkup(label) {
    return [
      '<button type="button" class="ks-switch-button" data-kill-trigger aria-label="' + label + '">',
      '<i class="ti ti-power ks-btn-icon-power" aria-hidden="true"></i>',
      '<i class="ti ti-robot-off ks-btn-icon-killed" aria-hidden="true"></i>',
      '</button>',
      '<div class="ks-kill-status" aria-live="polite"></div>',
    ].join('');
  }

  function actionsListMarkup() {
    var items = [
      ['ti-robot-off', 'Suspend all governed agents immediately'],
      ['ti-workflow-off', 'Pause active workflows and automation'],
      ['ti-tool-off', 'Block pending tool execution calls'],
      ['ti-world-off', 'Cut external communications and egress'],
      ['ti-history', 'Capture full audit snapshot at time of kill'],
    ];
    return [
      '<div class="ks-actions-list" id="ks-actions-list">',
      items.map(function (row) {
        return '<div class="ks-action"><i class="ti ' + row[0] + '"></i><span>' + row[1] + '</span></div>';
      }).join(''),
      '</div>',
      '<div class="ks-authority-line">Human authority remains absolute.</div>',
      '<p class="ks-disarm-note">To resume agents after a global kill, disarm on the server: <code>carina scout disarm</code></p>',
    ].join('');
  }

  window.KillSwitchMarkup = {
    switchShell: function (opts) {
      var compact = opts && opts.compact;
      var toolbar = opts && opts.toolbar;
      var id = (opts && opts.id) || '';
      var label = (opts && opts.label) || 'Activate global kill switch';
      var cls = 'ks-switch'
        + (toolbar ? ' ks-switch-toolbar' : (compact ? ' ks-switch-compact' : ''));
      return '<div class="' + cls + '"' + (id ? ' id="' + id + '"' : '') + '>' + ringMarkup() + buttonMarkup(label) + '</div>';
    },
    panel: function () {
      return [
        '<section class="dash-ks-panel" aria-label="Global kill switch">',
        '<div class="dash-ks-grid">',
        '<div class="dash-ks-content">',
        '<div class="dash-ks-eyebrow"><i class="ti ti-power"></i> Kill Switch</div>',
        '<h2 class="dash-ks-title">Every Autonomous System Needs <span class="accent-red">A Kill Switch.</span></h2>',
        '<p class="dash-ks-sub">When a governed agent drifts beyond policy, behaves unexpectedly, or encounters a security event, Scout gives you one action: stop everything, from one place, in one second.</p>',
        '<div class="dash-ks-meta">',
        '<span>State: <b id="ks-state-label">ARMED</b></span>',
        '<span>Active agents: <b id="ks-active-agents">-</b></span>',
        '<span id="ks-triggered-meta" hidden>Triggered by <b id="ks-triggered-by">-</b></span>',
        '</div>',
        actionsListMarkup(),
        '</div>',
        '<div class="ks-visual dash-ks-visual">',
        window.KillSwitchMarkup.switchShell({ id: 'ks-panel-switch', label: 'Activate global kill switch' }),
        '</div>',
        '</div>',
        '</section>',
      ].join('');
    },
  };
})();
