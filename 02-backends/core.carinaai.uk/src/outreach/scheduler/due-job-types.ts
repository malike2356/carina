/** Durable outreach due-job statuses (Postgres claim/lease queue). */

export type OutreachDueJobStatus =
  | 'queued'
  | 'running'
  | 'deferred'
  | 'done'
  | 'skipped'
  | 'failed'
  | 'dead'
  | 'cancelled';

export interface OutreachDueJob {
  id: string;
  workspaceId: string;
  enrollmentId: string;
  stepId: string;
  stepOrder: number;
  campaignId: string | null;
  sequenceId: string | null;
  status: OutreachDueJobStatus;
  attempts: number;
  maxAttempts: number;
  lockedAt: string | null;
  lockedBy: string | null;
  availableAt: string;
  dueAt: string;
  lastError: string | null;
  deadLetterReason: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface OutreachSchedulerControl {
  key: string;
  paused: boolean;
  drainMode: boolean;
  updatedAt: string;
  updatedBy: string | null;
  reason: string | null;
}

export interface OutreachSchedulerHealth {
  paused: boolean;
  drainMode: boolean;
  queueDepth: number;
  deferredDepth: number;
  runningDepth: number;
  deadLetterCount: number;
  oldestDueAgeSeconds: number | null;
  processedTotal: number;
  retryTotal: number;
  deadLetterTotal: number;
  enqueueAt: string | null;
  drainAt: string | null;
  heartbeatAgeSeconds: number | null;
  durableEnabled: boolean;
}

/** Skip reasons that should not retry (terminal soft outcomes). */
export const PERMANENT_SKIP_REASONS = new Set([
  'paused',
  'enrollment_paused',
  'enrollment_stopped',
  'campaign_inactive',
  'missing_lead_or_sequence',
  'unsubscribed',
  'suppressed',
  'suppression_list',
  'already_replied',
  'already_booked',
  'completed',
  'missing_email',
  'duplicate_step',
  'step_mismatch',
  'cancelled',
]);

/** Soft deferrals: re-queue with available_at in the near future. */
export const DEFER_REASONS = new Set([
  'outside_business_hours',
  'daily_cap',
  'scheduler_paused',
  'provider_unavailable',
]);
