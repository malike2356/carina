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
})();
