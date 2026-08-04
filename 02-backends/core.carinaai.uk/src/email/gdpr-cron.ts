import { Cron } from 'croner';
import { runPendingWorkspaceHardDeletes } from '../workers/workspace-gdpr.js';

let started = false;

export function startGdprHardDeleteCron(): void {
  if (started || process.env.GDPR_HARD_DELETE_CRON_ENABLED === 'false') return;
  started = true;
  new Cron('15 4 * * *', { timezone: 'UTC' }, () => {
    void runPendingWorkspaceHardDeletes()
      .then((count) => {
        if (count > 0) console.log(`[GDPR CRON] Hard-deleted ${count} workspace(s)`);
      })
      .catch((err) => console.error('[GDPR CRON] hard delete failed:', err));
  });
  console.log('[GDPR CRON] Workspace hard-delete cron scheduled (04:15 UTC daily)');
}
