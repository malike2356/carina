(function () {
  let activeAgents = 0;
  let resetTimer = null;
  let effectBusy = false;

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function resetKillEffect() {
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
    document.querySelectorAll('.ks-switch-button').forEach(function (btn) {
      btn.disabled = false;
    });
    effectBusy = false;
  }

  function fireKillEffect(statusText) {
    if (effectBusy) return;
    effectBusy = true;
    if (resetTimer) clearTimeout(resetTimer);

    var text = statusText || 'All agents suspended';
    var motion = reducedMotion();

    document.querySelectorAll('.ks-switch').forEach(function (ksSwitch) {
      ksSwitch.classList.add('ks-fired');
      var status = ksSwitch.querySelector('.ks-kill-status');
      if (status) status.textContent = text;

      var wrap = ksSwitch.closest('.hdr-kill-visual');
      if (wrap && !motion) {
        wrap.classList.remove('ks-shake');
        void wrap.offsetWidth;
        wrap.classList.add('ks-shake');
      }

      if (!motion) {
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

    var killStatus = document.getElementById('kill-status');
    if (killStatus) {
      killStatus.textContent = text.toUpperCase();
      killStatus.classList.add('active');
    }

    resetTimer = setTimeout(function () {
      resetKillEffect();
      if (killStatus) {
        killStatus.textContent = '';
        killStatus.classList.remove('active');
      }
    }, motion ? 2000 : 4500);
  }

  async function refreshAgentCount() {
    var res = await fetch('/api/dashboard/agent-status', { headers: window.H ? H() : {} });
    if (!res.ok) return;
    var data = await res.json();
    activeAgents = data.active || 0;
  }

  async function openGlobalKillSwitch() {
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
    var el = document.getElementById('kill-status');
    if (!el) return;
    if (data && data.confirmation) {
      el.textContent = data.confirmation;
      el.classList.add('active');
    }
  }

  function initKillTriggers() {
    document.querySelectorAll('[data-kill-trigger]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.closest('.ks-switch') && btn.closest('.ks-switch').classList.contains('ks-fired')) {
          return;
        }
        void openGlobalKillSwitch();
      });
    });
  }

  window.DashboardKillSwitch = {
    refreshAgentCount: refreshAgentCount,
    openGlobalKillSwitch: openGlobalKillSwitch,
    fireKillEffect: fireKillEffect,
    renderKillStatus: renderKillStatus,
  };

  window.addEventListener('load', function () {
    initKillTriggers();
    void refreshAgentCount();
  });
})();
