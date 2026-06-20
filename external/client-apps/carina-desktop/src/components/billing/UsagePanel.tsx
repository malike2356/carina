interface Props {
  planName: string;
  creditsRemaining: number;
  tokensUsed: number;
  tokenLimit: number;
  messagesSent: number;
  sessions: Array<{ title: string; model: string; tokens: number; estimatedCostUsd: number }>;
  expanded: boolean;
  compact?: boolean;
  onToggle: () => void;
  onUpgrade: () => void;
}

export default function UsagePanel({
  planName,
  creditsRemaining,
  tokensUsed,
  tokenLimit,
  messagesSent,
  sessions,
  expanded,
  compact,
  onToggle,
  onUpgrade,
}: Props) {
  const pct = tokenLimit > 0 ? Math.min(100, Math.round((tokensUsed / tokenLimit) * 100)) : 0;

  if (compact && !expanded) {
    return (
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-zinc-800">
        <span className="text-xs bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5">{planName}</span>
        <span className="text-xs text-zinc-500">{pct}% used</span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-3">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between text-left">
        <span className="text-xs font-semibold text-zinc-200">Usage</span>
        <span className="text-[10px] text-zinc-500">{expanded ? 'Collapse' : 'Expand'}</span>
      </button>

      <div className="flex items-center justify-between">
        <span className="text-xs bg-indigo-950 text-indigo-200 border border-indigo-800 rounded px-2 py-0.5">{planName}</span>
        <span className="text-xs text-zinc-500">{creditsRemaining.toLocaleString()} credits</span>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
          <span>Tokens this period</span>
          <span>{tokensUsed.toLocaleString()} / {tokenLimit.toLocaleString()}</span>
        </div>
        <div className="h-2 rounded bg-zinc-800 overflow-hidden">
          <div className="h-full bg-indigo-600" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[10px] text-zinc-600 mt-1">{messagesSent} messages sent</p>
      </div>

      {expanded && (
        <>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-zinc-600">Recent sessions</p>
            {sessions.length === 0 && <p className="text-xs text-zinc-600">No session costs yet</p>}
            {sessions.map((session) => (
              <div key={session.title} className="text-xs flex justify-between gap-2">
                <span className="truncate text-zinc-300">{session.title}</span>
                <span className="text-zinc-500">{session.tokens} tok</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={onUpgrade} className="w-full text-xs bg-zinc-800 hover:bg-zinc-700 rounded px-2 py-1 text-zinc-200">
            Upgrade plan
          </button>
        </>
      )}
    </div>
  );
}
