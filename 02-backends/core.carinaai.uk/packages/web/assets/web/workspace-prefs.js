(function () {
  const PREFS_KEY = 'carina_web_prefs';

  function getPrefs() {
    try {
      return Object.assign({ theme: 'dark' }, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'));
    } catch {
      return { theme: 'dark' };
    }
  }

  function savePrefs(patch) {
    const next = Object.assign(getPrefs(), patch);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    return next;
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
    const btn = document.getElementById('ws-theme-toggle');
    if (btn) btn.textContent = theme === 'light' ? 'Dark theme' : 'Light theme';
  }

  applyTheme(getPrefs().theme);

  const toggle = document.getElementById('ws-theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      const next = getPrefs().theme === 'dark' ? 'light' : 'dark';
      savePrefs({ theme: next });
      applyTheme(next);
    });
  }

  // Apply custom operator theme if active
  (function () {
    var active = localStorage.getItem('carina:active-theme');
    if (!active) return;
    fetch('/api/theme').then(function (r) { return r.json(); }).then(function (d) {
      var theme = (d.themes || []).find(function (t) { return t.name === active; });
      if (!theme) return;
      var s = document.documentElement.style;
      s.setProperty('--bg', theme.bg);
      s.setProperty('--surface', theme.surface || theme.bg);
      s.setProperty('--text', theme.text || '#e4e4e9');
      s.setProperty('--muted', theme.muted || '#575768');
      s.setProperty('--accent', theme.accent);
      s.setProperty('--border', theme.border || 'rgba(255,255,255,0.07)');
      s.setProperty('--accent-dim', theme.accent + '22');
    }).catch(function () {});
  })();

  // Theme picker: populate select when present in workspace sidebar
  (function () {
    var picker = document.getElementById('ws-theme-picker');
    if (!picker) return;
    fetch('/api/theme').then(function (r) { return r.json(); }).then(function (d) {
      var activeTheme = localStorage.getItem('carina:active-theme') || '';
      picker.innerHTML = '<option value="">Default dark</option>' +
        (d.themes || []).map(function (t) {
          return '<option value="' + t.name + '"' + (t.name === activeTheme ? ' selected' : '') + '>' + t.name + '</option>';
        }).join('');
      picker.onchange = function () {
        localStorage.setItem('carina:active-theme', picker.value);
        location.reload();
      };
    });
  })();

  // Language picker: keep the workspace shell in sync with the locale API.
  (function () {
    var host = document.getElementById('locale-switcher');
    if (!host) return;
    fetch('/api/locale?prefix=web')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var supported = data.supported || [];
        if (!Array.isArray(supported) || supported.length < 2) return;

        var select = document.createElement('select');
        select.id = 'carina-locale-select';
        select.style.width = '100%';
        select.style.background = 'var(--surface-2)';
        select.style.color = 'var(--text)';
        select.style.border = '1px solid var(--border)';
        select.style.borderRadius = '6px';
        select.style.padding = '0.3rem 0.4rem';
        select.style.fontSize = '0.78rem';

        supported.forEach(function (code) {
          var option = document.createElement('option');
          option.value = code;
          option.textContent = code.toUpperCase();
          if (code === data.locale) option.selected = true;
          select.appendChild(option);
        });

        select.addEventListener('change', function () {
          var next = select.value;
          try { localStorage.setItem('carina_locale', next); } catch (_e) {}
          fetch('/api/locale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale: next }),
          }).finally(function () {
            var url = new URL(window.location.href);
            url.searchParams.set('lang', next);
            window.location.href = url.toString();
          });
        });

        host.appendChild(select);
      })
      .catch(function () {});
  })();

  const profileEl = document.getElementById('ws-profile-scope');
  if (profileEl) {
    fetch('/api/web/context')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (ctx) {
        if (!ctx || ctx.mode !== 'private' || !ctx.activeProfile) return;
        const home = ctx.profileScope && ctx.profileScope.carinaHome
          ? ctx.profileScope.carinaHome
          : '';
        profileEl.textContent = home
          ? ('Profile: ' + ctx.activeProfile + ' · ' + home)
          : ('Profile: ' + ctx.activeProfile);

        if (!Array.isArray(ctx.profiles) || ctx.profiles.length < 2) return;
        var label = document.createElement('label');
        label.textContent = 'Profile';
        label.style.display = 'block';
        label.style.fontSize = '0.7rem';
        label.style.color = 'var(--muted)';
        label.style.marginBottom = '0.3rem';

        var select = document.createElement('select');
        select.style.width = '100%';
        select.style.background = 'var(--surface-2)';
        select.style.color = 'var(--text)';
        select.style.border = '1px solid var(--border)';
        select.style.borderRadius = '6px';
        select.style.padding = '0.3rem 0.4rem';
        select.style.fontSize = '0.78rem';
        ctx.profiles.forEach(function (name) {
          var option = document.createElement('option');
          option.value = name;
          option.textContent = name;
          if (name === ctx.activeProfile) option.selected = true;
          select.appendChild(option);
        });
        select.addEventListener('change', function () {
          var next = select.value;
          fetch('/api/web/context/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile: next }),
          }).then(function (res) { return res.json(); }).then(function (data) {
            if (!data || !data.ok) return;
            location.reload();
          }).catch(function () {});
        });

        profileEl.appendChild(label);
        profileEl.appendChild(select);
      })
      .catch(function () {});
  }

  // Mark current page active in both sidebar nav and bottom nav
  var currentPath = window.location.pathname;
  document.querySelectorAll('.carina-ws-nav a, .carina-ws-bottom-nav a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href === currentPath) {
      a.classList.add('active');
    }
  });

  // Mobile sidebar: swipe right from left edge to open, swipe left or tap overlay to close
  var touchStartX = 0;
  var touchStartY = 0;
  var sidebar = document.getElementById('ws-sidebar');
  var overlay = document.getElementById('ws-overlay');

  if (sidebar) {
    document.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (Math.abs(dx) < 40) return;
      if (dx > 0 && touchStartX < 36) {
        sidebar.classList.add('mobile-open');
      } else if (dx < 0) {
        sidebar.classList.remove('mobile-open');
      }
    }, { passive: true });

    if (overlay) {
      overlay.addEventListener('click', function () {
        sidebar.classList.remove('mobile-open');
      });
    }

    // Keyboard: Escape closes the sidebar
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') sidebar.classList.remove('mobile-open');
    });
  }

  // Service worker registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/service-worker.js').catch(function () {});
    });
  }
})();
