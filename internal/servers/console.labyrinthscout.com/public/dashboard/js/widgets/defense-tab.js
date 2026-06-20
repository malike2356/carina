(function () {
  'use strict';

  var SHIELD_MODES = ['observe', 'guard', 'restrict', 'quarantine'];
  var actionLog = [];
  var lastPayload = null;

  function authHeaders() {
    return window.__SCOUT_KEY ? { 'X-Scout-Key': window.__SCOUT_KEY } : {};
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function getContext() {
    var sessionEl = document.getElementById('defense-session-id');
    var instanceEl = document.getElementById('defense-instance-id');
    return {
      sessionId: sessionEl && sessionEl.value ? sessionEl.value.trim() : '',
      instanceId: instanceEl && instanceEl.value ? instanceEl.value.trim() : 'default',
    };
  }

  function canWrite(capId) {
    if (!lastPayload || !Array.isArray(lastPayload.capabilities)) return false;
    var cap = lastPayload.capabilities.find(function (c) { return c.id === capId; });
    return !!(cap && cap.write);
  }

  function logAction(message, level) {
    actionLog.unshift({
      at: new Date().toISOString(),
      message: message,
      level: level || 'info',
    });
    if (actionLog.length > 30) actionLog.length = 30;
    renderActionLog();
  }

  function renderActionLog() {
    var el = document.getElementById('defense-action-log');
    if (!el) return;
    if (!actionLog.length) {
      el.innerHTML = '<div class="spec-empty">No operator actions yet this session</div>';
      return;
    }
    el.innerHTML = actionLog.map(function (entry) {
      return (
        '<div class="defense-log-row ' + escapeHtml(entry.level) + '">' +
          '<span class="defense-log-time">' + escapeHtml(entry.at.slice(11, 19)) + '</span>' +
          '<span>' + escapeHtml(entry.message) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function confirmAction(title, detail, onConfirm) {
    var overlay = document.getElementById('defense-confirm-overlay');
    var titleEl = document.getElementById('defense-confirm-title');
    var detailEl = document.getElementById('defense-confirm-detail');
    var submitBtn = document.getElementById('defense-confirm-submit');
    if (!overlay || !titleEl || !detailEl || !submitBtn) return;

    titleEl.textContent = title;
    detailEl.textContent = detail;
    overlay.hidden = false;

    var handler = function () {
      submitBtn.removeEventListener('click', handler);
      overlay.hidden = true;
      onConfirm();
    };
    submitBtn.addEventListener('click', handler);
  }

  window.closeDefenseConfirm = function () {
    var overlay = document.getElementById('defense-confirm-overlay');
    if (overlay) overlay.hidden = true;
  };

  function apiPost(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.error || 'Request failed');
        return data;
      });
    });
  }

  function apiPut(path, body) {
    return fetch(path, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.error || 'Request failed');
        return data;
      });
    });
  }

  function apiDelete(path) {
    return fetch(path, {
      method: 'DELETE',
      headers: authHeaders(),
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.error || 'Request failed');
        return data;
      });
    });
  }

  function renderTerminalSummary(terminal) {
    var el = document.getElementById('defense-terminal-summary');
    if (!el) return;
    if (!terminal) {
      el.innerHTML = '<div class="spec-empty">Select a session to load response summary</div>';
      return;
    }
    el.innerHTML =
      '<div class="op-grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">' +
        '<div class="op-metric"><div class="label">Risk</div><div class="value">' + escapeHtml(terminal.risk_score) + '</div><div class="detail">' + escapeHtml(terminal.risk_tier) + '</div></div>' +
        '<div class="op-metric"><div class="label">Shield</div><div class="value">' + escapeHtml(terminal.shield_mode || 'observe') + '</div><div class="detail">current mode</div></div>' +
        '<div class="op-metric"><div class="label">Blocked 24h</div><div class="value">' + escapeHtml(terminal.blocked_actions_24h) + '</div><div class="detail">policy actions</div></div>' +
        '<div class="op-metric"><div class="label">Provider</div><div class="value" style="font-size:.9rem">' + escapeHtml(terminal.provider_state) + '</div><div class="detail">routing state</div></div>' +
      '</div>' +
      '<p class="spec-empty" style="margin-top:.45rem"><b>Recommended:</b> ' + escapeHtml(terminal.recommended_action) + '</p>' +
      (terminal.last_unsafe_event
        ? '<p class="spec-empty"><b>Last unsafe:</b> ' + escapeHtml(terminal.last_unsafe_event.event_type) + '</p>'
        : '');
  }

  function renderShield(payload, ctx) {
    var el = document.getElementById('defense-shield-panel');
    if (!el) return;
    var mode = payload.shield ? payload.shield.mode : 'observe';
    var reason = payload.shield && payload.shield.reason ? payload.shield.reason : 'not set';
    var buttons = '';
    if (canWrite('shield_mode') && ctx.sessionId) {
      buttons = SHIELD_MODES.map(function (m) {
        var active = m === mode ? ' defense-btn-active' : '';
        return '<button type="button" class="defense-btn' + active + '" data-shield-mode="' + escapeHtml(m) + '">' + escapeHtml(m) + '</button>';
      }).join('');
    } else {
      buttons = '<div class="spec-empty">' + (ctx.sessionId ? 'Shield write unavailable' : 'Enter a session ID to change shield mode') + '</div>';
    }
    el.innerHTML =
      '<div class="defense-status-row"><span>Current</span><b>' + escapeHtml(mode) + '</b></div>' +
      '<div class="defense-status-row"><span>Reason</span><span>' + escapeHtml(reason) + '</span></div>' +
      '<div class="defense-btn-row">' + buttons + '</div>';
    el.querySelectorAll('[data-shield-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var nextMode = btn.getAttribute('data-shield-mode');
        if (!nextMode || nextMode === mode) return;
        confirmAction(
          'Change shield mode',
          'Set session ' + ctx.sessionId + ' to ' + nextMode + ' on instance ' + ctx.instanceId + '?',
          function () {
            apiPut('/api/policy/shield/' + encodeURIComponent(ctx.sessionId), {
              mode: nextMode,
              reason: 'operator defense tab',
              changed_by: 'operator',
            }).then(function () {
              logAction('Shield mode set to ' + nextMode + ' for ' + ctx.sessionId, 'warning');
              loadDefense();
            }).catch(function (err) {
              logAction('Shield mode change failed: ' + err.message, 'critical');
            });
          },
        );
      });
    });
  }

  function renderPolicyPacks(payload, ctx) {
    var el = document.getElementById('defense-packs-panel');
    if (!el) return;
    var active = payload.active_pack;
    var packOptions = (payload.packs || []).map(function (pack) {
      return '<option value="' + escapeHtml(pack.id) + '">' + escapeHtml(pack.label) + '</option>';
    }).join('');
    var actions = '';
    if (canWrite('policy_packs')) {
      actions =
        '<div class="defense-form-row">' +
          '<select id="defense-pack-select" class="defense-input">' + packOptions + '</select>' +
          '<button type="button" class="defense-btn" id="defense-pack-apply">Apply pack</button>' +
          '<button type="button" class="defense-btn defense-btn-muted" id="defense-pack-rollback">Rollback</button>' +
        '</div>';
    }
    el.innerHTML =
      '<div class="defense-status-row"><span>Active pack</span><b>' + escapeHtml(active ? active.packId : 'none') + '</b></div>' +
      (active && active.previousPackId
        ? '<div class="defense-status-row"><span>Previous</span><span>' + escapeHtml(active.previousPackId) + '</span></div>'
        : '') +
      actions;

    var applyBtn = document.getElementById('defense-pack-apply');
    var rollbackBtn = document.getElementById('defense-pack-rollback');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        var select = document.getElementById('defense-pack-select');
        var packId = select ? select.value : '';
        if (!packId) return;
        confirmAction(
          'Apply policy pack',
          'Apply pack ' + packId + ' to ' + (ctx.sessionId || 'instance ' + ctx.instanceId) + '?',
          function () {
            apiPost('/api/policy-packs/apply', {
              pack_id: packId,
              session_id: ctx.sessionId || undefined,
              instance_id: ctx.instanceId,
              applied_by: 'operator',
            }).then(function () {
              logAction('Applied policy pack ' + packId, 'warning');
              loadDefense();
            }).catch(function (err) {
              logAction('Policy pack apply failed: ' + err.message, 'critical');
            });
          },
        );
      });
    }
    if (rollbackBtn) {
      rollbackBtn.addEventListener('click', function () {
        confirmAction(
          'Rollback policy pack',
          'Rollback to the previous pack for this scope?',
          function () {
            apiPost('/api/policy-packs/rollback', {
              session_id: ctx.sessionId || undefined,
              instance_id: ctx.instanceId,
            }).then(function () {
              logAction('Policy pack rolled back', 'info');
              loadDefense();
            }).catch(function (err) {
              logAction('Policy pack rollback failed: ' + err.message, 'critical');
            });
          },
        );
      });
    }
  }

  function renderJit(payload, ctx) {
    var el = document.getElementById('defense-jit-panel');
    if (!el) return;
    var grants = payload.grants || [];
    var list = grants.length
      ? grants.map(function (g) {
        return (
          '<div class="defense-list-row">' +
            '<span>' + escapeHtml(g.scope) + ' / ' + escapeHtml(g.toolName || g.actionType || 'session') + '</span>' +
            '<span>exp ' + escapeHtml(g.expiresAt.slice(11, 19)) + '</span>' +
            (canWrite('jit_grants')
              ? '<button type="button" class="defense-btn defense-btn-muted defense-btn-sm" data-revoke-grant="' + escapeHtml(g.id) + '">Revoke</button>'
              : '') +
          '</div>'
        );
      }).join('')
      : '<div class="spec-empty">No active JIT grants</div>';

    var form = '';
    if (canWrite('jit_grants') && ctx.sessionId) {
      form =
        '<div class="defense-form-row">' +
          '<input id="defense-jit-tool" class="defense-input" placeholder="tool name e.g. file-write">' +
          '<input id="defense-jit-duration" class="defense-input" type="number" min="60" max="3600" value="300" title="seconds">' +
          '<button type="button" class="defense-btn" id="defense-jit-create">Grant</button>' +
        '</div>';
    } else if (!ctx.sessionId) {
      form = '<div class="spec-empty">Enter a session ID to manage JIT grants</div>';
    }

    el.innerHTML = list + form;

    el.querySelectorAll('[data-revoke-grant]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var grantId = btn.getAttribute('data-revoke-grant');
        confirmAction('Revoke JIT grant', 'Revoke grant ' + grantId + '?', function () {
          apiDelete('/api/jit/grants/' + encodeURIComponent(grantId)).then(function () {
            logAction('Revoked JIT grant ' + grantId, 'warning');
            loadDefense();
          }).catch(function (err) {
            logAction('JIT revoke failed: ' + err.message, 'critical');
          });
        });
      });
    });

    var createBtn = document.getElementById('defense-jit-create');
    if (createBtn) {
      createBtn.addEventListener('click', function () {
        var toolEl = document.getElementById('defense-jit-tool');
        var durEl = document.getElementById('defense-jit-duration');
        var toolName = toolEl ? toolEl.value.trim() : '';
        var duration = durEl ? parseInt(durEl.value, 10) : 300;
        if (!toolName) return;
        confirmAction(
          'Create JIT grant',
          'Grant ' + toolName + ' for session ' + ctx.sessionId + ' (' + duration + 's)?',
          function () {
            apiPost('/api/jit/grants', {
              session_id: ctx.sessionId,
              instance_id: ctx.instanceId,
              scope: 'tool',
              tool_name: toolName,
              duration_seconds: duration,
              granted_by: 'operator',
              reason: 'defense tab grant',
            }).then(function () {
              logAction('Created JIT grant for ' + toolName, 'info');
              loadDefense();
            }).catch(function (err) {
              logAction('JIT grant failed: ' + err.message, 'critical');
            });
          },
        );
      });
    }
  }

  function renderSimulation(ctx) {
    var el = document.getElementById('defense-simulation-panel');
    if (!el) return;
    if (!canWrite('simulation')) {
      el.innerHTML = '<div class="spec-empty">Simulation unavailable</div>';
      return;
    }
    el.innerHTML =
      '<div class="defense-form-row">' +
        '<input id="defense-sim-tool" class="defense-input" placeholder="tool name">' +
        '<input id="defense-sim-command" class="defense-input" placeholder="optional command or URL">' +
        '<button type="button" class="defense-btn" id="defense-sim-run">Preview</button>' +
      '</div>' +
      '<div id="defense-sim-result" class="spec-empty">Run a preview to see policy outcome</div>';

    var runBtn = document.getElementById('defense-sim-run');
    if (!runBtn) return;
    runBtn.addEventListener('click', function () {
      if (!ctx.sessionId) {
        logAction('Simulation requires a session ID', 'warning');
        return;
      }
      var toolEl = document.getElementById('defense-sim-tool');
      var cmdEl = document.getElementById('defense-sim-command');
      var toolName = toolEl ? toolEl.value.trim() : 'web-search';
      var command = cmdEl ? cmdEl.value.trim() : '';
      var params = command ? { command: command, url: command } : undefined;
      apiPost('/api/simulation/preview', {
        session_id: ctx.sessionId,
        instance_id: ctx.instanceId,
        tool_name: toolName,
        params: params,
      }).then(function (result) {
        var out = document.getElementById('defense-sim-result');
        if (out) {
          out.innerHTML =
            '<div class="defense-sim-preview ' + (result.wouldBlock ? 'blocked' : 'allowed') + '">' +
              escapeHtml(result.preview) +
            '</div>' +
            '<div class="spec-empty">Risk ' + escapeHtml(result.riskScore) + ' | shield ' + escapeHtml(result.shieldMode) + '</div>';
        }
        logAction('Simulation: ' + result.preview, result.wouldBlock ? 'critical' : 'info');
      }).catch(function (err) {
        logAction('Simulation failed: ' + err.message, 'critical');
      });
    });
  }

  function renderRemediation(payload, ctx) {
    var el = document.getElementById('defense-remediation-panel');
    if (!el) return;
    var rules = payload.remediation_rules || [];
    var rows = rules.map(function (rule) {
      var toggleNote = '<span class="defense-readonly-tag">config only</span>';
      var actionBtns = '';
      if (canWrite('auto_remediation') && ctx.sessionId) {
        actionBtns =
          '<button type="button" class="defense-btn defense-btn-sm" data-remediate="' + escapeHtml(rule.case) + '">Apply</button>' +
          '<button type="button" class="defense-btn defense-btn-muted defense-btn-sm" data-remediate-rollback="' + escapeHtml(rule.case) + '">Rollback</button>';
      }
      return (
        '<div class="defense-list-row">' +
          '<span><b>' + escapeHtml(rule.case) + '</b> ' + toggleNote + '</span>' +
          '<span>' + (rule.enabled ? 'enabled' : 'disabled') + ' / auto ' + (rule.autoApply ? 'on' : 'off') + '</span>' +
          actionBtns +
        '</div>'
      );
    }).join('');
    el.innerHTML = rows || '<div class="spec-empty">No remediation rules loaded</div>';

    el.querySelectorAll('[data-remediate]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var caseId = btn.getAttribute('data-remediate');
        confirmAction(
          'Apply auto-remediation',
          'Manually apply remediation case ' + caseId + ' for session ' + ctx.sessionId + '?',
          function () {
            apiPost('/api/auto-remediation/apply', {
              case: caseId,
              session_id: ctx.sessionId,
              instance_id: ctx.instanceId,
              reason: 'operator defense tab',
            }).then(function (res) {
              logAction('Remediation ' + caseId + ': ' + (res.actions || []).join(', '), 'warning');
              loadDefense();
            }).catch(function (err) {
              logAction('Remediation failed: ' + err.message, 'critical');
            });
          },
        );
      });
    });

    el.querySelectorAll('[data-remediate-rollback]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var caseId = btn.getAttribute('data-remediate-rollback');
        confirmAction('Rollback remediation', 'Rollback case ' + caseId + '?', function () {
          apiPost('/api/auto-remediation/rollback', {
            case: caseId,
            session_id: ctx.sessionId,
            instance_id: ctx.instanceId,
          }).then(function (res) {
            logAction('Remediation rollback ' + caseId + ': ' + (res.actions || []).join(', '), 'info');
            loadDefense();
          }).catch(function (err) {
            logAction('Remediation rollback failed: ' + err.message, 'critical');
          });
        });
      });
    });
  }

  function renderTripwires(payload) {
    var el = document.getElementById('defense-tripwire-panel');
    if (!el) return;
    var config = payload.tripwire_config || [];
    var hits = payload.tripwire_hits || [];
    var configRows = config.map(function (c) {
      return '<div class="defense-status-row"><span>' + escapeHtml(c.type) + '</span><span>' + (c.enabled ? 'on' : 'off') + ' / auto-q ' + (c.autoQuarantine ? 'yes' : 'no') + '</span></div>';
    }).join('');
    var hitRows = hits.length
      ? hits.map(function (h) {
        var lineage = h.sessionId
          ? '<button type="button" class="defense-btn defense-btn-sm defense-btn-muted" data-lineage-session="' + escapeHtml(h.sessionId) + '">Lineage</button>'
          : '';
        return (
          '<div class="defense-list-row">' +
            '<span class="' + escapeHtml(h.severity) + '">' + escapeHtml(h.type) + '</span>' +
            '<span>' + escapeHtml(h.description.slice(0, 80)) + '</span>' +
            lineage +
          '</div>'
        );
      }).join('')
      : '<div class="spec-empty">No recent tripwire hits</div>';
    el.innerHTML =
      '<div class="defense-subtitle">Config (read-only)</div>' + configRows +
      '<div class="defense-subtitle" style="margin-top:.55rem">Recent hits</div>' + hitRows;

    el.querySelectorAll('[data-lineage-session]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sid = btn.getAttribute('data-lineage-session');
        if (sid && typeof window.openLineageModal === 'function') {
          window.openLineageModal(sid);
        } else {
          logAction('Open incident timeline for session ' + sid, 'info');
        }
      });
    });
  }

  function renderRestrictions(payload) {
    var el = document.getElementById('defense-restrictions-panel');
    if (!el) return;
    var rows = (payload.restrictions || []).map(function (r) {
      return '<div class="defense-list-row"><span>' + escapeHtml(r.restriction) + '</span><span>' + escapeHtml(r.reason) + '</span></div>';
    }).join('');
    el.innerHTML = rows || '<div class="spec-empty">No active surface restrictions</div>';
  }

  function renderOperatorActions(terminal, ctx) {
    var el = document.getElementById('defense-operator-actions');
    if (!el || !terminal) {
      if (el) el.innerHTML = '<div class="spec-empty">Load a session to see response actions</div>';
      return;
    }
    var actions = (terminal.available_actions || []).map(function (action) {
      return '<button type="button" class="defense-btn defense-btn-' + escapeHtml(action.severity) + '" data-op-action="' + escapeHtml(action.id) + '">' + escapeHtml(action.label) + '</button>';
    }).join('');
    el.innerHTML = '<div class="defense-btn-row">' + actions + '</div>';

    el.querySelectorAll('[data-op-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var actionId = btn.getAttribute('data-op-action');
        if (!ctx.sessionId) {
          logAction('Response action requires a session ID', 'warning');
          return;
        }
        confirmAction(
          'Operator response',
          'Run ' + actionId + ' on session ' + ctx.sessionId + '?',
          function () {
            apiPost('/api/response-terminal/actions/' + encodeURIComponent(actionId), {
              session_id: ctx.sessionId,
              instance_id: ctx.instanceId,
              reason: 'defense tab operator action',
            }).then(function () {
              logAction('Response action ' + actionId + ' completed', 'warning');
              loadDefense();
            }).catch(function (err) {
              logAction('Response action failed: ' + err.message, 'critical');
            });
          },
        );
      });
    });
  }

  function renderAll(payload) {
    var ctx = getContext();
    renderTerminalSummary(payload.terminal);
    renderShield(payload, ctx);
    renderPolicyPacks(payload, ctx);
    renderJit(payload, ctx);
    renderSimulation(ctx);
    renderRemediation(payload, ctx);
    renderTripwires(payload);
    renderRestrictions(payload);
    renderOperatorActions(payload.terminal, ctx);
    renderActionLog();
  }

  function loadDefense() {
    var ctx = getContext();
    var params = new URLSearchParams();
    if (ctx.sessionId) params.set('session_id', ctx.sessionId);
    if (ctx.instanceId) params.set('instance_id', ctx.instanceId);
    var panel = document.getElementById('defense-tab-root');
    if (panel) panel.classList.add('defense-loading');

    return fetch('/api/dashboard/defense?' + params.toString(), { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        lastPayload = data;
        renderAll(data);
        if (window.DashboardResponseTerminal && ctx.sessionId) {
          window.DashboardResponseTerminal.load(ctx.sessionId, ctx.instanceId);
        }
      })
      .catch(function (err) {
        logAction('Defense load failed: ' + err.message, 'critical');
      })
      .finally(function () {
        if (panel) panel.classList.remove('defense-loading');
      });
  }

  var activeView = 'overview';

  function switchView(view) {
    if (window.DashboardFleetTab && activeView === 'fleet') {
      window.DashboardFleetTab.onDeactivate();
    }

    activeView = view;
    var overview = document.getElementById('view-overview');
    var defense = document.getElementById('view-defense');
    var governance = document.getElementById('view-governance');
    var fleet = document.getElementById('view-fleet');
    var attackSurface = document.getElementById('view-attack-surface');
    document.querySelectorAll('.dash-tab').forEach(function (tab) {
      var active = tab.getAttribute('data-view') === view;
      tab.classList.toggle('dash-tab-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (overview) overview.hidden = view !== 'overview';
    if (defense) defense.hidden = view !== 'defense';
    if (governance) governance.hidden = view !== 'governance';
    if (fleet) fleet.hidden = view !== 'fleet';
    if (attackSurface) attackSurface.hidden = view !== 'attack-surface';
    if (view === 'defense') void loadDefense();
    if (view === 'governance' && window.DashboardGovernanceTab) void window.DashboardGovernanceTab.load();
    if (view === 'fleet' && window.DashboardFleetTab) window.DashboardFleetTab.onActivate();
    if (view === 'attack-surface' && window.DashboardAttackSurfaceTab) window.DashboardAttackSurfaceTab.onActivate();
  }

  function initTabs() {
    document.querySelectorAll('.dash-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var view = tab.getAttribute('data-view');
        if (view) switchView(view);
      });
    });
    var refreshBtn = document.getElementById('defense-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { void loadDefense(); });
    var instanceBar = document.getElementById('instances-bar');
    if (instanceBar) {
      instanceBar.addEventListener('click', function (ev) {
        var target = ev.target;
        if (!(target instanceof HTMLElement)) return;
        var chip = target.closest('[data-instance-id]');
        if (!chip) return;
        var instanceId = chip.getAttribute('data-instance-id');
        var instanceInput = document.getElementById('defense-instance-id');
        if (instanceInput && instanceId) instanceInput.value = instanceId;
      });
    }
  }

  window.DashboardDefenseTab = {
    load: loadDefense,
    switchView: switchView,
    init: initTabs,
    getActiveView: function () { return activeView; },
    getActionLog: function () { return actionLog.slice(); },
  };

  document.addEventListener('DOMContentLoaded', function () {
    initTabs();
  });
})();
