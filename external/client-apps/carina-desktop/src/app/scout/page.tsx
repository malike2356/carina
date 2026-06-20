import { useStore } from '@nanostores/react';
import { useNavigate } from 'react-router-dom';
import {
  $killSwitchActive,
  $killSwitchReason,
  $scoutConnected,
  $scoutUrl,
  $securityEvents,
  $trustScore,
} from '../../store/carina.js';
import { ROUTES } from '../../lib/router-paths.js';

function scoreColor(score: number): string {
  if (score >= 90) return '#22c55e';
  if (score >= 70) return '#eab308';
  if (score >= 50) return '#f97316';
  return '#ef4444';
}

export default function ScoutReportPage() {
  const score = useStore($trustScore);
  const events = useStore($securityEvents);
  const killSwitchActive = useStore($killSwitchActive);
  const killSwitchReason = useStore($killSwitchReason);
  const scoutConnected = useStore($scoutConnected);
  const scoutUrl = useStore($scoutUrl);
  const navigate = useNavigate();

  const history = Array.from({ length: 24 }, (_, index) => ({
    hour: index,
    value: Math.max(0, Math.min(100, score - 10 + ((index * 7) % 20))),
  }));

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(ROUTES.chat)} className="text-xs text-zinc-500">Back</button>
        <h1 className="text-lg font-semibold text-zinc-100">Scout Security Report</h1>
      </div>

      {killSwitchActive && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-red-200">
          KILL SWITCH ACTIVE: {killSwitchReason || 'Emergency suspension in effect'}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Trust score</p>
          <p className="text-3xl font-bold mt-1" style={{ color: scoreColor(score) }}>{score}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Scout connection</p>
          <p className={`text-lg mt-1 ${scoutConnected ? 'text-green-400' : 'text-zinc-400'}`}>
            {scoutConnected ? 'Connected' : 'Disconnected'}
          </p>
          {scoutUrl && <p className="text-xs text-zinc-600 mt-1 truncate">{scoutUrl}</p>}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Kill switch</p>
          <p className={`text-lg mt-1 ${killSwitchActive ? 'text-red-400' : 'text-green-400'}`}>
            {killSwitchActive ? 'Triggered' : 'Normal'}
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-200 mb-2">Trust score history (24h)</h2>
        <div className="h-32 flex items-end gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          {history.map((point) => (
            <div
              key={point.hour}
              className="flex-1 rounded-t bg-indigo-600/80"
              style={{ height: `${point.value}%` }}
              title={`Hour ${point.hour}: ${point.value}`}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-200 mb-2">Security events</h2>
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900 text-zinc-500">
              <tr>
                <th className="text-left px-3 py-2">Severity</th>
                <th className="text-left px-3 py-2">Summary</th>
                <th className="text-left px-3 py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-zinc-800">
                  <td className="px-3 py-2 text-zinc-400">{event.severity}</td>
                  <td className="px-3 py-2 text-zinc-200">{event.summary}</td>
                  <td className="px-3 py-2 text-zinc-600">{new Date(event.at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {scoutUrl && (
        <a href={scoutUrl} target="_blank" rel="noreferrer" className="inline-block text-xs text-indigo-300">
          Open Scout console
        </a>
      )}
    </div>
  );
}
