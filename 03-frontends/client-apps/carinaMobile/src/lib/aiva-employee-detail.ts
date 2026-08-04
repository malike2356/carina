import type {
  AivaSubscriptionStatus,
  AivaWorkerDetail,
  AivaWorkerStatus,
} from '@/api/aiva-client';
import { formatAivaStatusLabel } from '@/lib/aiva-home';
import { colors } from '@/theme/tokens';

export type AivaStatusChipTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface AivaStatusChip {
  status: string;
  label: string;
  tone: AivaStatusChipTone;
  color: string;
}

export interface AivaEmployeeOverview {
  id: string;
  name: string;
  initials: string;
  roleDescription: string;
  status: string;
  chip: AivaStatusChip;
  channels: string[];
  messagesToday: number;
  totalMessages: number;
  pendingApprovals: number;
  openEscalations: number;
  lastActiveAt: string | null;
  canPause: boolean;
  canResume: boolean;
  canEdit: boolean;
}

export interface AivaUsageGlance {
  messagesToday: number;
  totalMessages: number;
  pendingApprovals: number;
  creditLine: string | null;
}

export function mapAivaStatusChip(status: string): AivaStatusChip {
  const normalized = status.toLowerCase();
  if (normalized === 'active') {
    return {
      status: normalized,
      label: formatAivaStatusLabel(normalized),
      tone: 'success',
      color: colors.success,
    };
  }
  if (normalized === 'paused') {
    return {
      status: normalized,
      label: formatAivaStatusLabel(normalized),
      tone: 'warning',
      color: colors.amber,
    };
  }
  if (normalized === 'error' || normalized === 'suspended_by_scout') {
    return {
      status: normalized,
      label: formatAivaStatusLabel(normalized),
      tone: 'danger',
      color: colors.danger,
    };
  }
  return {
    status: normalized,
    label: formatAivaStatusLabel(normalized),
    tone: 'neutral',
    color: colors.silver,
  };
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

export function mapAivaWorkerDetailOverview(worker: AivaWorkerDetail): AivaEmployeeOverview {
  const status = worker.status;
  return {
    id: worker.id,
    name: worker.name,
    initials: initialsFromName(worker.name),
    roleDescription: worker.roleDescription,
    status,
    chip: mapAivaStatusChip(status),
    channels: worker.channels,
    messagesToday: worker.messagesToday ?? 0,
    totalMessages: worker.totalMessages ?? 0,
    pendingApprovals: worker.pendingApprovals ?? 0,
    openEscalations: worker.openEscalations ?? 0,
    lastActiveAt: worker.lastActiveAt ?? null,
    canPause: status === 'active',
    canResume: status === 'paused',
    canEdit: status !== 'dismissed',
  };
}

export function buildAivaUsageGlance(
  worker: AivaWorkerDetail,
  subscription: AivaSubscriptionStatus | null,
): AivaUsageGlance {
  let creditLine: string | null = null;
  if (subscription?.softWall) {
    creditLine = 'Managed AI credit exhausted';
  } else if (typeof subscription?.walletRemainingGbp === 'number') {
    creditLine = `Credit £${subscription.walletRemainingGbp.toFixed(2)}`;
  } else if (
    typeof subscription?.trialDaysRemaining === 'number' &&
    subscription.trialDaysRemaining >= 0 &&
    (subscription.status === 'trialing' || subscription.status === 'pending_channel')
  ) {
    const days = subscription.trialDaysRemaining;
    creditLine =
      days === 0 ? 'Trial ends today' : `Trial ${days} day${days === 1 ? '' : 's'} left`;
  }

  return {
    messagesToday: worker.messagesToday ?? 0,
    totalMessages: worker.totalMessages ?? 0,
    pendingApprovals: worker.pendingApprovals ?? 0,
    creditLine,
  };
}

/** Optimistic next status for pause/resume toggles. */
export function nextPauseResumeStatus(
  current: AivaWorkerStatus,
  action: 'pause' | 'resume',
): AivaWorkerStatus {
  if (action === 'pause') return 'paused';
  return 'active';
}

/**
 * Resolve pause/resume UI status after an API attempt.
 * On failure, rolls back to the previous status.
 */
export function resolvePauseResumeStatus(input: {
  previous: AivaWorkerStatus;
  action: 'pause' | 'resume';
  outcome: 'success' | 'failure';
  serverStatus?: AivaWorkerStatus | null;
}): AivaWorkerStatus {
  if (input.outcome === 'failure') {
    return input.previous;
  }
  if (input.serverStatus) {
    return input.serverStatus;
  }
  return nextPauseResumeStatus(input.previous, input.action);
}

export function applyWorkerStatus(
  worker: AivaWorkerDetail,
  status: AivaWorkerStatus,
): AivaWorkerDetail {
  return { ...worker, status };
}
