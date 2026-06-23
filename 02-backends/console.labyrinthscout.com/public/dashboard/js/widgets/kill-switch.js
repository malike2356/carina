(function () {
  let activeAgents = 0;
  let resetTimer = null;
  let effectBusy = false;
  let killTriggered = false;

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function setMeta(status) {
    var stateEl = document.getElementById('ks-state-label');
    var agentsEl = document.getElementById('ks-active-agents');
    var metaEl = document.getElementById('ks-triggered-meta');
    var byEl = document.getElementById('ks-triggered-by');
    if (stateEl) stateEl.textContent = status && status.triggered ? 'TRIGGERED' : 'ARMED';
    if (agentsEl && status && typeof status.agents_active === 'number') {
      agentsEl.textContent = String(status.agents_active);
    }
    if (metaEl && byEl) {
      if (status && status.triggered && status.triggered_by) {
        metaEl.hidden = false;
        byEl.textContent = status.triggered_by;
      } else {
        metaEl.hidden = true;
      }
    }
  }

  function resetKillEffect() {
    if (killTriggered) return;
    document.querySelectorAll('.ks-switch').forEach(function (ks) {
      ks.classList.remove('ks-fired');
      ks.querySelectorAll('.ks-shockwave').forEach(function (wave) {
        wave.classList.remove('ks-shockwave-go');
      });
      var status = ks.querySelector('.ks-kill-status');
      if (status) status.textContent = '';
    });
    document.querySelectorAll('.hdr-kill-visual').forEach(function (wrap) {
      wrap.classList.remove('ks-shake');
    });
    document.querySelectorAll('.dash-kill-dock').forEach(function (wrap) {
      wrap.classList.remove('ks-shake');
    });
    document.querySelectorAll('.ks-switch-button').forEach(function (btn) {
      btn.disabled = false;
    });
    document.querySelectorAll('.ks-action').forEach(function (row) {
      row.classList.remove('ks-action-hit');
    });
    effectBusy = false;
  }

  function animateActionHits() {
    var rows = document.querySelectorAll('#ks-actions-list .ks-action');
    rows.forEach(function (row, index) {
      setTimeout(function () {
        row.classList.add('ks-action-hit');
      }, index * 180);
    });
  }

  function applyTriggeredVisual(statusText, persist) {
    var text = statusText || 'All agents suspended';
    var motion = reducedMotion();

    document.querySelectorAll('.ks-switch').forEach(function (ksSwitch) {
      ksSwitch.classList.add('ks-fired');
      var status = ksSwitch.querySelector('.ks-kill-status');
      if (status) status.textContent = text;

      var wrap = ksSwitch.closest('.dash-kill-dock') || ksSwitch.closest('.hdr-kill-visual') || ksSwitch.closest('.ks-visual');
      if (wrap && !motion) {
        wrap.classList.remove('ks-shake');
        void wrap.offsetWidth;
        wrap.classList.add('ks-shake');
      }

      if (!motion && !persist) {
        ksSwitch.querySelectorAll('.ks-shockwave').forEach(function (wave, i) {
          wave.classList.remove('ks-shockwave-go');
          void wave.offsetWidth;
          setTimeout(function () {
            wave.classList.add('ks-shockwave-go');
          }, i * 120);
        });
      }

      var btn = ksSwitch.querySelector('.ks-switch-button');
      if (btn) btn.disabled = true;
    });

    animateActionHits();

    var killStatus = document.getElementById('kill-status');
    if (killStatus) {
      killStatus.textContent = text.toUpperCase();
      killStatus.classList.add('active');
    }
  }

  function fireKillEffect(statusText, opts) {
    var persist = opts && opts.persist;
    if (effectBusy && !persist) return;
    effectBusy = true;
    if (resetTimer) clearTimeout(resetTimer);

    applyTriggeredVisual(statusText, persist);

    if (persist) {
      killTriggered = true;
      return;
    }

    resetTimer = setTimeout(function () {
      resetKillEffect();
      var killStatus = document.getElementById('kill-status');
      if (killStatus) {
        killStatus.textContent = '';
        killStatus.classList.remove('active');
      }
    }, reducedMotion() ? 2000 : 4500);
  }

  async function refreshAgentCount() {
    try {
      var res = await fetch('/api/killswitch/status', { headers: window.H ? H() : {} });
      if (res.ok) {
        var status = await res.json();
        activeAgents = status.agents_active || 0;
        setMeta(status);
        if (status.triggered) {
          killTriggered = true;
          var reason = status.reason ? String(status.reason) : 'All agents suspended';
          applyTriggeredVisual(reason, true);
        }
        return;
      }
    } catch (_) {}

    var fallback = await fetch('/api/dashboard/agent-status', { headers: window.H ? H() : {} });
    if (!fallback.ok) return;
    var data = await fallback.json();
    activeAgents = data.active || 0;
    var agentsEl = document.getElementById('ks-active-agents');
    if (agentsEl) agentsEl.textContent = String(activeAgents);
  }

  async function openGlobalKillSwitch() {
    if (killTriggered) {
      if (typeof window.toast === 'function') {
        window.toast('Kill switch already triggered. Disarm on server to resume.', 'warning');
      }
      return;
    }
    await refreshAgentCount();
    var label = activeAgents === 1 ? '1 active agent' : activeAgents + ' active agents';
    if (typeof window.openKill === 'function') {
      window.openKill('__global__', label);
      return;
    }
    var desc = document.getElementById('kill-desc');
    if (desc) {
      desc.textContent = 'This will immediately stop all ' + activeAgents + ' active agents. Are you sure?';
    }
    var overlay = document.getElementById('kill-overlay');
    if (overlay) overlay.hidden = false;
  }

  function renderKillStatus(data) {
    if (!data) return;
    if (data.triggered || (data.confirmation && /suspended|stopped|triggered/i.test(data.confirmation))) {
      killTriggered = true;
      var text = data.reason || data.confirmation || 'All agents suspended';
      fireKillEffect(text, { persist: true });
      setMeta(data);
      return;
    }
    var el = document.getElementById('kill-status');
    if (!el) return;
    if (data.confirmation) {
      el.textContent = data.confirmation;
      el.classList.add('active');
    }
  }

  function initKillTriggers() {
    document.querySelectorAll('[data-kill-trigger]').forEach(function (btn) {
      if (btn.dataset.ksBound === '1') return;
      btn.dataset.ksBound = '1';
      btn.addEventListener('click', function () {
        if (btn.closest('.ks-switch') && btn.closest('.ks-switch').classList.contains('ks-fired')) {
          return;
        }
        void openGlobalKillSwitch();
      });
    });
  }

  function mountKillSwitchTab() {
    var root = document.getElementById('view-killswitch');
    if (!root || root.dataset.mounted === '1' || !window.KillSwitchMarkup) return;
    root.innerHTML = window.KillSwitchMarkup.panel();
    root.dataset.mounted = '1';
    initKillTriggers();
  }

  function mountToolbarKillSwitch() {
    var slot = document.getElementById('toolbar-kill-slot');
    if (!slot || slot.dataset.mounted === '1' || !window.KillSwitchMarkup) return;
    slot.innerHTML = window.KillSwitchMarkup.switchShell({
      id: 'toolbar-kill-switch',
      toolbar: true,
      label: 'Global kill switch',
    });
    slot.dataset.mounted = '1';
    initKillTriggers();
  }

  window.DashboardKillSwitch = {
    refreshAgentCount: refreshAgentCount,
    openGlobalKillSwitch: openGlobalKillSwitch,
    fireKillEffect: fireKillEffect,
    renderKillStatus: renderKillStatus,
    mountKillSwitchTab: mountKillSwitchTab,
    mountToolbarKillSwitch: mountToolbarKillSwitch,
    initKillTriggers: initKillTriggers,
  };

  window.addEventListener('load', function () {
    mountKillSwitchTab();
    mountToolbarKillSwitch();
    initKillTriggers();
    void refreshAgentCount();
  });
})();
