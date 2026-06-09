(function () {
  function downloadCompliance(format) {
    window.location.href = '/api/trust/compliance-report?format=' + encodeURIComponent(format || 'json');
  }

  window.DashboardComplianceReport = { download: downloadCompliance };
  window.addEventListener('load', function () {
    const jsonBtn = document.getElementById('compliance-export-json');
    const pdfBtn = document.getElementById('compliance-export-pdf');
    if (jsonBtn) jsonBtn.addEventListener('click', function () { downloadCompliance('json'); });
    if (pdfBtn) pdfBtn.addEventListener('click', function () { downloadCompliance('pdf'); });
  });
})();
