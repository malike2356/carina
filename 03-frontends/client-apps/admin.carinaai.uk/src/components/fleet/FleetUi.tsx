'use client';

import { X } from 'lucide-react';

export interface CriticalToast {
  id: string;
  agentId: string;
  agentName: string;
  workspaceName: string;
  eventType: string;
  summary: string;
}

export function CriticalSignalToasts({
  toasts,
  onDismiss,
  onView,
}: {
  toasts: CriticalToast[];
  onDismiss: (id: string) => void;
  onView: (agentId: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-[60] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="w-72 rounded-lg border border-red-500/40 border-t-2 border-t-red-500 bg-elevated p-3 shadow-lg"
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
              Critical - {toast.eventType}
            </span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 text-text-muted hover:text-text-primary"
              aria-label="Dismiss alert"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <p className="mb-0.5 text-xs font-medium text-text-primary">
            {toast.agentName} in {toast.workspaceName}
          </p>
          <p className="mb-2 line-clamp-2 text-[11px] text-text-secondary">{toast.summary}</p>
          <button
            type="button"
            onClick={() => onView(toast.agentId)}
            className="text-[11px] text-accent hover:underline"
          >
            View
          </button>
        </div>
      ))}
    </div>
  );
}

export function AivaStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-400',
    paused: 'bg-amber-400',
    error: 'bg-red-400',
    configuring: 'bg-blue-400',
  };
  return (
    <span className="inline-flex items-center gap-1.5 capitalize text-text-secondary">
      <span className={`h-1.5 w-1.5 rounded-full ${colors[status] ?? 'bg-text-muted'}`} />
      {status}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-500/15 text-red-400',
    warning: 'bg-amber-500/15 text-amber-400',
    info: 'bg-gray-500/10 text-text-muted',
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${styles[severity] ?? styles.info}`}
    >
      {severity}
    </span>
  );
}

export function AttestationCell({ coverage }: { coverage: number }) {
  const pct = Math.round(coverage * 100);
  const colorClass = pct >= 95 ? 'text-green-400' : pct >= 80 ? 'text-amber-400' : 'text-red-400';
  return <span className={colorClass}>{pct}%</span>;
}

export function maskIdentifier(identifier: string, channel: string): string {
  if (channel === 'email' && identifier.includes('@')) {
    const [user, domain] = identifier.split('@');
    return `${user.slice(0, 2)}***@${domain}`;
  }
  if (identifier.length <= 4) return identifier;
  return `${identifier.slice(0, 3)}***${identifier.slice(-2)}`;
}

export function LiveIndicator({ connected, reconnecting }: { connected: boolean; reconnecting: boolean }) {
  if (reconnecting) {
    return <span className="text-xs text-amber-400">Reconnecting...</span>;
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-text-muted">
      <span className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-green-400' : 'bg-text-muted'}`} />
      {connected ? 'Live' : 'Offline'}
    </span>
  );
}
