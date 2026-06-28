/**
 * Runs before React hydrates so legacy service workers are replaced or removed
 * on Aiva product hosts (admin.hireaiva.co.uk).
 */
export function AivaServiceWorkerKillScript() {
  const script = `
(function () {
  var hosts = { 'admin.hireaiva.co.uk': 1, 'aiva.carinaai.uk': 1 };
  if (!hosts[location.hostname] || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistrations().then(function (regs) {
    if (!regs.length) return;
    return navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
  }).then(function (reg) {
    if (reg) return reg.update();
  }).catch(function () {});
})();
`.trim();

  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
