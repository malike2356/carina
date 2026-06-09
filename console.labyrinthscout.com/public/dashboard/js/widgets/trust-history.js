(function () {
  async function loadTrustHistory() {
    const res = await fetch('/api/trust/history', { headers: window.H ? H() : {} });
    if (!res.ok) return;
    renderTrustHistory(await res.json());
  }

  function renderTrustHistory(data) {
    const el = document.getElementById('trust-history-results');
    if (!el) return;

    const items = [];
    (data.verifications || []).forEach(function (row) {
      items.push(
        '<div class="audit-row info">' +
          '<span>' + new Date(row.submitted_at).toLocaleString() + '</span>' +
          '<b>ERC-8126</b>' +
          '<em>risk ' + row.unified_risk_score + '/100</em>' +
          '<small>WAV ' + row.wav_risk_score + ' · WV ' + row.wv_risk_score + '</small>' +
        '</div>',
      );
    });
    (data.attestations || []).forEach(function (row) {
      items.push(
        '<div class="audit-row warning">' +
          '<span>' + new Date(row.submitted_at).toLocaleString() + '</span>' +
          '<b>' + escapeHtml(row.tag) + '</b>' +
          '<em>score ' + row.score + '</em>' +
          '<small>' + escapeHtml(row.namespace) + '</small>' +
        '</div>',
      );
    });

    el.innerHTML = items.join('') || '<div class="spec-empty">No on-chain trust history yet</div>';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  window.DashboardTrustHistory = { load: loadTrustHistory };
  window.addEventListener('load', function () {
    void loadTrustHistory();
    setInterval(function () { void loadTrustHistory(); }, 60000);
  });
})();
