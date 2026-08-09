/**
 * Gmail incremental sync for outreach reply ingestion.
 * Uses history.list when a cursor exists; falls back to recent inbox query on expiry.
 */

import { invokeProductTool } from '../../workers/product-tools/invoke.js';
import { workerHasToolGrant } from '../../workers/aiva-parity-store.js';
import { ingestRawInbound } from './ingest.js';
import { getMailboxCursor, upsertMailboxCursor } from './persist.js';

function headerMap(payload: Record<string, unknown> | undefined): Record<string, string> {
  const headers = Array.isArray((payload as { headers?: unknown })?.headers)
    ? (payload as { headers: Array<{ name?: string; value?: string }> }).headers
    : [];
  const out: Record<string, string> = {};
  for (const h of headers) {
    const name = String(h.name ?? '').toLowerCase();
    if (!name) continue;
    out[name] = String(h.value ?? '');
  }
  return out;
}

function decodeBodyData(data: string | undefined): string {
  if (!data) return '';
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function extractTextBody(payload: Record<string, unknown> | undefined): string {
  if (!payload) return '';
  const mime = String(payload.mimeType ?? '');
  const bodyData = (payload.body as { data?: string } | undefined)?.data;
  if (mime.startsWith('text/plain') && bodyData) return decodeBodyData(bodyData);
  const parts = Array.isArray(payload.parts) ? payload.parts as Array<Record<string, unknown>> : [];
  for (const part of parts) {
    const text = extractTextBody(part);
    if (text.trim()) return text;
  }
  if (bodyData) return decodeBodyData(bodyData);
  return '';
}

function isInboundCandidate(headers: Record<string, string>, labelIds: string[]): boolean {
  if (labelIds.includes('SENT') && !labelIds.includes('INBOX')) return false;
  const from = (headers.from ?? '').toLowerCase();
  if (!from) return false;
  return true;
}

async function fetchAndIngestMessage(input: {
  workspaceId: string;
  workerId: string;
  messageId: string;
}): Promise<'ingested' | 'skipped' | 'duplicate' | 'error'> {
  const got = await invokeProductTool({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    slug: 'gmail',
    action: 'get',
    input: { id: input.messageId },
  });
  if (!got.ok || !got.data || typeof got.data !== 'object') return 'error';
  const data = got.data as Record<string, unknown>;
  const payload = (data.payload && typeof data.payload === 'object')
    ? data.payload as Record<string, unknown>
    : undefined;
  const headers = headerMap(payload);
  const labelIds = Array.isArray(data.labelIds) ? data.labelIds.map(String) : [];
  if (!isInboundCandidate(headers, labelIds)) return 'skipped';

  const textBody = extractTextBody(payload) || String(data.snippet ?? '');
  const result = await ingestRawInbound({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    provider: 'gmail',
    providerMessageId: String(data.id ?? input.messageId),
    threadId: typeof data.threadId === 'string' ? data.threadId : undefined,
    inReplyTo: headers['in-reply-to'],
    references: headers.references,
    from: headers.from,
    to: headers.to,
    cc: headers.cc,
    subject: headers.subject || '(no subject)',
    textBody,
    receivedAt: data.internalDate
      ? new Date(Number(data.internalDate)).toISOString()
      : undefined,
  });
  if (result.duplicate) return 'duplicate';
  return 'ingested';
}

export async function pollGmailMailboxForOutreach(input: {
  workspaceId: string;
  workerId: string;
}): Promise<{
  ok: boolean;
  fetched: number;
  ingested: number;
  duplicates: number;
  skipped: number;
  error?: string;
  cursorExpired?: boolean;
}> {
  const allowed = await workerHasToolGrant(input.workspaceId, input.workerId, 'gmail');
  if (!allowed) {
    return { ok: false, fetched: 0, ingested: 0, duplicates: 0, skipped: 0, error: 'no_gmail_grant' };
  }

  const profile = await invokeProductTool({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    slug: 'gmail',
    action: 'profile',
    input: {},
  });
  const profileData = (profile.ok && profile.data && typeof profile.data === 'object')
    ? profile.data as Record<string, unknown>
    : {};
  const latestHistoryId = profileData.historyId != null ? String(profileData.historyId) : null;
  const mailboxIdentity = typeof profileData.emailAddress === 'string'
    ? profileData.emailAddress.toLowerCase()
    : '';

  const cursor = await getMailboxCursor({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    provider: 'gmail',
    mailboxIdentity,
  });

  let messageIds: string[] = [];
  let cursorExpired = false;
  let nextCursor = latestHistoryId;

  if (cursor?.historyCursor) {
    const history = await invokeProductTool({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      slug: 'gmail',
      action: 'history',
      input: { startHistoryId: cursor.historyCursor, maxResults: 50 },
    });
    if (!history.ok) {
      const err = String(history.error ?? '');
      if (/404|410|historyId|expired|not found/i.test(err)) {
        cursorExpired = true;
      } else {
        await upsertMailboxCursor({
          workspaceId: input.workspaceId,
          workerId: input.workerId,
          provider: 'gmail',
          mailboxIdentity,
          lastError: err.slice(0, 500),
          status: 'error',
        });
        return {
          ok: false,
          fetched: 0,
          ingested: 0,
          duplicates: 0,
          skipped: 0,
          error: err.slice(0, 300),
        };
      }
    } else if (history.data && typeof history.data === 'object') {
      const hist = history.data as {
        history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }>;
        historyId?: string | number;
      };
      if (hist.historyId != null) nextCursor = String(hist.historyId);
      for (const row of hist.history ?? []) {
        for (const added of row.messagesAdded ?? []) {
          const id = added.message?.id;
          if (id) messageIds.push(id);
        }
      }
    }
  }

  if (!cursor?.historyCursor || cursorExpired) {
    // Bootstrap / expired cursor: recent inbox messages (7 days).
    const listed = await invokeProductTool({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      slug: 'gmail',
      action: 'list',
      input: { q: 'in:inbox newer_than:7d', maxResults: 40 },
    });
    if (listed.ok && listed.data && typeof listed.data === 'object') {
      const rows = Array.isArray((listed.data as { messages?: unknown[] }).messages)
        ? (listed.data as { messages: Array<{ id?: string }> }).messages
        : [];
      messageIds = rows.map((m) => String(m.id ?? '')).filter(Boolean);
    }
    if (latestHistoryId) nextCursor = latestHistoryId;
  }

  messageIds = [...new Set(messageIds)];
  let ingested = 0;
  let duplicates = 0;
  let skipped = 0;
  for (const messageId of messageIds) {
    const outcome = await fetchAndIngestMessage({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      messageId,
    });
    if (outcome === 'ingested') ingested += 1;
    else if (outcome === 'duplicate') duplicates += 1;
    else if (outcome === 'skipped') skipped += 1;
  }

  await upsertMailboxCursor({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    provider: 'gmail',
    mailboxIdentity,
    historyCursor: nextCursor,
    lastError: null,
    status: 'idle',
    payload: {
      lastFetched: messageIds.length,
      lastIngested: ingested,
      cursorExpired,
    },
  });

  return {
    ok: true,
    fetched: messageIds.length,
    ingested,
    duplicates,
    skipped,
    cursorExpired,
  };
}
