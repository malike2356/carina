import { Cron } from 'croner';
import { expireTimedOutApprovals } from './worker-approval-store.js';

let timeoutCron: Cron | null = null;

export function startEmailApprovalTimeoutScheduler(): void {
  if (timeoutCron) return;
  timeoutCron = new Cron('*/10 * * * *', () => {
    void expireTimedOutApprovals().then((n) => {
      if (n > 0) console.log(`[email-approvals] Timed out ${n} pending approval(s)`);
    });
  });
}

export function stopEmailApprovalTimeoutScheduler(): void {
  timeoutCron?.stop();
  timeoutCron = null;
}
