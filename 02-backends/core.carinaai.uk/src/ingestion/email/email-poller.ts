import {
  digestExists,
  getEmailConnection,
  listPollableConnections,
  listSenders,
  saveDigest,
  updateLastPollAt,
} from './email-connection-store.js';
import { fetchUnseenFromSenders, markMessagesSeen } from './imap-connector.js';
import { parseEmailDigest } from './email-parser.js';
import { categorizeEmail, categoryLabel } from './email-categorizer.js';
import { createDraftApprovalForEmail } from './email-draft-handler.js';
import { resolveWorkerImapAuth } from './email-imap-auth.js';
import { isEmailIngestionActive, isEmailIngestionEnabledForWorkspace, isPropreneurBridgeEnabled } from '../../workers/aiva-feature-flags.js';
import { getWorkerById, logActivity } from '../../workers/worker-store.js';
import { Cron } from 'croner';

export interface PollWorkerResult {
  workerId: string;
  fetched: number;
  processed: number;
  skipped: number;
  markedSeen: number;
  error?: string;
}

import { emailPollCronExpression, emailPollLimit } from './email-poll-config.js';

function buildSenderRoleMap(senders: Array<{ emailAddress: string; roleTag: string }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const sender of senders) {
    map.set(sender.emailAddress.trim().toLowerCase(), sender.roleTag);
  }
  return map;
}

function resolveRoleTag(fromAddress: string, roleMap: Map<string, string>): string | null {
  const from = fromAddress.trim().toLowerCase();
  if (roleMap.has(from)) return roleMap.get(from) ?? null;
  const domain = from.includes('@') ? `@${from.split('@')[1]}` : '';
  if (domain && roleMap.has(domain)) return roleMap.get(domain) ?? null;
  return null;
}

export async function isWorkerBlockedFromCarinaImapPoll(workerId: string): Promise<boolean> {
  if (!isPropreneurBridgeEnabled()) return false;
  const worker = await getWorkerById(workerId);
  return Boolean(worker?.propreneurTenantSlug);
}

export async function pollWorkerInbox(workerId: string): Promise<PollWorkerResult> {
  const result: PollWorkerResult = {
    workerId,
    fetched: 0,
    processed: 0,
    skipped: 0,
    markedSeen: 0,
  };

  if (await isWorkerBlockedFromCarinaImapPoll(workerId)) {
    result.error = 'Propreneur owns email ingestion for this Aiva; Carina IMAP poll skipped';
    return result;
  }

  const connection = await getEmailConnection(workerId);
  if (!connection) {
    result.error = 'No email connection';
    return result;
  }

  const imapAuth = await resolveWorkerImapAuth(workerId, connection);
  if (!imapAuth) {
    result.error = 'Missing IMAP credentials';
    await updateLastPollAt(workerId, 'error').catch(() => {});
    return result;
  }

  const worker = await getWorkerById(workerId);
  if (!worker) {
    result.error = 'Worker not found';
    return result;
  }

  const senders = await listSenders(connection.id);
  if (senders.length === 0) {
    result.error = 'No senders configured';
    await updateLastPollAt(workerId, 'connected').catch(() => {});
    return result;
  }

  const allowedSenders = senders.map((s) => s.emailAddress);
  const roleMap = buildSenderRoleMap(senders);

  let messages;
  try {
    messages = await fetchUnseenFromSenders(imapAuth, allowedSenders, emailPollLimit());
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    await updateLastPollAt(workerId, 'error').catch(() => {});
    return result;
  }

  result.fetched = messages.length;
  const seenUids: number[] = [];

  for (const msg of messages) {
    if (await digestExists(workerId, msg.messageId)) {
      result.skipped += 1;
      seenUids.push(msg.uid);
      continue;
    }

    const roleTag = resolveRoleTag(msg.fromAddress, roleMap);
    const digest = parseEmailDigest({
      from: msg.fromAddress,
      subject: msg.subject,
      body: msg.bodyText,
      roleTag,
    });

    try {
      const category = categorizeEmail({
        from: msg.fromAddress,
        subject: msg.subject,
        body: msg.bodyText,
        roleTag,
      });
      const digestId = await saveDigest(
        workerId,
        msg.messageId,
        msg.fromAddress,
        roleTag,
        digest,
        category,
      );
      result.processed += 1;
      seenUids.push(msg.uid);
      void logActivity(workerId, {
        actionType: 'automation_run',
        summary: `Email received (${categoryLabel(category)}): ${msg.subject || msg.fromAddress}`,
        inputText: digest.summary,
        escalated: false,
        channel: 'email',
      }).catch(() => {});

      void createDraftApprovalForEmail({
        workerId,
        workspaceId: worker.workspaceId,
        digestId,
        messageId: msg.messageId,
        from: msg.fromAddress,
        subject: msg.subject,
        body: msg.bodyText,
        category,
      }).catch((draftErr) => {
        const message = draftErr instanceof Error ? draftErr.message : String(draftErr);
        console.warn(`[email-poller] draft approval skipped for ${workerId}: ${message}`);
      });

      const { onWorkerInboundEvent } = await import('../../workers/worker-playbook-triggers.js');
      void onWorkerInboundEvent(workerId, {
        type: 'email_received',
        payload: {
          subject: msg.subject,
          from: msg.fromAddress,
          body_preview: digest.summary,
          category,
        },
      }).catch((triggerErr) => {
        const message = triggerErr instanceof Error ? triggerErr.message : String(triggerErr);
        console.warn(`[email-poller] playbook trigger skipped for ${workerId}: ${message}`);
      });
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }
  }

  if (seenUids.length > 0) {
    try {
      await markMessagesSeen(imapAuth, seenUids);
      result.markedSeen = seenUids.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.error = result.error ? `${result.error}; mark seen failed: ${message}` : `mark seen failed: ${message}`;
    }
  }

  await updateLastPollAt(workerId, result.error ? 'error' : 'polling');
  return result;
}

export async function pollAllWorkerInboxes(): Promise<PollWorkerResult[]> {
  if (!isEmailIngestionActive()) return [];

  const connections = await listPollableConnections();
  const results: PollWorkerResult[] = [];
  for (const connection of connections) {
    try {
      const worker = await getWorkerById(connection.workerId);
      if (!worker || !isEmailIngestionEnabledForWorkspace(worker.workspaceId)) {
        continue;
      }
      results.push(await pollWorkerInbox(connection.workerId));
    } catch (err) {
      results.push({
        workerId: connection.workerId,
        fetched: 0,
        processed: 0,
        skipped: 0,
        markedSeen: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

let pollCron: Cron | null = null;

export { emailPollCronExpression } from './email-poll-config.js';

export function startEmailIngestionPoller(): void {
  if (!isEmailIngestionActive()) return;
  if (pollCron) return;

  const expression = emailPollCronExpression();
  pollCron = new Cron(expression, { timezone: 'Europe/London' }, () => {
    void pollAllWorkerInboxes().then((results) => {
      const processed = results.reduce((sum, r) => sum + r.processed, 0);
      if (processed > 0) {
        console.log(`[email-poller] Processed ${processed} message(s) across ${results.length} connection(s)`);
      }
    }).catch((err) => {
      console.error('[email-poller] poll cycle failed:', err);
    });
  });
  console.log(`[email-poller] Scheduled IMAP poll (${expression})`);
}

export function stopEmailIngestionPoller(): void {
  pollCron?.stop();
  pollCron = null;
}
