import { createRequire } from 'node:module';
import type { Response } from 'express';
import { pool } from '../memory/db.js';
import { getSubscription } from '../workers/aiva-subscription-store.js';
import {
  dismissWorker,
  listAutomations,
  listWorkers,
} from '../workers/worker-store.js';
import { getWorkspaceContact } from '../email/workspace-contact.js';
import { sendAccountDeletedEmail } from '../email/email-triggers.js';
import { cancelAivaStripeSubscriptionForWorkspace } from '../billing/aiva-billing-store.js';

const require = createRequire(import.meta.url);
// archiver is CommonJS; @types/archiver default export does not match NodeNext ESM.
const createArchiver = require('archiver') as (format: string, options?: { zlib?: { level?: number } }) => {
  pipe: (destination: NodeJS.WritableStream) => unknown;
  append: (source: string | Buffer, data?: { name?: string }) => void;
  finalize: () => Promise<void>;
  on: (event: 'error', listener: (err: Error) => void) => void;
};

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function streamWorkspaceExportZip(workspaceId: string, res: Response): Promise<void> {
  const [workers, contact, sub] = await Promise.all([
    listWorkers(workspaceId),
    getWorkspaceContact(workspaceId),
    getSubscription(workspaceId),
  ]);

  const workerIds = workers.map((w) => w.id);
  const automationsByWorker = await Promise.all(
    workers.map(async (worker) => {
      const automations = await listAutomations(worker.id);
      return automations.map((auto) => ({
        workerName: worker.name,
        name: auto.name,
        scheduleLabel: auto.scheduleLabel,
        enabled: auto.enabled,
        lastRunAt: auto.lastRunAt?.toISOString() ?? null,
      }));
    }),
  );

  const activityResult =
    workerIds.length > 0
      ? await pool.query(
          `SELECT w.name AS aiva_name, a.action_type, a.input_text, a.output_text, a.created_at, a.attestation_tx
           FROM ai_worker_activity a
           JOIN ai_workers w ON w.id = a.worker_id
           WHERE w.workspace_id = $1
             AND a.action_type IN ('message_received', 'message_sent', 'va_reply', 'automation_run')
           ORDER BY a.created_at ASC`,
          [workspaceId],
        )
      : { rows: [] };

  const account = {
    workspaceId,
    ownerEmail: contact?.ownerEmail ?? '',
    ownerName: contact?.ownerName ?? '',
    planTier: sub?.planTier ?? 'trial',
    status: sub?.status ?? 'trialing',
  };

  const aivas = workers.map((worker) => ({
    id: worker.id,
    name: worker.name,
    role: worker.roleDescription,
    status: worker.status,
    createdAt: worker.createdAt.toISOString(),
    channels: worker.channels,
  }));

  const conversationLines = [
    'aiva_name,action_type,content,timestamp,attestation_tx',
    ...activityResult.rows.map((row) => {
      const role = String(row.action_type);
      const content = String(row.output_text ?? row.input_text ?? '');
      return [
        csvEscape(String(row.aiva_name)),
        csvEscape(role),
        csvEscape(content),
        csvEscape(new Date(String(row.created_at)).toISOString()),
        csvEscape(String(row.attestation_tx ?? '')),
      ].join(',');
    }),
  ];

  const invoiceLines = 'date,amount,status,plan,invoice_id\n';

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="carina-export.zip"');

  const archive = createArchiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err: Error) => {
    throw err;
  });
  archive.pipe(res);

  archive.append(JSON.stringify(account, null, 2), { name: 'account.json' });
  archive.append(JSON.stringify(aivas, null, 2), { name: 'aivas.json' });
  archive.append(JSON.stringify(automationsByWorker.flat(), null, 2), { name: 'automations.json' });
  archive.append(conversationLines.join('\n'), { name: 'conversations.csv' });
  archive.append(invoiceLines, { name: 'invoices.csv' });

  await archive.finalize();
}

export async function eraseWorkspaceData(workspaceId: string): Promise<void> {
  const contact = await getWorkspaceContact(workspaceId);

  await cancelAivaStripeSubscriptionForWorkspace(workspaceId);

  if (contact?.ownerEmail) {
    await sendAccountDeletedEmail({
      workspaceId,
      email: contact.ownerEmail,
      name: contact.ownerName,
    });
  }

  const workers = await listWorkers(workspaceId);
  for (const worker of workers) {
    if (worker.status !== 'dismissed') {
      await dismissWorker(workspaceId, worker.id);
    }
  }

  await pool.query(
    `UPDATE ai_worker_activity
     SET input_text = NULL, output_text = NULL, pii_erased_at = NOW()
     WHERE worker_id IN (SELECT id FROM ai_workers WHERE workspace_id = $1)`,
    [workspaceId],
  );

  await pool.query(
    `UPDATE aiva_workspace_contacts
     SET owner_email = '', owner_name = '', deleted_at = NOW(), updated_at = NOW()
     WHERE workspace_id = $1`,
    [workspaceId],
  );

  await pool.query(
    `INSERT INTO pending_workspace_deletions (workspace_id, delete_after)
     VALUES ($1, NOW() + INTERVAL '30 days')
     ON CONFLICT (workspace_id) DO UPDATE SET delete_after = EXCLUDED.delete_after`,
    [workspaceId],
  );
}

export async function runPendingWorkspaceHardDeletes(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM pending_workspace_deletions
     WHERE delete_after < NOW()
     RETURNING workspace_id`,
  );
  const workspaceIds = result.rows.map((row) => String(row.workspace_id));
  for (const workspaceId of workspaceIds) {
    await pool.query('DELETE FROM aiva_workspace_contacts WHERE workspace_id = $1', [workspaceId]);
    await pool.query('DELETE FROM aiva_subscriptions WHERE workspace_id = $1', [workspaceId]);
    await pool.query('DELETE FROM ai_workers WHERE workspace_id = $1', [workspaceId]);
  }
  return workspaceIds.length;
}
