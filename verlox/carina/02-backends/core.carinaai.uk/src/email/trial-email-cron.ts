import { Cron } from 'croner';
import { pool } from '../memory/db.js';
import {
  firstWorkerName,
  sendGracePeriodWarningEmail,
  sendTrialExpiredEmail,
  sendTrialExpiringEmail,
} from './email-triggers.js';
import { aivaAppUrl } from './workspace-contact.js';
import { suspendSubscription, suspendAllExpiredGracePeriods } from '../billing/aiva-billing.js';

let trialStarted = false;
let graceStarted = false;

async function runTrialExpiryEmails(): Promise<void> {
  const expiring = await pool.query(
    `SELECT s.workspace_id,
            c.owner_email AS email,
            c.owner_name AS first_name,
            s.trial_ends_at,
            FLOOR(EXTRACT(EPOCH FROM (s.trial_ends_at - NOW())) / 86400)::int AS days_remaining
     FROM aiva_subscriptions s
     JOIN aiva_workspace_contacts c ON c.workspace_id = s.workspace_id
     WHERE s.status = 'trialing'
       AND s.trial_ends_at IS NOT NULL
       AND FLOOR(EXTRACT(EPOCH FROM (s.trial_ends_at - NOW())) / 86400)::int IN (1, 2, 3)`,
  );

  for (const row of expiring.rows) {
    const workspaceId = String(row.workspace_id);
    const daysRemaining = Number(row.days_remaining);
    const workerName = await firstWorkerName(workspaceId);
    await sendTrialExpiringEmail({
      workspaceId,
      email: String(row.email),
      name: String(row.first_name ?? ''),
      daysRemaining,
      workerName,
      trialEndsAt: new Date(String(row.trial_ends_at)).toISOString(),
    });
  }

  const expired = await pool.query(
    `SELECT s.workspace_id, c.owner_email AS email, c.owner_name AS first_name
     FROM aiva_subscriptions s
     JOIN aiva_workspace_contacts c ON c.workspace_id = s.workspace_id
     WHERE s.status = 'trialing'
       AND s.trial_ends_at IS NOT NULL
       AND s.trial_ends_at < NOW()`,
  );

  for (const row of expired.rows) {
    const workspaceId = String(row.workspace_id);
    const workerName = await firstWorkerName(workspaceId);
    await suspendSubscription(workspaceId, 'trial_expired');
    await sendTrialExpiredEmail({
      workspaceId,
      email: String(row.email),
      name: String(row.first_name ?? ''),
      workerName,
    });
  }

  const graceWarnings = await pool.query(
    `SELECT s.workspace_id, s.grace_period_ends_at, c.owner_email
     FROM aiva_subscriptions s
     JOIN aiva_workspace_contacts c ON c.workspace_id = s.workspace_id
     WHERE s.status = 'past_due'
       AND s.grace_period_ends_at IS NOT NULL
       AND DATE(s.grace_period_ends_at) = DATE(NOW() + INTERVAL '1 day')`,
  );

  for (const row of graceWarnings.rows) {
    const workspaceId = String(row.workspace_id);
    const workerName = await firstWorkerName(workspaceId);
    await sendGracePeriodWarningEmail({
      workspaceId,
      workerName,
      gracePeriodEndsAt: new Date(String(row.grace_period_ends_at)).toISOString(),
      updateUrl: aivaAppUrl('/billing/aiva'),
    });
  }

  const graceExpired = await suspendAllExpiredGracePeriods();
  if (graceExpired > 0) {
    console.log(`[EMAIL CRON] Suspended ${graceExpired} workspace(s) after grace period`);
  }
}

export function startAivaGraceSuspendCron(): void {
  if (graceStarted || process.env.AIVA_EMAIL_CRON_ENABLED === 'false') return;
  graceStarted = true;
  new Cron('15 * * * *', { timezone: 'UTC' }, () => {
    void suspendAllExpiredGracePeriods()
      .then((count) => {
        if (count > 0) console.log(`[GRACE CRON] Suspended ${count} workspace(s) after grace period`);
      })
      .catch((err) => console.error('[GRACE CRON] grace suspend failed:', err));
  });
  console.log('[GRACE CRON] Aiva grace suspend cron scheduled (hourly at :15 UTC)');
}

export function startAivaTrialEmailCron(): void {
  if (trialStarted || process.env.AIVA_EMAIL_CRON_ENABLED === 'false') return;
  trialStarted = true;
  new Cron('0 8 * * *', { timezone: 'UTC' }, () => {
    void runTrialExpiryEmails().catch((err) => {
      console.error('[EMAIL CRON] trial expiry job failed:', err);
    });
  });
  console.log('[EMAIL CRON] Aiva trial email cron scheduled (08:00 UTC daily)');
}
