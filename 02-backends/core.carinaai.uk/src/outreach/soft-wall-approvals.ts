/**
 * Soft Wall bridge: sequence `pending_approval` deliveries become Approvals inbox rows.
 * Does not send mail. Owner releases sends from /aiva/approvals.
 */

import { createEmailApproval } from '../ingestion/email/worker-approval-store.js';
import { listWorkers } from '../workers/worker-store.js';
import { getOutreachAlertTarget } from './alerts.js';
import { getLead } from './leads.js';
import { markDeliveryStatus } from './sequence-engine.js';
import { loadOutreachStore } from './store.js';
import type { DeliveryEvent } from './types.js';

export async function resolveOutreachWorkerId(
  workspaceId: string,
  preferredWorkerId?: string,
): Promise<string | null> {
  const preferred = preferredWorkerId?.trim();
  if (preferred) {
    const workers = await listWorkers(workspaceId);
    if (workers.some((w) => w.id === preferred && w.status !== 'dismissed')) {
      return preferred;
    }
  }

  const alert = getOutreachAlertTarget(workspaceId);
  if (alert.workerId?.trim()) {
    const workers = await listWorkers(workspaceId);
    if (workers.some((w) => w.id === alert.workerId && w.status !== 'dismissed')) {
      return alert.workerId;
    }
  }

  const workers = await listWorkers(workspaceId);
  const active = workers.find((w) => w.status === 'active') ?? workers[0];
  return active?.id ?? null;
}

export function findDeliveryByApprovalId(
  workspaceId: string,
  approvalId: string,
): DeliveryEvent | null {
  const id = approvalId.trim();
  if (!id) return null;
  return (
    loadOutreachStore().deliveries.find(
      (d) => d.workspaceId === workspaceId && d.approvalId === id,
    ) ?? null
  );
}

/** Attach Soft Wall email approvals for deliveries that still lack approvalId. */
export async function bridgeDeliveriesToEmailApprovals(
  workspaceId: string,
  deliveries: DeliveryEvent[],
  workerIdHint?: string,
): Promise<{ bridged: number; skipped: number; errors: string[] }> {
  const workerId = await resolveOutreachWorkerId(workspaceId, workerIdHint);
  if (!workerId) {
    return {
      bridged: 0,
      skipped: deliveries.length,
      errors: ['No active worker in workspace to own Soft Wall approvals'],
    };
  }

  let bridged = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const delivery of deliveries) {
    if (delivery.workspaceId !== workspaceId) {
      skipped += 1;
      continue;
    }
    if (delivery.status !== 'pending_approval') {
      skipped += 1;
      continue;
    }
    if (delivery.approvalId) {
      skipped += 1;
      continue;
    }
    if (delivery.channel !== 'email') {
      skipped += 1;
      continue;
    }

    const lead = getLead(workspaceId, delivery.leadId);
    const recipient = lead?.email?.trim();
    if (!recipient) {
      skipped += 1;
      errors.push(`delivery ${delivery.id}: missing lead email`);
      continue;
    }

    try {
      const approval = await createEmailApproval({
        workerId,
        workspaceId,
        category: 'other',
        recipient,
        subject: delivery.subject || '(no subject)',
        draftBody: delivery.body || '',
        originalFrom: recipient,
      });
      markDeliveryStatus(workspaceId, delivery.id, 'pending_approval', {
        approvalId: approval.id,
      });
      bridged += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`delivery ${delivery.id}: ${message}`);
      skipped += 1;
    }
  }

  return { bridged, skipped, errors };
}

/** Bridge any workspace deliveries stuck as pending_approval without approvalId. */
export async function bridgePendingOutreachApprovals(
  workspaceId: string,
  workerIdHint?: string,
): Promise<{ bridged: number; skipped: number; errors: string[] }> {
  const pending = loadOutreachStore().deliveries.filter(
    (d) =>
      d.workspaceId === workspaceId
      && d.status === 'pending_approval'
      && !d.approvalId
      && d.channel === 'email',
  );
  return bridgeDeliveriesToEmailApprovals(workspaceId, pending, workerIdHint);
}

export function markOutreachDeliveryFromApproval(input: {
  workspaceId: string;
  approvalId: string;
  status: 'sent' | 'failed' | 'skipped';
  lastError?: string;
  providerMessageId?: string;
  providerThreadId?: string;
  rfcMessageId?: string;
  provider?: string;
  mailboxIdentity?: string;
}): DeliveryEvent | null {
  const delivery = findDeliveryByApprovalId(input.workspaceId, input.approvalId);
  if (!delivery) return null;
  return markDeliveryStatus(input.workspaceId, delivery.id, input.status, {
    approvalId: input.approvalId,
    lastError: input.lastError,
    providerMessageId: input.providerMessageId,
    providerThreadId: input.providerThreadId,
    rfcMessageId: input.rfcMessageId,
    provider: input.provider,
    mailboxIdentity: input.mailboxIdentity,
    force: true,
  });
}

/** Queue due sequence steps and bridge Soft Wall drafts into /aiva/approvals. */
export async function processDueSendsWithSoftWall(
  workspaceId: string,
  now: Date = new Date(),
  workerIdHint?: string,
): Promise<{
  processed: DeliveryEvent[];
  skipped: Array<{ enrollmentId: string; reason: string }>;
  softWall: { bridged: number; skipped: number; errors: string[] };
}> {
  const { processDueSends } = await import('./sequence-engine.js');
  const result = processDueSends(workspaceId, now);
  const softWall = await bridgeDeliveriesToEmailApprovals(
    workspaceId,
    result.processed,
    workerIdHint,
  );
  // Catch any older pending drafts that never got an Approvals row.
  const backfill = await bridgePendingOutreachApprovals(workspaceId, workerIdHint);
  return {
    ...result,
    softWall: {
      bridged: softWall.bridged + backfill.bridged,
      skipped: softWall.skipped + backfill.skipped,
      errors: [...softWall.errors, ...backfill.errors],
    },
  };
}
