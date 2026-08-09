/**
 * Aggregated outreach observability snapshot for ops dashboards and alerts.
 */

import { isDatabaseConfigured } from '../../config/database-url.js';
import { pool } from '../../memory/db.js';
import { loadOutreachStore } from '../store.js';
import { getOutreachCounters } from './counters.js';
import { getOutreachTestModeStatus } from '../test-mode.js';
import { buildFunnelReport } from '../funnel-analytics.js';

export type OutreachObservabilitySnapshot = {
  at: string;
  testMode: ReturnType<typeof getOutreachTestModeStatus>;
  scheduler: Record<string, unknown> | null;
  approvals: {
    pending: number;
    oldestAgeSeconds: number | null;
  };
  deliveries: {
    sent: number;
    failed: number;
    delivered: number;
    bounced: number;
    pendingApproval: number;
  };
  mailbox: {
    unmatchedOpenReviews: number;
    ambiguousOpenReviews: number;
  };
  reconcile: {
    openGaps: number;
  };
  provider: {
    counters: Record<string, number>;
    recentEventLagSeconds: number | null;
  };
  funnel: ReturnType<typeof buildFunnelReport> | null;
  database: {
    configured: boolean;
    pingMs: number | null;
    error: string | null;
  };
  alerts: Array<{ id: string; severity: 'info' | 'warn' | 'error'; message: string }>;
};

function ageSeconds(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 1000));
}

export async function getOutreachObservabilitySnapshot(workspaceId?: string): Promise<OutreachObservabilitySnapshot> {
  const store = loadOutreachStore();
  const approvals = store.leads.length >= 0
    ? [] // approvals live in worker approval store; approximate via deliveries pending_approval
    : [];
  void approvals;

  const deliveries = workspaceId
    ? store.deliveries.filter((d) => d.workspaceId === workspaceId)
    : store.deliveries;
  const deliveryStats = {
    sent: deliveries.filter((d) => d.status === 'sent' || d.status === 'delivered').length,
    failed: deliveries.filter((d) => d.status === 'failed').length,
    delivered: deliveries.filter((d) => d.status === 'delivered').length,
    bounced: deliveries.filter((d) => d.status === 'bounced' || d.status === 'complained').length,
    pendingApproval: deliveries.filter((d) => d.status === 'pending_approval').length,
  };

  const reviews = workspaceId
    ? store.replyReviews.filter((r) => r.workspaceId === workspaceId && r.status === 'open')
    : store.replyReviews.filter((r) => r.status === 'open');
  const unmatchedOpenReviews = reviews.filter((r) => !r.matchedLeadId && r.matchMethod !== 'ambiguous').length
    + reviews.filter((r) => r.matchMethod === 'none' || (!r.matchedLeadId && !r.matchMethod)).length;
  const ambiguousOpenReviews = reviews.filter((r) => r.matchMethod === 'ambiguous' || r.matchConfidence === 0).length;

  let scheduler: Record<string, unknown> | null = null;
  try {
    const { isOutreachDurableSchedulerEnabled, getSchedulerHealth } = await import('../scheduler/due-job-queue.js');
    if (isOutreachDurableSchedulerEnabled()) {
      scheduler = await getSchedulerHealth() as unknown as Record<string, unknown>;
    }
  } catch {
    scheduler = null;
  }

  let openGaps = 0;
  let recentEventLagSeconds: number | null = null;
  if (isDatabaseConfigured()) {
    try {
      const gaps = await pool.query(
        `SELECT COUNT(*)::int AS c FROM outreach_delivery_reconcile_gaps WHERE status = 'open'`,
      );
      openGaps = Number(gaps.rows[0]?.c ?? 0);
      const lag = await pool.query(
        `SELECT EXTRACT(EPOCH FROM (NOW() - MAX(occurred_at)))::int AS lag
         FROM outreach_provider_events
         WHERE received_at > NOW() - INTERVAL '24 hours'`,
      );
      const lagVal = lag.rows[0]?.lag;
      recentEventLagSeconds = lagVal == null ? null : Number(lagVal);
    } catch {
      // tables may not exist yet
    }
  }

  let pendingApprovals = deliveryStats.pendingApproval;
  let oldestApprovalAge: number | null = null;
  try {
    const pending = deliveries
      .filter((d) => d.status === 'pending_approval')
      .map((d) => d.updatedAt || d.createdAt)
      .filter(Boolean)
      .sort();
    if (pending[0]) oldestApprovalAge = ageSeconds(pending[0]);
    pendingApprovals = pending.length;
  } catch {
    // ignore
  }

  let pingMs: number | null = null;
  let dbError: string | null = null;
  if (isDatabaseConfigured()) {
    const started = Date.now();
    try {
      await pool.query('SELECT 1');
      pingMs = Date.now() - started;
    } catch (err) {
      dbError = err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160);
    }
  }

  const funnel = workspaceId ? buildFunnelReport(workspaceId) : null;
  const counters = getOutreachCounters();
  const alerts: OutreachObservabilitySnapshot['alerts'] = [];

  if (scheduler && Number(scheduler.deadLetterCount ?? 0) > 0) {
    alerts.push({
      id: 'scheduler_dead_letters',
      severity: 'warn',
      message: `${scheduler.deadLetterCount} dead-letter due jobs`,
    });
  }
  if (scheduler && Number(scheduler.oldestDueAgeSeconds ?? 0) > 3600) {
    alerts.push({
      id: 'scheduler_stale_due',
      severity: 'error',
      message: `Oldest due job age ${scheduler.oldestDueAgeSeconds}s`,
    });
  }
  if (scheduler && Number(scheduler.heartbeatAgeSeconds ?? 0) > 900) {
    alerts.push({
      id: 'scheduler_heartbeat_stale',
      severity: 'error',
      message: `Scheduler heartbeat age ${scheduler.heartbeatAgeSeconds}s`,
    });
  }
  if (openGaps > 0) {
    alerts.push({
      id: 'reconcile_gaps',
      severity: 'warn',
      message: `${openGaps} open delivery reconcile gaps`,
    });
  }
  if (counters.webhookSignatureFailures > 0) {
    alerts.push({
      id: 'webhook_signature_failures',
      severity: 'error',
      message: `${counters.webhookSignatureFailures} webhook signature failures this process`,
    });
  }
  if (ambiguousOpenReviews > 0) {
    alerts.push({
      id: 'ambiguous_replies',
      severity: 'info',
      message: `${ambiguousOpenReviews} ambiguous open reply reviews`,
    });
  }
  if (dbError) {
    alerts.push({ id: 'database_error', severity: 'error', message: dbError });
  }

  return {
    at: new Date().toISOString(),
    testMode: getOutreachTestModeStatus(workspaceId),
    scheduler,
    approvals: {
      pending: pendingApprovals,
      oldestAgeSeconds: oldestApprovalAge,
    },
    deliveries: deliveryStats,
    mailbox: {
      unmatchedOpenReviews,
      ambiguousOpenReviews,
    },
    reconcile: { openGaps },
    provider: {
      counters,
      recentEventLagSeconds,
    },
    funnel,
    database: {
      configured: isDatabaseConfigured(),
      pingMs,
      error: dbError,
    },
    alerts,
  };
}
