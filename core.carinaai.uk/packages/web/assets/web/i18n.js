/**
 * Client-side locale loader for static Carina web pages.
 * Fetches /api/locale and applies data-i18n attributes.
 */
(function () {
  function readParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function applyStrings(strings) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!key) return;
      var value = strings[key];
      if (!value) return;
      if (el instanceof HTMLInputElement && el.type === 'submit') {
        el.value = value;
      } else if (el instanceof HTMLButtonElement && el.type === 'submit') {
        el.textContent = value;
      } else if (el instanceof HTMLInputElement && el.placeholder !== undefined && el.hasAttribute('data-i18n-placeholder')) {
        el.placeholder = value;
      } else {
        el.textContent = value;
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      if (!(el instanceof HTMLInputElement)) return;
      var key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      var value = strings[key];
      if (value) el.placeholder = value;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      if (!key) return;
      var value = strings[key];
      if (value) el.setAttribute('title', value);
    });
  }

  function buildLanguageSelect(supported, active) {
    var host = document.getElementById('locale-switcher');
    if (!host || !Array.isArray(supported) || supported.length < 2) return;
    var select = document.createElement('select');
    select.id = 'carina-locale-select';
    select.style.marginTop = '12px';
    select.style.width = '100%';
    select.style.background = 'var(--bg)';
    select.style.color = 'var(--text)';
    select.style.border = '1px solid var(--border)';
    select.style.borderRadius = '6px';
    select.style.padding = '8px 10px';
    supported.forEach(function (code) {
      var opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code.toUpperCase();
      if (code === active) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', function () {
      var next = select.value;
      try { localStorage.setItem('carina_locale', next); } catch (_e) {}
      var url = new URL(window.location.href);
      url.searchParams.set('lang', next);
      window.location.href = url.toString();
    });
    host.appendChild(select);
  }

  async function boot() {
    var stored = '';
    try { stored = localStorage.getItem('carina_locale') || ''; } catch (_e) {}
    var requested = readParam('lang') || stored || (navigator.language || 'en');
    var prefix = document.body.getAttribute('data-i18n-prefix') || 'web.login';
    try {
      var res = await fetch('/api/locale?lang=' + encodeURIComponent(requested) + '&prefix=' + encodeURIComponent(prefix));
      if (!res.ok) return;
      var data = await res.json();
      if (data.locale) {
        document.documentElement.lang = data.locale;
        try { localStorage.setItem('carina_locale', data.locale); } catch (_e2) {}
      }
      if (data.strings) applyStrings(data.strings);
      buildLanguageSelect(data.supported || [], data.locale || 'en');
      if (readParam('error')) {
        var errEl = document.getElementById('error');
        if (errEl) errEl.hidden = false;
      }
    } catch (_err) {
      // Keep English defaults when offline or API unavailable.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
