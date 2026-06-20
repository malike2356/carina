(function () {
  'use strict';

  function authHeaders() {
    return window.__SCOUT_KEY ? { 'X-Scout-Key': window.__SCOUT_KEY } : {};
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function severityClass(sev) {
    if (sev === 'critical') return 'sev-critical';
    if (sev === 'high') return 'sev-high';
    if (sev === 'medium') return 'sev-medium';
    return 'sev-info';
  }

  async function fetchSummary() {
    const res = await fetch('/api/attack-surface/summary', { headers: authHeaders() });
    if (!res.ok) throw new Error('Attack surface summary ' + res.status);
    return res.json();
  }

  function renderScore(score) {
    var el = document.getElementById('as-score-value');
    var badge = document.getElementById('as-score-badge');
    if (!el || !score) return;
    el.textContent = String(score.score);
    if (badge) {
      var label = score.score >= 80 ? 'HEALTHY' : score.score >= 50 ? 'AT RISK' : 'CRITICAL';
      badge.textContent = label;
      badge.className = 'as-score-badge ' + (score.score >= 80 ? 'ok' : score.score >= 50 ? 'warn' : 'bad');
    }
  }

  function renderTargets(targets) {
    var el = document.getElementById('as-targets-list');
    if (!el) return;
    if (!targets || !targets.length) {
      el.innerHTML = '<div class="spec-empty">No monitored targets yet</div>';
      return;
    }
    el.innerHTML = targets.map(function (t) {
      return (
        '<div class="as-target-row">' +
          '<span class="as-target-name">' + escapeHtml(t.target) + '</span>' +
          '<span class="as-target-type">' + escapeHtml(t.targetType) + '</span>' +
          '<span class="as-target-status ' + (t.isActive ? 'active' : 'inactive') + '">' +
            (t.isActive ? 'active' : 'inactive') +
          '</span>' +
        '</div>'
      );
    }).join('');
  }

  function renderFindings(findings) {
    var el = document.getElementById('as-findings-table');
    if (!el) return;
    if (!findings || !findings.length) {
      el.innerHTML = '<tr><td colspan="5" class="spec-empty">No open findings</td></tr>';
      return;
    }
    el.innerHTML = findings.map(function (f) {
      return (
        '<tr>' +
          '<td><span class="as-sev ' + severityClass(f.severity) + '">' + escapeHtml(f.severity) + '</span></td>' +
          '<td>' + escapeHtml(f.title) + '</td>' +
          '<td>' + escapeHtml(f.tool) + '</td>' +
          '<td>' + escapeHtml(f.findingType) + '</td>' +
          '<td>' + escapeHtml(f.status) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function renderCves(cves) {
    var el = document.getElementById('as-cve-list');
    if (!el) return;
    if (!cves || !cves.length) {
      el.innerHTML = '<div class="spec-empty">No CVE findings</div>';
      return;
    }
    el.innerHTML = cves.map(function (c) {
      return (
        '<div class="as-cve-row">' +
          '<span class="as-sev ' + severityClass(c.severity) + '">' + escapeHtml(c.severity) + '</span>' +
          '<span class="as-cve-title">' + escapeHtml(c.title) + '</span>' +
          (c.cvssScore != null ? '<span class="as-cve-cvss">CVSS ' + escapeHtml(c.cvssScore) + '</span>' : '') +
        '</div>'
      );
    }).join('');
  }

  function renderSurface(surface) {
    var ports = document.getElementById('as-open-ports');
    var subs = document.getElementById('as-subdomains');
    if (ports) {
      ports.textContent = (surface.openPorts || []).join(', ') || 'none detected';
    }
    if (subs) {
      subs.textContent = (surface.subdomains || []).slice(0, 12).join(', ') || 'none detected';
    }
    renderCves(surface.topCves || []);
  }

  function renderSeverity(sev) {
    var ids = ['critical', 'high', 'medium', 'low', 'info'];
    ids.forEach(function (key) {
      var el = document.getElementById('as-sev-' + key);
      if (el && sev) el.textContent = String(sev[key] ?? 0);
    });
  }

  async function loadAttackSurface() {
    var loading = document.getElementById('as-loading');
    var content = document.getElementById('as-content');
    if (loading) loading.hidden = false;
    if (content) content.hidden = true;
    try {
      var data = await fetchSummary();
      renderScore(data.scoutScore);
      renderSeverity(data.severity);
      renderTargets(data.targets);
      renderFindings(data.recentFindings);
      renderSurface(data.attackSurface || {});
      if (loading) loading.hidden = true;
      if (content) content.hidden = false;
    } catch (err) {
      if (loading) {
        loading.textContent = 'Failed to load attack surface: ' + (err && err.message ? err.message : String(err));
      }
    }
  }

  async function downloadStix() {
    var res = await fetch('/api/reports/stix/download?cve_only=true', { headers: authHeaders() });
    if (!res.ok) throw new Error('STIX export failed');
    var blob = await res.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'scout-cve-findings.stix.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  window.DashboardAttackSurfaceTab = {
    load: loadAttackSurface,
    onActivate: function () { void loadAttackSurface(); },
  };

  document.addEventListener('DOMContentLoaded', function () {
    var refresh = document.getElementById('as-refresh');
    var stixBtn = document.getElementById('as-stix-export');
    if (refresh) refresh.addEventListener('click', function () { void loadAttackSurface(); });
    if (stixBtn) stixBtn.addEventListener('click', function () {
      void downloadStix().catch(function (err) {
        alert(err.message || String(err));
      });
    });
  });
})();
