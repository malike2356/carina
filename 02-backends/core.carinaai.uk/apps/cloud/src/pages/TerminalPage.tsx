import { Link } from 'react-router-dom';
import { TerminalPanel } from '../components/TerminalPanel';

export function TerminalPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Terminal</h1>
          <p className="mt-1 text-sm text-slate-600">Use the embedded shell here, or open the ops TUI.</p>
        </div>
        <a
          href="https://ops.carinaai.uk/tui"
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm hover:bg-slate-50"
        >
          Open ops TUI
        </a>
      </div>
      <TerminalPanel />
      <div className="flex justify-end">
        <Link to="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">
          Back to workspace
        </Link>
      </div>
    </div>
  );
}
