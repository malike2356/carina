(function () {
  function downloadCompliance(format) {
    const fmt = format || 'json';
    const dateStr = new Date().toISOString().slice(0, 10);
    const url = '/api/trust/compliance-report?format=' + encodeURIComponent(fmt);
    if (window.downloadScoutExport) {
      void window.downloadScoutExport(url, 'scout-compliance-' + dateStr + '.' + fmt);
    }
  }

  window.DashboardComplianceReport = { download: downloadCompliance };
  window.addEventListener('load', function () {
    const jsonBtn = document.getElementById('compliance-export-json');
    const pdfBtn = document.getElementById('compliance-export-pdf');
    if (jsonBtn) jsonBtn.addEventListener('click', function () { downloadCompliance('json'); });
    if (pdfBtn) pdfBtn.addEventListener('click', function () { downloadCompliance('pdf'); });
  });
})();
