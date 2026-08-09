/**
 * Thin timers: discover Gmail-enabled workers and poll for outreach replies.
 */

import { listOutreachWorkspaceIdsAsync } from '../store.js';
import { listWorkers } from '../../workers/worker-store.js';
import { workerHasToolGrant } from '../../workers/aiva-parity-store.js';
import { isDatabaseConfigured } from '../../config/database-url.js';
import { ensureMailboxInboundSchema } from './persist.js';
import { pollGmailMailboxForOutreach } from './gmail-poller.js';

let pollTimer: ReturnType<typeof setInterval> | null = null;
let started = false;

const POLL_MS = Number(process.env.CARINA_OUTREACH_MAILBOX_POLL_MS || 120_000);

export function isMailboxReplyIngestEnabled(): boolean {
  const raw = (process.env.CARINA_OUTREACH_MAILBOX_INGEST || '').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'off') return false;
  if (raw === 'true' || raw === '1' || raw === 'on') return true;
  return isDatabaseConfigured();
}

export async function tickMailboxReplyIngest(): Promise<{
  workspaces: number;
  mailboxes: number;
  ingested: number;
  duplicates: number;
  errors: number;
}> {
  if (!isMailboxReplyIngestEnabled()) {
    return { workspaces: 0, mailboxes: 0, ingested: 0, duplicates: 0, errors: 0 };
  }
  await ensureMailboxInboundSchema();
  const workspaceIds = await listOutreachWorkspaceIdsAsync();
  let mailboxes = 0;
  let ingested = 0;
  let duplicates = 0;
  let errors = 0;

  for (const workspaceId of workspaceIds) {
    let workers;
    try {
      workers = await listWorkers(workspaceId);
    } catch {
      continue;
    }
    for (const worker of workers) {
      if (worker.status === 'dismissed') continue;
      const hasGmail = await workerHasToolGrant(workspaceId, worker.id, 'gmail').catch(() => false);
      if (!hasGmail) continue;
      mailboxes += 1;
      try {
        const result = await pollGmailMailboxForOutreach({
          workspaceId,
          workerId: worker.id,
        });
        ingested += result.ingested;
        duplicates += result.duplicates;
        if (!result.ok) errors += 1;
      } catch (err) {
        errors += 1;
        console.warn(`[outreach-mailbox] poll failed ${workspaceId}/${worker.id}:`, err);
      }
    }
  }

  return { workspaces: workspaceIds.length, mailboxes, ingested, duplicates, errors };
}

export function startMailboxReplyIngestEngine(): void {
  if (started || !isMailboxReplyIngestEnabled()) return;
  started = true;
  void tickMailboxReplyIngest()
    .then((summary) => {
      if (summary.ingested > 0 || summary.errors > 0) {
        console.log(
          `[outreach-mailbox] boot mailboxes=${summary.mailboxes} ingested=${summary.ingested} dup=${summary.duplicates} errors=${summary.errors}`,
        );
      }
    })
    .catch((err) => console.warn('[outreach-mailbox] boot failed:', err));

  pollTimer = setInterval(() => {
    void tickMailboxReplyIngest()
      .then((summary) => {
        if (summary.ingested > 0 || summary.duplicates > 0 || summary.errors > 0) {
          console.log(
            `[outreach-mailbox] tick mailboxes=${summary.mailboxes} ingested=${summary.ingested} dup=${summary.duplicates} errors=${summary.errors}`,
          );
        }
      })
      .catch((err) => console.warn('[outreach-mailbox] tick failed:', err));
  }, Math.max(60_000, POLL_MS));
}

export function stopMailboxReplyIngestEngine(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  started = false;
}
