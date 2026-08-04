import { pool } from '../memory/db.js';
import {
  firstWorkerName,
  sendSubscriptionReactivatedEmail,
  sendSubscriptionSuspendedEmail,
} from '../email/email-triggers.js';
import { aivaAppUrl } from '../email/workspace-contact.js';
import { pauseWorker, listWorkers, resumeWorker } from '../workers/worker-store.js';

export function gracePeriodDays(): number {
  const raw = process.env.AIVA_GRACE_PERIOD_DAYS;
  const parsed = raw ? Number(raw) : 7;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

export function gracePeriodEndsAt(from = new Date()): Date {
  return new Date(from.getTime() + gracePeriodDays() * 86_400_000);
}

export async function suspendIfGraceExpired(workspaceId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT status, grace_period_ends_at FROM aiva_subscriptions WHERE workspace_id = $1`,
    [workspaceId],
  );
  const row = result.rows[0] as { status?: string; grace_period_ends_at?: string | Date } | undefined;
  if (!row || row.status !== 'past_due') return false;
  const ends = row.grace_period_ends_at ? new Date(String(row.grace_period_ends_at)) : null;
  if (!ends || ends.getTime() > Date.now()) return false;
  await suspendSubscription(workspaceId, 'payment');
  return true;
}

export async function suspendAllExpiredGracePeriods(): Promise<number> {
  const graceExpired = await pool.query(
    `SELECT workspace_id FROM aiva_subscriptions
     WHERE status = 'past_due'
       AND grace_period_ends_at IS NOT NULL
       AND grace_period_ends_at < NOW()`,
  );
  for (const row of graceExpired.rows) {
    await suspendSubscription(String(row.workspace_id), 'payment');
  }
  return graceExpired.rows.length;
}

export async function markSubscriptionPastDue(
  workspaceId: string,
  endsAt?: Date,
): Promise<void> {
  const ends = endsAt ?? gracePeriodEndsAt();
  await pool.query(
    `UPDATE aiva_subscriptions
     SET status = 'past_due', grace_period_ends_at = $2, payment_failed_at = NOW(), updated_at = NOW()
     WHERE workspace_id = $1`,
    [workspaceId, ends],
  );
}

export async function suspendSubscription(
  workspaceId: string,
  reason: 'payment' | 'trial_expired' = 'payment',
): Promise<void> {
  await pool.query(
    `UPDATE aiva_subscriptions
     SET status = 'suspended', updated_at = NOW()
     WHERE workspace_id = $1`,
    [workspaceId],
  );

  const workers = await listWorkers(workspaceId);
  for (const worker of workers) {
    if (worker.status === 'active') {
      await pauseWorker(workspaceId, worker.id);
    }
  }

  if (reason === 'payment') {
    const workerName = await firstWorkerName(workspaceId);
    await sendSubscriptionSuspendedEmail({
      workspaceId,
      workerName,
      reactivateUrl: aivaAppUrl('/billing/aiva'),
    });
  }
}

export async function reactivateSubscription(workspaceId: string): Promise<void> {
  await pool.query(
    `UPDATE aiva_subscriptions
     SET status = 'active', grace_period_ends_at = NULL, payment_failed_at = NULL, updated_at = NOW()
     WHERE workspace_id = $1`,
    [workspaceId],
  );

  const workers = await listWorkers(workspaceId);
  for (const worker of workers) {
    if (worker.status === 'paused') {
      await resumeWorker(workspaceId, worker.id);
    }
  }

  const workerName = await firstWorkerName(workspaceId);
  const first = workers.find((w) => w.status !== 'dismissed');
  await sendSubscriptionReactivatedEmail({
    workspaceId,
    workerName,
    workerId: first?.id,
  });
}
