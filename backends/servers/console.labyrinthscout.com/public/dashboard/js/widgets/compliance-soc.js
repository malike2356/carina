(function () {
  var refreshTimer = null;

  function headers() {
    return window.H ? H() : {};
  }

  function badgeState(covered, total) {
    if (!total || covered === 0) return 'red';
    if (covered === total) return 'green';
    return 'amber';
  }

  function badgeLabel(state, covered, total, configured) {
    if (!configured) return 'SOC2: Not Configured';
    if (state === 'green') return 'SOC2: Evidence Ready';
    if (state === 'amber') return 'SOC2: ' + covered + '/' + total + ' controls';
    return 'SOC2: Not Configured';
  }

  function render(data) {
    var compliance = data.compliance || {};
    var configured = !!compliance.configured;
    var covered = compliance.coveredControls || 0;
    var total = compliance.totalControls || 0;
    var state = badgeState(covered, total);

    var badge = document.getElementById('soc-compliance-badge');
    if (badge) {
      badge.className = 'soc-compliance-badge badge-' + state;
      var text = document.getElementById('soc-badge-text');
      if (text) text.textContent = badgeLabel(state, covered, total, configured);
    }

    var scoutTotal = document.getElementById('soc-scout-score-total');
    if (scoutTotal) scoutTotal.textContent = String(data.scoutScore ?? '-');

    var secBar = document.getElementById('soc-security-bar');
    var compBar = document.getElementById('soc-compliance-bar');
    if (secBar) secBar.style.width = (data.securityScore ?? 0) + '%';
    if (compBar) compBar.style.width = (data.complianceScore ?? 0) + '%';

    var secVal = document.getElementById('soc-security-value');
    var compVal = document.getElementById('soc-compliance-value');
    if (secVal) secVal.textContent = String(data.securityScore ?? '-');
    if (compVal) compVal.textContent = String(data.complianceScore ?? '-');

    var setup = document.getElementById('soc-setup-prompt');
    if (setup) setup.classList.toggle('hidden', configured);

    var panel = document.getElementById('soc-score-panel');
    if (panel) panel.classList.toggle('hidden', !configured);
  }

  async function loadScore() {
    try {
      var res = await fetch('/api/compliance/score', { headers: headers() });
      if (!res.ok) return;
      render(await res.json());
    } catch (_err) {
      /* silent */
    }
  }

  async function exportPackage() {
    var btn = document.getElementById('soc-export-btn');
    if (btn) btn.disabled = true;
    try {
      var res = await fetch('/api/compliance/export', { method: 'POST', headers: headers() });
      if (!res.ok) return;
      var blob = await res.blob();
      var url = window.URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'soc2-evidence-' + new Date().toISOString().slice(0, 10) + '.zip';
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function generateShareLink() {
    var res = await fetch('/api/compliance/share-link', { method: 'POST', headers: headers() });
    if (!res.ok) return;
    var data = await res.json();
    var box = document.getElementById('soc-share-link-box');
    var input = document.getElementById('soc-share-link-input');
    if (input) input.value = data.url || '';
    if (box) box.classList.remove('hidden');
  }

  function copyShareLink() {
    var input = document.getElementById('soc-share-link-input');
    if (!input || !input.value) return;
    void navigator.clipboard.writeText(input.value);
  }

  window.DashboardComplianceSoc = {
    load: loadScore,
    exportPackage: exportPackage,
    generateShareLink: generateShareLink,
    copyShareLink: copyShareLink,
  };

  window.addEventListener('load', function () {
    void loadScore();
    refreshTimer = setInterval(function () { void loadScore(); }, 60000);

    var exportBtn = document.getElementById('soc-export-btn');
    var shareBtn = document.getElementById('soc-share-link-btn');
    var copyBtn = document.getElementById('soc-share-copy-btn');
    if (exportBtn) exportBtn.addEventListener('click', function () { void exportPackage(); });
    if (shareBtn) shareBtn.addEventListener('click', function () { void generateShareLink(); });
    if (copyBtn) copyBtn.addEventListener('click', copyShareLink);
  });

  window.addEventListener('beforeunload', function () {
    if (refreshTimer) clearInterval(refreshTimer);
  });
})();
