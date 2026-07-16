import { Cron } from 'croner';
import { expireTimedOutSocialApprovals } from './social-approval-store.js';
import { pool } from '../../memory/db.js';
import { reportAivaScoutEvent } from '../../security/scout-event-queue.js';

let timeoutCron: Cron | null = null;

export function startSocialApprovalTimeoutScheduler(): void {
  if (timeoutCron) return;
  timeoutCron = new Cron('*/10 * * * *', () => {
    void expireTimedOutSocialApprovals().then(async (ids) => {
      if (ids.length === 0) return;
      console.log(`[social-approvals] Timed out ${ids.length} pending approval(s)`);
      for (const approvalId of ids) {
        const row = await pool.query(
          'SELECT workspace_id, worker_id, channel FROM worker_social_approvals WHERE id = $1',
          [approvalId],
        );
        const record = row.rows[0] as { workspace_id?: string; worker_id?: string; channel?: string } | undefined;
        if (!record?.workspace_id || !record.worker_id) continue;
        await reportAivaScoutEvent({
          workspaceId: String(record.workspace_id),
          workerId: String(record.worker_id),
          eventType: 'social_approval_timeout',
          description: `Social draft expired on ${String(record.channel ?? 'social')}`,
          metadata: { approvalId },
        });
      }
    });
  });
}

export function stopSocialApprovalTimeoutScheduler(): void {
  timeoutCron?.stop();
  timeoutCron = null;
}
