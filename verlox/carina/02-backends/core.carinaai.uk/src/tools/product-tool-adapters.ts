import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { listToolGrants } from '../workers/spinnable-parity-store.js';
import { invokeProductTool } from '../workers/product-tools/invoke.js';
import { registerSessionTool } from './session-tool-store.js';

type HeaderMap = Record<string, string>;

function headersFromGmailPayload(payload: unknown): HeaderMap {
  const headers: HeaderMap = {};
  if (!payload || typeof payload !== 'object') return headers;
  const list = (payload as { headers?: Array<{ name?: string; value?: string }> }).headers;
  if (!Array.isArray(list)) return headers;
  for (const item of list) {
    const name = String(item?.name ?? '').trim().toLowerCase();
    const value = String(item?.value ?? '').trim();
    if (name && value) headers[name] = value;
  }
  return headers;
}

function snippetFromGmailMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const snippet = (data as { snippet?: string }).snippet;
  return typeof snippet === 'string' ? snippet : '';
}

function decodeBodyText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const payload = (data as { payload?: unknown }).payload;
  const parts: unknown[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const obj = node as {
      mimeType?: string;
      body?: { data?: string };
      parts?: unknown[];
    };
    if (obj.body?.data && (obj.mimeType === 'text/plain' || !obj.parts?.length)) {
      parts.push(obj);
    }
    if (Array.isArray(obj.parts)) {
      for (const child of obj.parts) walk(child);
    }
  };
  walk(payload);
  for (const part of parts) {
    const mime = String((part as { mimeType?: string }).mimeType ?? '');
    const raw = String((part as { body?: { data?: string } }).body?.data ?? '');
    if (!raw) continue;
    if (mime && mime !== 'text/plain' && mime !== 'text/html') continue;
    try {
      const text = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
      if (mime === 'text/plain' || !mime) return text.slice(0, 8000);
    } catch {
      /* ignore decode errors */
    }
  }
  return snippetFromGmailMessage(data);
}

async function invokeGranted(
  sessionId: string,
  slug: string,
  action: string,
  input?: Record<string, unknown>,
): Promise<unknown> {
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx) {
    return { ok: false, error: 'No worker session context; product tools are only available in Aiva worker chat.' };
  }
  const result = await invokeProductTool({
    workspaceId: ctx.worker.workspaceId,
    workerId: ctx.worker.id,
    slug,
    action,
    input,
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? 'Product tool call failed' };
  }
  return { ok: true, data: result.data };
}

function createGmailTools(sessionId: string): Tool[] {
  return [
    {
      name: 'gmail-list',
      description:
        'List recent Gmail messages for this worker (connected Google Gmail). '
        + 'Use this for "read my last N emails", inbox checks, or searching mail. '
        + 'For the Aiva Email page sync store (origin tags, drafts), prefer workspace-email-list. '
        + 'Do NOT use email-list for Gmail; that tool only lists Resend webhook mail.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Max messages to return (1-10). Default 5.',
          },
          q: {
            type: 'string',
            description: 'Optional Gmail search query (e.g. "from:alice newer_than:7d").',
          },
        },
      },
      execute: async (params) => {
        const limit = Math.min(10, Math.max(1, Number(params.limit ?? 5)));
        const q = typeof params.q === 'string' ? params.q.trim() : '';
        const listed = await invokeGranted(sessionId, 'gmail', 'list', {
          q: q || undefined,
          maxResults: limit,
        });
        if (!listed || typeof listed !== 'object' || !(listed as { ok?: boolean }).ok) {
          return listed;
        }
        const data = (listed as { data?: { messages?: Array<{ id?: string }> } }).data;
        const ids = (data?.messages ?? []).map((m) => String(m.id ?? '')).filter(Boolean).slice(0, limit);
        const messages: Array<Record<string, unknown>> = [];
        for (const id of ids) {
          const got = await invokeGranted(sessionId, 'gmail', 'get', { id });
          if (!got || typeof got !== 'object' || !(got as { ok?: boolean }).ok) {
            messages.push({ id, error: (got as { error?: string })?.error ?? 'fetch failed' });
            continue;
          }
          const msg = (got as { data?: unknown }).data;
          const headers = headersFromGmailPayload(
            msg && typeof msg === 'object' ? (msg as { payload?: unknown }).payload : null,
          );
          messages.push({
            id,
            subject: headers.subject ?? '',
            from: headers.from ?? '',
            to: headers.to ?? '',
            date: headers.date ?? '',
            snippet: snippetFromGmailMessage(msg),
          });
        }
        return { ok: true, count: messages.length, messages };
      },
    },
    {
      name: 'gmail-get',
      description:
        'Fetch one Gmail message by id (subject, from, body text). Use after gmail-list. '
        + 'Prefer workspace-email-get for synced Aiva Email page rows.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Gmail message id' },
        },
        required: ['id'],
      },
      execute: async (params) => {
        const id = String(params.id ?? '').trim();
        if (!id) return { ok: false, error: 'id required' };
        const got = await invokeGranted(sessionId, 'gmail', 'get', { id });
        if (!got || typeof got !== 'object' || !(got as { ok?: boolean }).ok) return got;
        const msg = (got as { data?: unknown }).data;
        const headers = headersFromGmailPayload(
          msg && typeof msg === 'object' ? (msg as { payload?: unknown }).payload : null,
        );
        return {
          ok: true,
          id,
          subject: headers.subject ?? '',
          from: headers.from ?? '',
          to: headers.to ?? '',
          date: headers.date ?? '',
          snippet: snippetFromGmailMessage(msg),
          bodyText: decodeBodyText(msg),
        };
      },
    },
    {
      name: 'gmail-send',
      dangerous: true,
      requiresConfirmation: true,
      description:
        'Send an email from this worker\'s connected Gmail account. '
        + 'Prefer this over email-smtp-send / email-send when Gmail is connected. '
        + 'For replies that need owner approval first, use workspace-email-draft-for-approval.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Plain text body' },
        },
        required: ['to', 'subject', 'body'],
      },
      execute: async (params) => {
        const to = String(params.to ?? '').trim();
        const subject = String(params.subject ?? '').trim();
        const body = String(params.body ?? '');
        if (!to || !subject) return { ok: false, error: 'to and subject required' };
        // Logging to Email page happens inside invokeProductTool (gmail send).
        return invokeGranted(sessionId, 'gmail', 'send', { to, subject, body });
      },
    },
    {
      name: 'workspace-email-list',
      description:
        'List emails from the Aiva Email page store (synced Gmail + agent sends + webhook). '
        + 'Use this to answer questions about what is on /email (Inbox, Sent, Aiva vs Google). '
        + 'Prefer this over gmail-list when the user refers to the Email page or synced mail.',
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search subject/body/from/to' },
          status: {
            type: 'string',
            description: 'inbox | sent | archived | spam | draft_reply',
          },
          source: { type: 'string', description: 'aiva | google | local' },
          from: { type: 'string', description: 'Filter by from address substring' },
          to: { type: 'string', description: 'Filter by to address substring' },
          limit: { type: 'number', description: 'Max rows (1-30). Default 10.' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const { listSyncedEmails } = await import('../workers/aiva-synced-email.js');
        return listSyncedEmails({
          workspaceId: ctx.worker.workspaceId,
          q: typeof params.q === 'string' ? params.q : undefined,
          status: typeof params.status === 'string' ? params.status : undefined,
          source: typeof params.source === 'string' ? params.source : undefined,
          from: typeof params.from === 'string' ? params.from : undefined,
          to: typeof params.to === 'string' ? params.to : undefined,
          limit: Number(params.limit ?? 10),
        });
      },
    },
    {
      name: 'workspace-email-get',
      description:
        'Read one synced Email page message by id (full body + draft if any). '
        + 'Use after workspace-email-list to answer detailed questions.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'email_messages id from workspace-email-list' },
        },
        required: ['id'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const id = String(params.id ?? '').trim();
        if (!id) return { ok: false, error: 'id required' };
        const { getSyncedEmail } = await import('../workers/aiva-synced-email.js');
        return getSyncedEmail({ workspaceId: ctx.worker.workspaceId, id });
      },
    },
    {
      name: 'workspace-email-draft-for-approval',
      dangerous: true,
      requiresConfirmation: true,
      description:
        'Draft a reply to a synced Email page message and queue it for owner approval. '
        + 'Does NOT send. Owner must approve in /aiva/approvals. '
        + 'Provide messageId from workspace-email-list/get, or pass to/subject/body for a new reply thread.',
      parameters: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'Synced email_messages id to reply to (preferred).',
          },
          draftBody: {
            type: 'string',
            description: 'Optional draft you already wrote. If omitted, Aiva drafts from the message.',
          },
          to: { type: 'string', description: 'Recipient if not using messageId' },
          subject: { type: 'string', description: 'Subject if not using messageId' },
          body: { type: 'string', description: 'Original message body context if not using messageId' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };

        const messageId = String(params.messageId ?? '').trim();
        let recipient = String(params.to ?? '').trim();
        let subject = String(params.subject ?? '').trim();
        let originalBody = String(params.body ?? '');
        let originalFrom = recipient;
        let draftBody = String(params.draftBody ?? '').trim();

        if (messageId) {
          const { getSyncedEmail } = await import('../workers/aiva-synced-email.js');
          const got = await getSyncedEmail({
            workspaceId: ctx.worker.workspaceId,
            id: messageId,
          });
          if (!got.ok || !got.data || typeof got.data !== 'object') {
            return { ok: false, error: got.error ?? 'Synced message not found' };
          }
          const row = got.data as Record<string, unknown>;
          originalFrom = String(row.fromAddress ?? '');
          recipient = originalFrom;
          subject = String(row.subject ?? '(no subject)');
          originalBody = String(row.bodyFull ?? row.bodyPreview ?? '');
          if (!draftBody && typeof row.aiDraftReply === 'string' && row.aiDraftReply.trim()) {
            draftBody = row.aiDraftReply.trim();
          }
        }

        if (!recipient || !subject) {
          return { ok: false, error: 'messageId or to+subject required' };
        }

        if (!draftBody) {
          const { draftEmailResponse } = await import('../ingestion/email/email-draft-handler.js');
          draftBody = await draftEmailResponse({
            workerId: ctx.worker.id,
            workspaceId: ctx.worker.workspaceId,
            from: originalFrom || recipient,
            subject,
            body: originalBody,
            category: 'client_query',
          });
        }

        const replySubject = /^re:/i.test(subject) ? subject : `Re: ${subject}`;
        const { createEmailApproval } = await import('../ingestion/email/worker-approval-store.js');
        const approval = await createEmailApproval({
          workerId: ctx.worker.id,
          workspaceId: ctx.worker.workspaceId,
          messageId: messageId || undefined,
          category: 'client_query',
          recipient,
          subject: replySubject,
          draftBody,
          originalFrom: originalFrom || recipient,
        });

        return {
          ok: true,
          data: {
            approvalId: approval.id,
            recipient: approval.recipient,
            subject: approval.subject,
            draftPreview: draftBody.slice(0, 500),
            status: 'pending',
            note: 'Queued for owner approval at /aiva/approvals. Not sent yet.',
          },
        };
      },
    },
  ];
}

function createDriveTools(sessionId: string): Tool[] {
  return [
    {
      name: 'google-drive-search',
      description:
        'Search Google Drive / Docs for this worker (connected Drive). '
        + 'Use for BDAG, boreholes, project docs, or any filename/content search. '
        + 'Do NOT use search-files (local disk) or http-request for Drive.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search text (name or full-text). Example: BDAG, boreholes.',
          },
          limit: {
            type: 'number',
            description: 'Max files to return (1-25). Default 10.',
          },
        },
        required: ['query'],
      },
      execute: async (params) => {
        const query = String(params.query ?? '').trim();
        if (!query) return { ok: false, error: 'query required' };
        const limit = Math.min(25, Math.max(1, Number(params.limit ?? 10)));
        return invokeGranted(sessionId, 'google-drive', 'search', { query, pageSize: limit });
      },
    },
    {
      name: 'google-drive-read',
      description:
        'Read a Google Drive file by id (exports Docs/Sheets text when possible). '
        + 'Use after google-drive-search.',
      parameters: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'Drive file id' },
        },
        required: ['fileId'],
      },
      execute: async (params) => {
        const fileId = String(params.fileId ?? params.id ?? '').trim();
        if (!fileId) return { ok: false, error: 'fileId required' };
        const got = await invokeGranted(sessionId, 'google-drive', 'read', { fileId });
        if (!got || typeof got !== 'object' || !(got as { ok?: boolean }).ok) return got;
        const data = (got as { data?: { file?: unknown; text?: string | null } }).data;
        const text = typeof data?.text === 'string' ? data.text.slice(0, 20_000) : data?.text;
        return { ok: true, file: data?.file, text };
      },
    },
  ];
}

function createCalendarTools(sessionId: string): Tool[] {
  return [
    {
      name: 'google-calendar-list',
      description:
        'List upcoming Google Calendar events for this worker (primary calendar). '
        + 'Use for agenda, schedule, "what is on my calendar", or "activities next week". '
        + 'Pass timeMin/timeMax as ISO datetimes to bound the window (e.g. last week of July).',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Max events (1-50). Default 25.',
          },
          timeMin: {
            type: 'string',
            description: 'Optional ISO datetime lower bound (inclusive). Defaults to now.',
          },
          timeMax: {
            type: 'string',
            description: 'Optional ISO datetime upper bound (exclusive).',
          },
        },
      },
      execute: async (params) => {
        const limit = Math.min(50, Math.max(1, Number(params.limit ?? 25)));
        const timeMin = typeof params.timeMin === 'string' ? params.timeMin.trim() : '';
        const timeMax = typeof params.timeMax === 'string' ? params.timeMax.trim() : '';
        const listed = await invokeGranted(sessionId, 'google-calendar', 'list', {
          maxResults: limit,
          timeMin: timeMin || undefined,
          timeMax: timeMax || undefined,
        });
        if (!listed || typeof listed !== 'object' || !(listed as { ok?: boolean }).ok) {
          return listed;
        }
        const data = (listed as { data?: { items?: Array<Record<string, unknown>> } }).data;
        const items = Array.isArray(data?.items) ? data.items : [];
        const events = items.map((item) => {
          const start = item.start as { dateTime?: string; date?: string } | undefined;
          const end = item.end as { dateTime?: string; date?: string } | undefined;
          return {
            id: String(item.id ?? ''),
            summary: String(item.summary ?? '(no title)'),
            start: start?.dateTime ?? start?.date ?? '',
            end: end?.dateTime ?? end?.date ?? '',
            location: typeof item.location === 'string' ? item.location : '',
            status: typeof item.status === 'string' ? item.status : '',
          };
        });
        return { ok: true, count: events.length, events };
      },
    },
    {
      name: 'google-calendar-create',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Create a Google Calendar event on the connected primary calendar.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Event title' },
          start: { type: 'string', description: 'ISO datetime start' },
          end: { type: 'string', description: 'ISO datetime end' },
          description: { type: 'string', description: 'Optional event description' },
        },
        required: ['summary', 'start', 'end'],
      },
      execute: async (params) => {
        const summary = String(params.summary ?? '').trim();
        const start = String(params.start ?? '').trim();
        const end = String(params.end ?? '').trim();
        if (!summary || !start || !end) {
          return { ok: false, error: 'summary, start, and end required' };
        }
        return invokeGranted(sessionId, 'google-calendar', 'create', {
          summary,
          start,
          end,
          description: typeof params.description === 'string' ? params.description : undefined,
        });
      },
    },
    {
      name: 'google-calendar-update',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Update an existing Google Calendar event by id.',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Calendar event id' },
          summary: { type: 'string' },
          start: { type: 'string', description: 'ISO datetime start' },
          end: { type: 'string', description: 'ISO datetime end' },
          description: { type: 'string' },
        },
        required: ['eventId'],
      },
      execute: async (params) => {
        const eventId = String(params.eventId ?? '').trim();
        if (!eventId) return { ok: false, error: 'eventId required' };
        return invokeGranted(sessionId, 'google-calendar', 'update', {
          eventId,
          summary: typeof params.summary === 'string' ? params.summary : undefined,
          start: typeof params.start === 'string' ? params.start : undefined,
          end: typeof params.end === 'string' ? params.end : undefined,
          description: typeof params.description === 'string' ? params.description : undefined,
        });
      },
    },
  ];
}

const SLUG_TO_TOOLS: Record<string, (sessionId: string) => Tool[]> = {
  gmail: createGmailTools,
  'google-drive': createDriveTools,
  'google-calendar': createCalendarTools,
};

/**
 * Register chat-callable adapters for connected product tools (Gmail, Drive, …).
 * OAuth grants alone only update the prompt; these tools are what the model can invoke.
 */
export async function registerProductToolAdapters(sessionId: string): Promise<string[]> {
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx) return [];

  const grants = await listToolGrants(ctx.worker.workspaceId, ctx.worker.id);
  const connected = new Set(
    grants.filter((g) => g.status === 'connected').map((g) => g.toolSlug),
  );

  const registered: string[] = [];
  for (const [slug, factory] of Object.entries(SLUG_TO_TOOLS)) {
    if (!connected.has(slug)) continue;
    for (const tool of factory(sessionId)) {
      registerSessionTool(sessionId, tool);
      registered.push(tool.name);
    }
  }
  return registered;
}
