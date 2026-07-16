import type { AivaSubscriptionStatus, AivaWorkerSummary } from '@/api/aiva-client';

export interface AivaWorkerListItem {
  id: string;
  name: string;
  status: string;
  statusLabel: string;
  channelCount: number;
  roleDescription: string;
  lastActiveLabel: string | null;
  updatedAt: string | null;
}

export type AivaNextAction =
  | { kind: 'hire'; label: string; subtitle: string }
  | { kind: 'open'; workerId: string; workerName: string; label: string; subtitle: string };

export type AivaListView =
  | { kind: 'loading' }
  | {
      kind: 'error';
      message: string;
      sessionExpired: boolean;
      planGate: boolean;
    }
  | { kind: 'empty'; message: string }
  | { kind: 'ready'; workers: AivaWorkerListItem[] };

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  error: 'Needs attention',
  dismissed: 'Dismissed',
  suspended_by_scout: 'Suspended by Scout',
};

export function formatAivaStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export function mapAivaWorkerToListItem(worker: AivaWorkerSummary): AivaWorkerListItem {
  const lastActiveSource = worker.updatedAt ?? worker.createdAt;
  return {
    id: worker.id,
    name: worker.name,
    status: worker.status,
    statusLabel: formatAivaStatusLabel(worker.status),
    channelCount: worker.channels.length,
    roleDescription: worker.roleDescription,
    lastActiveLabel: formatRelativeTime(lastActiveSource),
    updatedAt: worker.updatedAt,
  };
}

export function mapAivaWorkersToListItems(workers: AivaWorkerSummary[]): AivaWorkerListItem[] {
  return workers
    .filter((worker) => worker.status !== 'dismissed')
    .map(mapAivaWorkerToListItem)
    .sort((a, b) => compareIsoDesc(a.updatedAt, b.updatedAt));
}

export function pickLatestAivaWorker(
  workers: AivaWorkerSummary[],
): AivaWorkerSummary | null {
  const active = workers.filter((worker) => worker.status !== 'dismissed');
  if (active.length === 0) return null;
  return [...active].sort((a, b) => compareIsoDesc(a.updatedAt, b.updatedAt))[0] ?? null;
}

export function resolveAivaNextAction(workers: AivaWorkerSummary[]): AivaNextAction {
  const latest = pickLatestAivaWorker(workers);
  if (!latest) {
    return {
      kind: 'hire',
      label: 'Hire an AI employee',
      subtitle: 'Create your first Aiva to handle inbox, channels, and follow-ups.',
    };
  }
  return {
    kind: 'open',
    workerId: latest.id,
    workerName: latest.name,
    label: `Open ${latest.name}`,
    subtitle: 'Jump back to your most recently updated employee.',
  };
}

export function resolveAivaListView(input: {
  phase: 'idle' | 'loading' | 'ready' | 'error';
  workers: AivaWorkerSummary[];
  error: string | null;
  sessionExpired: boolean;
  planGate: boolean;
}): AivaListView {
  if (input.phase === 'idle' || input.phase === 'loading') {
    return { kind: 'loading' };
  }
  if (input.phase === 'error') {
    return {
      kind: 'error',
      message: input.error ?? 'Could not load employees.',
      sessionExpired: input.sessionExpired,
      planGate: input.planGate,
    };
  }
  const items = mapAivaWorkersToListItems(input.workers);
  if (items.length === 0) {
    return {
      kind: 'empty',
      message: 'No AI employees yet. Hire one to get started.',
    };
  }
  return { kind: 'ready', workers: items };
}

export function buildAivaCreditHint(
  subscription: AivaSubscriptionStatus | null,
): string | null {
  if (!subscription) return null;
  if (subscription.softWall) {
    return 'Managed AI credit is exhausted. Top up, add BYOK, or upgrade to keep employees running.';
  }
  if (
    typeof subscription.trialDaysRemaining === 'number' &&
    subscription.trialDaysRemaining >= 0 &&
    (subscription.status === 'trialing' || subscription.status === 'pending_channel')
  ) {
    const days = subscription.trialDaysRemaining;
    return days === 0
      ? 'Trial ends today.'
      : `Trial: ${days} day${days === 1 ? '' : 's'} remaining.`;
  }
  if (typeof subscription.walletRemainingGbp === 'number') {
    return `Managed AI credit: £${subscription.walletRemainingGbp.toFixed(2)} remaining.`;
  }
  return null;
}

export function greetingNameFromEmail(email: string | null | undefined): string {
  if (!email) return 'there';
  const local = email.split('@')[0]?.trim();
  if (!local) return 'there';
  return local;
}

function compareIsoDesc(a: string | null | undefined, b: string | null | undefined): number {
  const aMs = a ? Date.parse(a) : 0;
  const bMs = b ? Date.parse(b) : 0;
  return bMs - aMs;
}

function formatRelativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const deltaSec = Math.round((Date.now() - ms) / 1000);
  if (deltaSec < 60) return 'Just now';
  if (deltaSec < 3600) {
    const mins = Math.floor(deltaSec / 60);
    return `${mins}m ago`;
  }
  if (deltaSec < 86400) {
    const hours = Math.floor(deltaSec / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(deltaSec / 86400);
  if (days < 14) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}
