'use client';

import type { ReactNode } from 'react';
import { SeverityBadge } from '@/components/fleet/FleetUi';
import { timeAgo } from '@/lib/format';

export interface EscalationCardData {
  id: string;
  workerName?: string;
  workspaceName?: string;
  reason?: string;
  status: string;
  priority?: string;
  slaBreached?: boolean;
  minutesWaiting?: number;
  firstResponseAt?: string | null;
  slaFirstResponseTarget?: string | null;
  assignedTo?: { id: string; name: string } | null;
  createdAt?: string;
}

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function priorityRank(priority?: string): number {
  if (priority === 'urgent') return 0;
  if (priority === 'high') return 1;
  return 2;
}

export function sortEscalations<T extends EscalationCardData>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
  });
}

export function SlaStatPill({
  label,
  value,
  danger,
}: {
  label: string;
  value: ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={[
        'flex items-center gap-1.5 rounded-md border px-3 py-1.5',
        danger ? 'border-red-500/30 bg-red-500/10' : 'border-border bg-elevated',
      ].join(' ')}
    >
      <span className="text-text-muted">{label}:</span>
      <span className={['font-medium', danger ? 'text-red-400' : 'text-text-primary'].join(' ')}>
        {value}
      </span>
    </div>
  );
}

export function PriorityBadge({ priority }: { priority?: string }) {
  const config =
    priority === 'urgent'
      ? 'bg-red-500/15 text-red-400'
      : priority === 'high'
        ? 'bg-amber-500/15 text-amber-400'
        : null;
  if (!config) return null;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config}`}
    >
      {priority}
    </span>
  );
}

export function SlaBadge({ escalation: e }: { escalation: EscalationCardData }) {
  if (e.slaBreached) {
    return <span className="text-[10px] font-semibold text-red-400">BREACHED</span>;
  }
  if (!e.firstResponseAt && e.slaFirstResponseTarget) {
    const minsLeft = Math.round(
      (new Date(e.slaFirstResponseTarget).getTime() - Date.now()) / 60_000,
    );
    if (minsLeft <= 10) {
      return <span className="text-[10px] text-amber-400">{minsLeft}m</span>;
    }
  }
  return null;
}

export function SlaTracker({
  label,
  target,
  achieved,
}: {
  label: string;
  target?: string | null;
  achieved?: string | null;
}) {
  const targetDate = target ? new Date(target) : null;
  const minsLeft = targetDate ? Math.round((targetDate.getTime() - Date.now()) / 60_000) : null;
  const breached = !achieved && targetDate && targetDate.getTime() < Date.now();
  const met = Boolean(
    achieved && targetDate && new Date(achieved).getTime() <= targetDate.getTime(),
  );

  return (
    <div>
      <p className="mb-0.5 text-[10px] text-text-muted">{label}</p>
      {achieved ? (
        <p className="text-xs text-green-400">
          {met ? 'Met' : 'Recorded'} - {timeAgo(achieved)}
        </p>
      ) : breached ? (
        <p className="text-xs font-medium text-red-400">
          Overdue by {Math.abs(minsLeft ?? 0)}m
        </p>
      ) : minsLeft !== null ? (
        <p
          className={[
            'text-xs',
            minsLeft <= 10 ? 'text-amber-400' : 'text-text-secondary',
          ].join(' ')}
        >
          {minsLeft}m remaining
        </p>
      ) : (
        <p className="text-xs text-text-muted">-</p>
      )}
      {targetDate ? (
        <p className="text-[10px] text-text-muted">Target: {targetDate.toLocaleString()}</p>
      ) : null}
    </div>
  );
}

export function LoadBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? current / max : 0;
  const colorClass = pct < 0.8 ? 'bg-green-400' : pct < 1 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-overlay">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${Math.min(pct * 100, 100)}%` }}
        />
      </div>
      <span className="text-[11px] text-text-muted">
        {current}/{max}
      </span>
    </div>
  );
}

export function EscalationCard({
  escalation: e,
  onView,
  onQuickAssign,
  availableMembers,
}: {
  escalation: EscalationCardData;
  onView: (id: string) => void;
  onQuickAssign: (escalationId: string, memberId: string) => void;
  availableMembers: Array<{ id: string; name: string; currentLoad: number; maxLoad: number }>;
}) {
  const cardClass = [
    'flex flex-col gap-2 rounded-lg border p-3',
    e.slaBreached
      ? 'border-red-500/30 bg-red-500/5'
      : e.priority === 'urgent'
        ? 'border-amber-500/20 bg-elevated'
        : 'border-border bg-elevated',
  ].join(' ');

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between">
        {e.priority !== 'normal' ? <PriorityBadge priority={e.priority} /> : <span />}
        <SlaBadge escalation={e} />
      </div>
      <div>
        <p className="text-xs font-medium text-text-primary">
          {e.workerName ?? 'Worker'} - {e.workspaceName ?? 'Workspace'}
        </p>
      </div>
      <p className="line-clamp-2 text-[11px] text-text-secondary">&quot;{e.reason ?? ''}&quot;</p>
      <div className="flex items-center justify-between border-t border-border pt-2">
        <div className="text-[11px] text-text-muted">
          {formatMinutes(e.minutesWaiting ?? 0)} ago
          {e.assignedTo ? (
            <span className="ml-1.5 text-text-secondary">{e.assignedTo.name}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {e.status === 'open' && availableMembers.length > 0 ? (
            <select
              defaultValue=""
              aria-label="Quick assign"
              onChange={(ev) => {
                const memberId = ev.target.value;
                if (memberId) onQuickAssign(e.id, memberId);
                ev.target.value = '';
              }}
              className="max-w-[100px] rounded border border-border bg-base px-1 py-0.5 text-[10px] text-text-primary"
            >
              <option value="">Assign...</option>
              {availableMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => onView(e.id)}
            className="text-[11px] text-accent hover:underline"
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
}

export function KanbanColumn({
  title,
  count,
  breachCount,
  escalations,
  onView,
  onQuickAssign,
  availableMembers,
}: {
  title: string;
  count: number;
  breachCount: number;
  escalations: EscalationCardData[];
  onView: (id: string) => void;
  onQuickAssign: (escalationId: string, memberId: string) => void;
  availableMembers: Array<{ id: string; name: string; currentLoad: number; maxLoad: number }>;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        <span className="rounded bg-overlay px-1.5 py-0.5 text-xs text-text-muted">{count}</span>
        {breachCount > 0 ? (
          <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-xs text-red-400">
            {breachCount} breached
          </span>
        ) : null}
      </div>
      <div className="flex h-[calc(100vh-300px)] flex-col gap-2 overflow-y-auto pr-1">
        {escalations.map((e) => (
          <EscalationCard
            key={e.id}
            escalation={e}
            onView={onView}
            onQuickAssign={onQuickAssign}
            availableMembers={availableMembers}
          />
        ))}
        {escalations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-xs text-text-muted">No items</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ScoutSignalsSection({
  workerName,
  signals,
}: {
  workerName?: string;
  signals: Array<{ id: string; eventType: string; severity: string; summary: string }>;
}) {
  if (signals.length === 0) return null;
  return (
    <div className="p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        Scout signals for {workerName ?? 'Aiva'} (last 1h)
      </p>
      {signals.map((sig) => (
        <div key={sig.id} className="flex items-center gap-2 py-1.5 text-[11px]">
          <SeverityBadge severity={sig.severity} />
          <span className="font-mono text-text-muted">{sig.eventType}</span>
          <span className="flex-1 truncate text-text-secondary">{sig.summary}</span>
        </div>
      ))}
    </div>
  );
}

export function SlaKpiCard({
  label,
  value,
  sub,
  good,
}: {
  label: string;
  value: string;
  sub: string;
  good: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p
        className={[
          'mt-1 text-2xl font-semibold',
          good ? 'text-green-400' : 'text-amber-400',
        ].join(' ')}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-text-muted">{sub}</p>
    </div>
  );
}
