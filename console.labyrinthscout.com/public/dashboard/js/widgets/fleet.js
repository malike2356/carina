(function () {
  'use strict';

  var _fleetData = null;
  var refreshTimer = null;

  function authHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    if (window.__SCOUT_KEY) headers['X-Scout-Key'] = window.__SCOUT_KEY;
    return headers;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function renderFleet(data) {
    _fleetData = data;
    renderSummaryBar(data);
    renderGrid(data);
  }

  function renderSummaryBar(data) {
    var bar = document.getElementById('fleet-summary-bar');
    if (!bar) return;
    bar.innerHTML =
      '<span class="fleet-summary-pill">Total: ' + (data.total || 0) + '</span>' +
      '<span class="fleet-summary-pill active">Active: ' + (data.active || 0) + '</span>' +
      '<span class="fleet-summary-pill suspended">Suspended: ' + (data.suspended || 0) + '</span>' +
      '<span class="fleet-summary-pill offline">Offline: ' + (data.offline || 0) + '</span>';
  }

  function renderGrid(data) {
    var grid = document.getElementById('fleet-grid');
    if (!grid) return;
    if (!data.fleet || data.fleet.length === 0) {
      grid.innerHTML = '<div class="fleet-empty">No agents registered. A Carina agent registers automatically on first heartbeat.</div>';
      return;
    }
    grid.innerHTML = data.fleet.map(agentCard).join('');
    grid.querySelectorAll('.fleet-btn-kill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        handleKill(btn.getAttribute('data-id'), btn);
      });
    });
    grid.querySelectorAll('.fleet-btn-resume').forEach(function (btn) {
      btn.addEventListener('click', function () {
        handleResume(btn.getAttribute('data-id'), btn);
      });
    });
  }

  function agentCard(agent) {
    var hbText = agent.secondsAgo === null
      ? 'never seen'
      : agent.secondsAgo < 60
        ? agent.secondsAgo + 's ago'
        : Math.floor(agent.secondsAgo / 60) + 'm ago';

    var ev = agent.events24h || { critical: 0, warning: 0, info: 0, breach: 0 };
    var evParts = [];
    if (ev.breach) evParts.push('<span class="fleet-ev-breach">' + ev.breach + ' breach</span>');
    if (ev.critical) evParts.push('<span class="fleet-ev-critical">' + ev.critical + ' crit</span>');
    if (ev.warning) evParts.push('<span class="fleet-ev-warning">' + ev.warning + ' warn</span>');
    if (ev.info) evParts.push('<span class="fleet-ev-info">' + ev.info + ' info</span>');
    var evHtml = evParts.length ? evParts.join('') : '<span class="fleet-ev-info">no events</span>';

    var isSuspended = agent.status === 'suspended';
    var killBtn = '<button type="button" class="fleet-btn fleet-btn-kill" data-id="' + escapeHtml(agent.id) + '"' +
      (isSuspended ? ' disabled' : '') + '>KILL</button>';
    var resumeBtn = isSuspended
      ? '<button type="button" class="fleet-btn fleet-btn-resume" data-id="' + escapeHtml(agent.id) + '">RESUME</button>'
      : '';
    var reasonLine = agent.suspensionReason
      ? '<div class="fleet-card-id">Reason: ' + escapeHtml(agent.suspensionReason) + '</div>'
      : '';

    return (
      '<div class="fleet-card status-' + escapeHtml(agent.status) + '" id="fleet-card-' + escapeHtml(agent.id) + '" data-id="' + escapeHtml(agent.id) + '">' +
        '<div class="fleet-card-name" title="' + escapeHtml(agent.id) + '">' + escapeHtml(agent.name) + '</div>' +
        '<div class="fleet-card-id">' + escapeHtml(agent.id) + '</div>' +
        '<div class="fleet-card-hb">Heartbeat: ' + hbText + '</div>' +
        reasonLine +
        '<div class="fleet-card-events">' + evHtml + '</div>' +
        '<div class="fleet-card-actions">' + killBtn + resumeBtn + '</div>' +
      '</div>'
    );
  }

  function handleKill(instanceId, btn) {
    if (!instanceId) return;
    var reason = window.prompt('Reason for suspension (required):');
    if (!reason || !reason.trim()) return;
    btn.disabled = true;
    fetch('/api/kill/' + encodeURIComponent(instanceId), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reason: reason.trim() }),
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            throw new Error(data.error || String(res.status));
          });
        }
        updateCardStatus(instanceId, 'suspended', reason.trim());
      })
      .catch(function (err) {
        window.alert('Kill failed: ' + err.message);
        btn.disabled = false;
      });
  }

  function handleResume(instanceId, btn) {
    if (!instanceId) return;
    btn.disabled = true;
    fetch('/api/resume/' + encodeURIComponent(instanceId), {
      method: 'POST',
      headers: authHeaders(),
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            throw new Error(data.error || String(res.status));
          });
        }
        updateCardStatus(instanceId, 'active', null);
      })
      .catch(function (err) {
        window.alert('Resume failed: ' + err.message);
        btn.disabled = false;
      });
  }

  function updateCardStatus(instanceId, status, suspensionReason) {
    if (!_fleetData || !_fleetData.fleet) return;
    _fleetData.fleet = _fleetData.fleet.map(function (a) {
      return a.id === instanceId ? Object.assign({}, a, { status: status, suspensionReason: suspensionReason }) : a;
    });
    _fleetData.active = _fleetData.fleet.filter(function (a) { return a.status === 'active'; }).length;
    _fleetData.suspended = _fleetData.fleet.filter(function (a) { return a.status === 'suspended'; }).length;
    _fleetData.offline = _fleetData.fleet.filter(function (a) { return a.status === 'offline'; }).length;
    renderFleet(_fleetData);
  }

  function handleAgentUpdateEvent(event) {
    var instanceId = (event && event.data && event.data.instance_id) || (event && event.instance_id);
    if (!instanceId || !_fleetData || !_fleetData.fleet) return;
    var agent = _fleetData.fleet.find(function (a) { return a.id === instanceId; });
    if (!agent) return;
    agent.secondsAgo = 0;
    if (agent.status !== 'suspended') agent.status = 'active';
    var card = document.getElementById('fleet-card-' + instanceId);
    if (!card) return;
    var hbEl = card.querySelector('.fleet-card-hb');
    if (hbEl) hbEl.textContent = 'Heartbeat: just now';
    card.className = 'fleet-card status-' + agent.status;
  }

  function loadFleet() {
    return fetch('/api/dashboard/fleet', { headers: authHeaders() })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (data) renderFleet(data);
      })
      .catch(function () {});
  }

  function startRefreshTimer() {
    if (refreshTimer) return;
    refreshTimer = window.setInterval(function () {
      if (window.DashboardDefenseTab && window.DashboardDefenseTab.getActiveView() === 'fleet') {
        void loadFleet();
      }
    }, 30000);
  }

  function stopRefreshTimer() {
    if (!refreshTimer) return;
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function onActivate() {
    void loadFleet();
    startRefreshTimer();
  }

  function onDeactivate() {
    stopRefreshTimer();
  }

  window.DashboardFleetTab = {
    load: loadFleet,
    render: renderFleet,
    handleAgentUpdateEvent: handleAgentUpdateEvent,
    onActivate: onActivate,
    onDeactivate: onDeactivate,
  };
})();
