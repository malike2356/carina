function scoreColor(score: number): string {
  if (score >= 90) return '#22c55e';
  if (score >= 70) return '#eab308';
  if (score >= 50) return '#f97316';
  return '#ef4444';
}

function timeAgo(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface Props {
  score: number;
  events: Array<{ id: string; severity: string; summary: string; at: string }>;
  killSwitchActive: boolean;
  killSwitchReason: string;
  scoutConnected: boolean;
  scoutUrl: string | null;
  expanded: boolean;
  compact?: boolean;
  onToggle: () => void;
  onOpenReport: () => void;
}

export default function ScoutWidget({
  score,
  events,
  killSwitchActive,
  killSwitchReason,
  scoutConnected,
  scoutUrl,
  expanded,
  compact,
  onToggle,
  onOpenReport,
}: Props) {
  const color = scoreColor(score);
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (score / 100) * circumference;

  if (compact && !expanded) {
    return (
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-zinc-800">
        <span className={`h-2 w-2 rounded-full ${killSwitchActive ? 'bg-red-500' : scoutConnected ? 'bg-green-500' : 'bg-zinc-600'}`} />
        <span className="text-xs text-zinc-400">Scout {score}</span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-3">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between text-left">
        <span className="text-xs font-semibold text-zinc-200">Scout Security</span>
        <span className="text-[10px] text-zinc-500">{expanded ? 'Collapse' : 'Expand'}</span>
      </button>

      {killSwitchActive && (
        <div className="rounded border border-red-800 bg-red-950/40 px-2 py-1 text-xs text-red-300">
          KILL SWITCH ACTIVE: {killSwitchReason || 'Emergency suspension'}
        </div>
      )}

      <div className="flex items-center gap-3">
        <svg width="72" height="72" viewBox="0 0 72 72" className="flex-shrink-0">
          <circle cx="36" cy="36" r="28" stroke="#27272a" strokeWidth="6" fill="none" />
          <circle
            cx="36"
            cy="36"
            r="28"
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 36 36)"
          />
          <text x="36" y="40" textAnchor="middle" className="fill-zinc-100 text-sm font-semibold">{score}</text>
        </svg>
        <div className="text-xs text-zinc-400 space-y-1">
          <p>Trust Score</p>
          <p className={scoutConnected ? 'text-green-400' : 'text-zinc-500'}>
            Scout {scoutConnected ? 'Connected' : 'Disconnected'}
          </p>
          {scoutUrl && <p className="truncate max-w-[140px]">{scoutUrl}</p>}
          <p>{killSwitchActive ? 'Shield: triggered' : 'Shield: active'}</p>
        </div>
      </div>

      {expanded && (
        <>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-zinc-600">Recent events</p>
            {events.length === 0 && <p className="text-xs text-zinc-600">No recent events</p>}
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-2 text-xs">
                <span className={
                  event.severity === 'critical' ? 'text-red-400'
                    : event.severity === 'warning' ? 'text-yellow-400'
                      : 'text-zinc-500'
                }>
                  {event.severity}
                </span>
                <span className="flex-1 text-zinc-300 truncate">{event.summary}</span>
                <span className="text-zinc-600">{timeAgo(event.at)}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={onOpenReport} className="w-full text-xs border border-zinc-700 rounded px-2 py-1 text-zinc-300">
            View full report
          </button>
        </>
      )}
    </div>
  );
}
