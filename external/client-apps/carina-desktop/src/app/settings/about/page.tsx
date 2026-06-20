import { getHealth } from '../../../lib/gateway-client.js';
import { saveTextWithDialog } from '../../../lib/fs-dialogs.js';
import { checkForUpdates } from '../../../lib/updater.js';

export default function AboutSettingsPage() {
  async function exportDiagnostics() {
    const health = await getHealth();
    await saveTextWithDialog(
      'carina-desktop-diagnostics.json',
      JSON.stringify({
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        health,
        appearance: localStorage.getItem('carina_desktop_appearance'),
      }, null, 2),
      'application/json',
    );
  }

  async function handleCheckUpdates() {
    const update = await checkForUpdates();
    if (!update) {
      window.alert('You are on the latest version.');
    } else {
      window.alert(`Update available: ${update.version}`);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <section>
        <h2 className="text-lg font-semibold text-zinc-100">Carina Desktop</h2>
        <p className="text-sm text-zinc-400 mt-1">Version 0.1.0</p>
        <p className="text-xs text-zinc-600 mt-2">Build: local development</p>
      </section>
      <section className="space-y-2">
        <button type="button" onClick={() => void handleCheckUpdates()} className="text-xs border border-zinc-700 rounded px-3 py-1.5 text-zinc-300">
          Check for updates
        </button>
        <button type="button" onClick={() => void exportDiagnostics()} className="block text-xs border border-zinc-700 rounded px-3 py-1.5 text-zinc-300">
          Export diagnostics
        </button>
      </section>
      <section>
        <h3 className="text-sm font-medium text-zinc-200">License</h3>
        <p className="text-xs text-zinc-500 mt-1">Carina agent is MIT licensed. See LICENSE in the repository root.</p>
      </section>
      <section>
        <h3 className="text-sm font-medium text-zinc-200">Recent changes</h3>
        <ul className="mt-2 space-y-1 text-xs text-zinc-500">
          <li>0.1.0 - Desktop scaffold, chat engine, composer, pages</li>
        </ul>
      </section>
    </div>
  );
}
