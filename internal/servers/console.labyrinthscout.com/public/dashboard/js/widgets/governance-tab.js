(function () {
  'use strict';

  var lastPosture = null;
  var refreshTimer = null;

  function authHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    if (window.__SCOUT_KEY) headers['X-Scout-Key'] = window.__SCOUT_KEY;
    return headers;
  }

  function showLoading(message) {
    var loading = document.getElementById('gov-tab-loading');
    var content = document.getElementById('gov-tab-content');
    if (loading) { loading.hidden = false; loading.textContent = message || 'Loading governance posture...'; }
    if (content) content.hidden = true;
  }

  function showContent() {
    var loading = document.getElementById('gov-tab-loading');
    var content = document.getElementById('gov-tab-content');
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;
  }

  function render(data) {
    lastPosture = data;
    // Show the content pane before attempting to render into it.
    // This ensures content is never silently hidden by a render engine check or throw.
    showContent();
    if (!window.GovernanceRender) return;
    try {
      window.GovernanceRender.renderPosture(
        data,
        window.GovernanceRender.DASHBOARD_TAB_IDS,
        {
          compact: true,
          bannerClass: 'gov-tab-score-banner',
          cardClass: 'gov-tab-card',
          fwCardClass: 'gov-tab-card gov-tab-fw-card',
        },
      );
      window.GovernanceRender.renderTemplateCard(data, window.GovernanceRender.DASHBOARD_TAB_IDS, []);
    } catch (e) {
      // Render error - content pane is already shown; don't hide it
      console.error('[governance-tab] render error:', e);
    }
  }

  function loadGovernance() {
    return fetch('/api/governance/posture', {
      headers: authHeaders(),
      credentials: 'same-origin',
    })
      .then(function (res) {
        if (res.status === 401) {
          showLoading('Sign in or configure SCOUT_API_KEY to view governance posture.');
          return null;
        }
        if (!res.ok) { showLoading('Unable to load governance posture.'); return null; }
        return res.json();
      })
      .then(function (data) {
        if (data) render(data);
      })
      .catch(function () {
        showLoading('Unable to load governance posture.');
      });
  }

  function startRefreshTimer() {
    if (refreshTimer) return;
    refreshTimer = window.setInterval(function () { void loadGovernance(); }, 60000);
  }

  function initRefreshButton() {
    var btn = document.getElementById('gov-tab-refresh');
    if (btn) btn.addEventListener('click', function () { void loadGovernance(); });
  }

  window.DashboardGovernanceTab = {
    load: loadGovernance,
    getLastPosture: function () { return lastPosture; },
  };

  document.addEventListener('DOMContentLoaded', function () {
    initRefreshButton();
    void loadGovernance();
    startRefreshTimer();
  });
})();
