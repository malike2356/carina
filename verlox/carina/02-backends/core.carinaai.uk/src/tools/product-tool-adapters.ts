import type { Tool } from '../types/index.js';
import { pool } from '../memory/db.js';
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
      name: 'google-drive-list',
      description:
        'List recent Google Drive files or files inside a specific folder for this worker. '
        + 'Use this when the user asks what is in Drive or inside a Drive folder.',
      parameters: {
        type: 'object',
        properties: {
          folderId: { type: 'string', description: 'Optional Drive folder id.' },
        },
      },
      execute: async (params) => {
        const folderId = typeof params.folderId === 'string' ? params.folderId.trim() : '';
        return invokeGranted(sessionId, 'google-drive', 'list', { folderId: folderId || undefined });
      },
    },
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
    {
      name: 'google-drive-create-file',
      dangerous: true,
      requiresConfirmation: true,
      description:
        'Create a Google Doc in a connected Google Drive folder. Requires Google Drive write access.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Document title.' },
          content: { type: 'string', description: 'Document body text.' },
          parentId: { type: 'string', description: 'Drive folder id to create the document in.' },
        },
        required: ['title', 'content', 'parentId'],
      },
      execute: async (params) => {
        const title = String(params.title ?? '').trim();
        const content = String(params.content ?? '');
        const parentId = String(params.parentId ?? params.folderId ?? '').trim();
        if (!title || !content.trim() || !parentId) {
          return { ok: false, error: 'title, content, and parentId are required' };
        }
        return invokeGranted(sessionId, 'google-drive', 'create', { title, content, parentId });
      },
    },
    {
      name: 'google-drive-create-folder',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Create a Google Drive folder. parentId is optional; omitted creates in My Drive.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Folder name.' },
          parentId: { type: 'string', description: 'Optional parent folder id.' },
        },
        required: ['name'],
      },
      execute: async (params) => {
        const name = String(params.name ?? '').trim();
        const parentId = String(params.parentId ?? params.folderId ?? '').trim();
        if (!name) return { ok: false, error: 'name required' };
        return invokeGranted(sessionId, 'google-drive', 'create', {
          title: name,
          parentId: parentId || undefined,
          mimeType: 'application/vnd.google-apps.folder',
        });
      },
    },
    {
      name: 'google-drive-update-file',
      dangerous: true,
      requiresConfirmation: true,
      description:
        'Replace the text content of an existing Google Doc by Drive file id. Requires Drive write access.',
      parameters: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'Drive file id.' },
          content: { type: 'string', description: 'Replacement document body.' },
        },
        required: ['fileId', 'content'],
      },
      execute: async (params) => {
        const fileId = String(params.fileId ?? params.id ?? '').trim();
        const content = String(params.content ?? params.body ?? '');
        if (!fileId || !content.trim()) return { ok: false, error: 'fileId and content are required' };
        return invokeGranted(sessionId, 'google-drive', 'update', { fileId, content });
      },
    },
    {
      name: 'google-drive-move-file',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Move a Google Drive file to another folder.',
      parameters: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
          parentId: { type: 'string', description: 'Destination folder id.' },
        },
        required: ['fileId', 'parentId'],
      },
      execute: async (params) => {
        const fileId = String(params.fileId ?? params.id ?? '').trim();
        const parentId = String(params.parentId ?? params.folderId ?? '').trim();
        if (!fileId || !parentId) return { ok: false, error: 'fileId and parentId are required' };
        return invokeGranted(sessionId, 'google-drive', 'move', { fileId, parentId });
      },
    },
    {
      name: 'google-drive-delete-file',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Move a Google Drive file to trash. Requires explicit user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
        },
        required: ['fileId'],
      },
      execute: async (params) => {
        const fileId = String(params.fileId ?? params.id ?? '').trim();
        if (!fileId) return { ok: false, error: 'fileId required' };
        return invokeGranted(sessionId, 'google-drive', 'delete', { fileId });
      },
    },
    {
      name: 'google-drive-share-file',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Share a Google Drive file with a user by email. Requires explicit confirmation.',
      parameters: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
          emailAddress: { type: 'string' },
          role: { type: 'string', enum: ['reader', 'commenter', 'writer'] },
        },
        required: ['fileId', 'emailAddress'],
      },
      execute: async (params) => {
        const fileId = String(params.fileId ?? params.id ?? '').trim();
        const emailAddress = String(params.emailAddress ?? params.email ?? '').trim();
        const role = String(params.role ?? 'reader').trim();
        if (!fileId || !emailAddress) return { ok: false, error: 'fileId and emailAddress are required' };
        return invokeGranted(sessionId, 'google-drive', 'share', { fileId, emailAddress, role });
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

function maskValue(value: string): string {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function normalizeLimit(value: unknown, fallback: number, max: number): number {
  return Math.min(max, Math.max(1, Number(value ?? fallback) || fallback));
}

function simpleCronFromText(text: string): { cronExpression: string; scheduleLabel: string } {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  const time = lower.match(/\b(?:at\s+)?([01]?\d|2[0-3])(?::([0-5]\d))?\b/);
  const hour = time ? Number(time[1]) : 9;
  const minute = time?.[2] ? Number(time[2]) : 0;
  if (/\bevery\s+hour|hourly\b/.test(lower)) {
    return { cronExpression: '0 * * * *', scheduleLabel: raw || 'Hourly' };
  }
  const days: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  for (const [day, number] of Object.entries(days)) {
    if (lower.includes(day)) {
      return { cronExpression: `${minute} ${hour} * * ${number}`, scheduleLabel: raw || `Every ${day}` };
    }
  }
  if (/\bmonthly\b|every month/.test(lower)) {
    return { cronExpression: `${minute} ${hour} 1 * *`, scheduleLabel: raw || 'Monthly' };
  }
  if (/\bweekly\b|every week/.test(lower)) {
    return { cronExpression: `${minute} ${hour} * * 1`, scheduleLabel: raw || 'Weekly' };
  }
  return { cronExpression: `${minute} ${hour} * * *`, scheduleLabel: raw || 'Daily' };
}

async function listWorkspaceApprovalRows(workspaceId: string, limit: number, status?: string) {
  const statusClause = status ? 'WHERE workspace_id = $1 AND status = $3' : 'WHERE workspace_id = $1';
  const params = status ? [workspaceId, limit, status] : [workspaceId, limit];
  const result = await pool.query(
    `SELECT * FROM (
       SELECT id::text, worker_id::text, 'email' AS type, category, recipient,
              subject, draft_body AS draft, status, requested_at
       FROM worker_email_approvals
       ${statusClause}
       UNION ALL
       SELECT id::text, worker_id::text, 'social' AS type, channel AS category,
              contact_id AS recipient, left(draft_text, 160) AS subject, draft_text AS draft,
              status, requested_at
       FROM worker_social_approvals
       ${statusClause}
     ) approvals
     ORDER BY requested_at DESC
     LIMIT $2`,
    params,
  );
  return result.rows;
}

async function getApprovalType(workspaceId: string, approvalId: string, requestedType?: string): Promise<'email' | 'social' | null> {
  if (requestedType === 'email' || requestedType === 'social') return requestedType;
  const email = await pool.query(
    'SELECT id FROM worker_email_approvals WHERE workspace_id = $1 AND id = $2 LIMIT 1',
    [workspaceId, approvalId],
  );
  if (email.rows[0]) return 'email';
  const social = await pool.query(
    'SELECT id FROM worker_social_approvals WHERE workspace_id = $1 AND id = $2 LIMIT 1',
    [workspaceId, approvalId],
  );
  return social.rows[0] ? 'social' : null;
}

function createWorkspaceSurfaceTools(sessionId: string): Tool[] {
  return [
    {
      name: 'workspace-inventory',
      description:
        'Get a cross-module inventory of the Aiva workspace. '
        + 'Use this when the user asks what is in their workspace, whether you have full workspace access, '
        + 'or asks for a broad audit across documents, research, email, notes, memory, calendar, schedules, '
        + 'chats, Aivas, channels, automations, approvals, and skills. '
        + 'If a section is unavailable, report that specific section as unavailable instead of claiming full access.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max items per section, 1 to 50. Default 10.' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const { getWorkspaceInventory } = await import('../workers/aiva-workspace-surfaces.js');
        return getWorkspaceInventory({
          workspaceId: ctx.worker.workspaceId,
          workerId: ctx.worker.id,
          limit: Number(params.limit ?? 10),
        });
      },
    },
    {
      name: 'workspace-research-create',
      description:
        'Create a deep research job in the Aiva workspace Research page. '
        + 'Use whenever the user asks for deep research and says to save it, add it, or put it in Research. '
        + 'Returns the saved job id and workspace URL. The job may continue running after the chat reply.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Research question or topic' },
          mode: {
            type: 'string',
            enum: ['auto', 'product', 'compare', 'how-to', 'fact-check'],
          },
          rounds: { type: 'number', description: 'Research depth, 1 to 10. Default 6.' },
        },
        required: ['query'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const query = String(params.query ?? '').trim();
        if (query.length < 5) return { ok: false, error: 'query must be at least 5 characters' };
        const { createWorkspaceResearchJob } = await import('../workers/aiva-workspace-surfaces.js');
        return createWorkspaceResearchJob({
          workspaceId: ctx.worker.workspaceId,
          query,
          mode: typeof params.mode === 'string' ? params.mode : 'auto',
          rounds: Number(params.rounds ?? 6),
        });
      },
    },
    {
      name: 'workspace-channel-list',
      description: 'List channels connected to this Aiva in the workspace.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const { listWorkerChannelDetails } = await import('../channels/channel-store.js');
        const channels = await listWorkerChannelDetails(ctx.worker.id);
        return {
          ok: true,
          channels: channels.map((row) => ({
            id: row.id,
            channel: row.channel,
            identifier: maskValue(row.identifier),
            enabled: row.enabled,
            verified: row.verified,
            updatedAt: row.updatedAt.toISOString(),
          })),
        };
      },
    },
    {
      name: 'workspace-channel-connect',
      dangerous: true,
      requiresConfirmation: true,
      description:
        'Connect this Aiva to Telegram using a BotFather token provided by the owner. '
        + 'Never echo the token back.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: ['telegram'] },
          bot_token: { type: 'string', description: 'Sensitive Telegram bot token.' },
        },
        required: ['channel', 'bot_token'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const channel = String(params.channel ?? '').trim();
        if (channel !== 'telegram') return { ok: false, error: 'Only Telegram is supported for self-config now' };
        const { connectWorkerChannel } = await import('../channels/worker-channel-connect.js');
        const row = await connectWorkerChannel({
          workspaceId: ctx.worker.workspaceId,
          workerId: ctx.worker.id,
          channel: 'telegram',
          credentials: { bot_token: String(params.bot_token ?? '').trim() },
        });
        return {
          ok: true,
          channel: row.channel,
          identifier: maskValue(row.identifier),
          enabled: row.enabled,
          verified: row.verified,
          message: 'Telegram connected. Send /start to the bot in Telegram, then message this Aiva there.',
        };
      },
    },
    {
      name: 'workspace-channel-disconnect',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Disconnect a channel from this Aiva by channel row id.',
      parameters: {
        type: 'object',
        properties: { channelId: { type: 'string' } },
        required: ['channelId'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const channelId = String(params.channelId ?? '').trim();
        if (!channelId) return { ok: false, error: 'channelId required' };
        const { deleteWorkerChannel } = await import('../channels/channel-store.js');
        const deleted = await deleteWorkerChannel(ctx.worker.workspaceId, channelId);
        return { ok: deleted, deleted };
      },
    },
    {
      name: 'workspace-channel-status',
      description: 'Show connection status for this Aiva channel.',
      parameters: {
        type: 'object',
        properties: { channel: { type: 'string', description: 'Optional channel name.' } },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const requested = typeof params.channel === 'string' ? params.channel.trim() : '';
        const { listWorkerChannelDetails } = await import('../channels/channel-store.js');
        const channels = (await listWorkerChannelDetails(ctx.worker.id))
          .filter((row) => !requested || row.channel === requested);
        return {
          ok: true,
          channels: channels.map((row) => ({
            id: row.id,
            channel: row.channel,
            identifier: maskValue(row.identifier),
            enabled: row.enabled,
            verified: row.verified,
          })),
        };
      },
    },
    {
      name: 'workspace-channel-test',
      description: 'Test whether this Aiva channel appears connected and has saved credentials.',
      parameters: {
        type: 'object',
        properties: { channel: { type: 'string' } },
        required: ['channel'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const channel = String(params.channel ?? '').trim();
        const { getWorkerChannelByWorkerAndChannel } = await import('../channels/channel-store.js');
        const row = await getWorkerChannelByWorkerAndChannel(ctx.worker.id, channel as never);
        return {
          ok: Boolean(row?.enabled),
          channel,
          connected: Boolean(row),
          enabled: Boolean(row?.enabled),
          verified: Boolean(row?.verified),
          hasCredentials: Boolean(row?.credentials?.encrypted),
        };
      },
    },
    {
      name: 'workspace-schedule-list',
      description: 'List this Aiva workspace scheduled tasks and cron jobs.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const result = await pool.query(
          `SELECT id::text, worker_id::text, name, description, cron_expression, schedule_label,
                  trigger_type, trigger_event, enabled, last_run_at, next_run_at, created_at
           FROM ai_worker_automations
           WHERE workspace_id = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [ctx.worker.workspaceId, normalizeLimit(params.limit, 20, 100)],
        );
        return { ok: true, schedules: result.rows };
      },
    },
    {
      name: 'workspace-schedule-create',
      dangerous: true,
      requiresConfirmation: true,
      description:
        'Create a scheduled Aiva workspace task or cron job. Use for reminders, recurring research, reports, and scheduled work.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          schedule: { type: 'string', description: 'Natural language schedule such as daily at 9, every Monday at 10, weekly, monthly.' },
          cronExpression: { type: 'string' },
          timezone: { type: 'string' },
          prompt: { type: 'string', description: 'Task prompt for Aiva to run.' },
        },
        required: ['name', 'description'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const name = String(params.name ?? '').trim();
        const description = String(params.description ?? params.prompt ?? '').trim();
        if (!name || !description) return { ok: false, error: 'name and description are required' };
        const parsed = simpleCronFromText(String(params.schedule ?? params.cronExpression ?? 'daily at 9'));
        const cronExpression = String(params.cronExpression ?? '').trim() || parsed.cronExpression;
        const { createAutomation } = await import('../workers/worker-store.js');
        const automation = await createAutomation(ctx.worker.id, ctx.worker.workspaceId, {
          name,
          description,
          cronExpression,
          scheduleLabel: String(params.schedule ?? '').trim() || parsed.scheduleLabel,
          triggerType: 'cron',
          timezone: String(params.timezone ?? 'Europe/London'),
          actionType: 'aiva_prompt',
          actionJson: { type: 'aiva_prompt', prompt: String(params.prompt ?? description) },
          approvalMode: 'require_write',
        });
        return { ok: true, schedule: automation };
      },
    },
    {
      name: 'workspace-schedule-update',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Update a scheduled task or cron job in this workspace.',
      parameters: {
        type: 'object',
        properties: {
          scheduleId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          schedule: { type: 'string' },
          cronExpression: { type: 'string' },
          enabled: { type: 'boolean' },
        },
        required: ['scheduleId'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const scheduleId = String(params.scheduleId ?? params.id ?? '').trim();
        const parsed = params.schedule ? simpleCronFromText(String(params.schedule)) : null;
        const result = await pool.query(
          `UPDATE ai_worker_automations
           SET name = COALESCE($3, name),
               description = COALESCE($4, description),
               cron_expression = COALESCE($5, cron_expression),
               schedule_label = COALESCE($6, schedule_label),
               enabled = COALESCE($7, enabled)
           WHERE id = $1 AND workspace_id = $2
           RETURNING *`,
          [
            scheduleId,
            ctx.worker.workspaceId,
            typeof params.name === 'string' ? params.name.trim() : null,
            typeof params.description === 'string' ? params.description.trim() : null,
            typeof params.cronExpression === 'string' ? params.cronExpression.trim() : parsed?.cronExpression ?? null,
            typeof params.schedule === 'string' ? params.schedule.trim() : null,
            typeof params.enabled === 'boolean' ? params.enabled : null,
          ],
        );
        return result.rows[0] ? { ok: true, schedule: result.rows[0] } : { ok: false, error: 'Schedule not found' };
      },
    },
    {
      name: 'workspace-schedule-pause',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Pause a scheduled task.',
      parameters: { type: 'object', properties: { scheduleId: { type: 'string' } }, required: ['scheduleId'] },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const result = await pool.query(
          `UPDATE ai_worker_automations SET enabled = false WHERE id = $1 AND workspace_id = $2 RETURNING id::text, enabled`,
          [String(params.scheduleId ?? params.id ?? '').trim(), ctx.worker.workspaceId],
        );
        return result.rows[0] ? { ok: true, schedule: result.rows[0] } : { ok: false, error: 'Schedule not found' };
      },
    },
    {
      name: 'workspace-schedule-resume',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Resume a paused scheduled task.',
      parameters: { type: 'object', properties: { scheduleId: { type: 'string' } }, required: ['scheduleId'] },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const result = await pool.query(
          `UPDATE ai_worker_automations SET enabled = true WHERE id = $1 AND workspace_id = $2 RETURNING id::text, enabled`,
          [String(params.scheduleId ?? params.id ?? '').trim(), ctx.worker.workspaceId],
        );
        return result.rows[0] ? { ok: true, schedule: result.rows[0] } : { ok: false, error: 'Schedule not found' };
      },
    },
    {
      name: 'workspace-schedule-delete',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Delete a scheduled task.',
      parameters: { type: 'object', properties: { scheduleId: { type: 'string' } }, required: ['scheduleId'] },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const result = await pool.query(
          `DELETE FROM ai_worker_automations WHERE id = $1 AND workspace_id = $2 RETURNING id::text`,
          [String(params.scheduleId ?? params.id ?? '').trim(), ctx.worker.workspaceId],
        );
        return { ok: Boolean(result.rows[0]), deleted: Boolean(result.rows[0]) };
      },
    },
    {
      name: 'workspace-schedule-run-now',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Queue a scheduled task to run immediately.',
      parameters: { type: 'object', properties: { scheduleId: { type: 'string' } }, required: ['scheduleId'] },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const result = await pool.query(
          `UPDATE ai_worker_automations SET next_run_at = NOW()
           WHERE id = $1 AND workspace_id = $2
           RETURNING id::text, next_run_at`,
          [String(params.scheduleId ?? params.id ?? '').trim(), ctx.worker.workspaceId],
        );
        return result.rows[0] ? { ok: true, schedule: result.rows[0] } : { ok: false, error: 'Schedule not found' };
      },
    },
    {
      name: 'workspace-research-list',
      description:
        'List recent jobs from the Aiva workspace Research page. '
        + 'Use when the user asks what research has been saved or what is running.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max jobs, 1 to 50. Default 10.' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const { listWorkspaceResearchJobs } = await import('../workers/aiva-workspace-surfaces.js');
        return listWorkspaceResearchJobs({
          workspaceId: ctx.worker.workspaceId,
          limit: Number(params.limit ?? 10),
        });
      },
    },
    {
      name: 'workspace-document-create',
      description:
        'Create a document in the Aiva workspace Documents page. '
        + 'Use whenever the user asks you to create, write, draft, or save a document in the workspace.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Document title' },
          content: { type: 'string', description: 'Full document body' },
          format: { type: 'string', enum: ['markdown', 'plain'] },
        },
        required: ['title', 'content'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const title = String(params.title ?? '').trim() || 'Untitled';
        const content = String(params.content ?? '');
        if (!content.trim()) return { ok: false, error: 'content required' };
        const { createWorkspaceDocument } = await import('../workers/aiva-workspace-surfaces.js');
        return createWorkspaceDocument({
          workspaceId: ctx.worker.workspaceId,
          title,
          content,
          format: params.format === 'plain' ? 'plain' : 'markdown',
        });
      },
    },
    {
      name: 'workspace-document-list',
      description:
        'List documents from the Aiva workspace Documents page. '
        + 'Use when the user asks what documents exist in the workspace.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max documents, 1 to 100. Default 20.' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const { listWorkspaceDocuments } = await import('../workers/aiva-workspace-surfaces.js');
        return listWorkspaceDocuments({
          workspaceId: ctx.worker.workspaceId,
          limit: Number(params.limit ?? 20),
        });
      },
    },
    {
      name: 'workspace-approval-list',
      description: 'List workspace approvals across email and social approval queues.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          status: { type: 'string', description: 'Optional status filter such as pending, sent, rejected, timeout.' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const status = typeof params.status === 'string' && params.status.trim() ? params.status.trim() : undefined;
        const approvals = await listWorkspaceApprovalRows(
          ctx.worker.workspaceId,
          normalizeLimit(params.limit, 20, 100),
          status,
        );
        return { ok: true, approvals };
      },
    },
    {
      name: 'workspace-approval-get',
      description: 'Get one workspace approval by id. Detects email or social approval type when not supplied.',
      parameters: {
        type: 'object',
        properties: {
          approvalId: { type: 'string' },
          type: { type: 'string', enum: ['email', 'social'] },
        },
        required: ['approvalId'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const approvalId = String(params.approvalId ?? params.id ?? '').trim();
        const type = await getApprovalType(ctx.worker.workspaceId, approvalId, String(params.type ?? ''));
        if (type === 'email') {
          const { getApproval } = await import('../ingestion/email/worker-approval-store.js');
          return { ok: true, type, approval: await getApproval(ctx.worker.workspaceId, approvalId) };
        }
        if (type === 'social') {
          const { getSocialApproval } = await import('../ingestion/social/social-approval-store.js');
          return { ok: true, type, approval: await getSocialApproval(ctx.worker.workspaceId, approvalId) };
        }
        return { ok: false, error: 'Approval not found' };
      },
    },
    {
      name: 'workspace-approval-create',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Create an email or social approval draft in the workspace approval queue.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['email', 'social'] },
          recipient: { type: 'string' },
          subject: { type: 'string' },
          draftBody: { type: 'string' },
          channel: { type: 'string' },
          contactId: { type: 'string' },
          inboundText: { type: 'string' },
          draftText: { type: 'string' },
        },
        required: ['type'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const type = String(params.type ?? '').trim();
        if (type === 'email') {
          const { createEmailApproval } = await import('../ingestion/email/worker-approval-store.js');
          const recipient = String(params.recipient ?? '').trim();
          const subject = String(params.subject ?? '').trim();
          const draftBody = String(params.draftBody ?? params.draftText ?? '').trim();
          if (!recipient || !subject || !draftBody) {
            return { ok: false, error: 'recipient, subject, and draftBody are required' };
          }
          const approval = await createEmailApproval({
            workerId: ctx.worker.id,
            workspaceId: ctx.worker.workspaceId,
            category: 'client_query',
            recipient,
            subject,
            draftBody,
            originalFrom: recipient,
          });
          return { ok: true, type, approval };
        }
        if (type === 'social') {
          const { createSocialApproval } = await import('../ingestion/social/social-approval-store.js');
          const channel = String(params.channel ?? ctx.channel ?? '').trim();
          const contactId = String(params.contactId ?? ctx.contactId ?? '').trim();
          const draftText = String(params.draftText ?? params.draftBody ?? '').trim();
          if (!channel || !contactId || !draftText) {
            return { ok: false, error: 'channel, contactId, and draftText are required' };
          }
          const approval = await createSocialApproval({
            workerId: ctx.worker.id,
            workspaceId: ctx.worker.workspaceId,
            channel: channel as never,
            contactId,
            inboundText: String(params.inboundText ?? ''),
            draftText,
          });
          return { ok: true, type, approval };
        }
        return { ok: false, error: 'type must be email or social' };
      },
    },
    {
      name: 'workspace-approval-modify',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Modify the draft body/text for a pending email or social approval.',
      parameters: {
        type: 'object',
        properties: {
          approvalId: { type: 'string' },
          type: { type: 'string', enum: ['email', 'social'] },
          draftBody: { type: 'string' },
          draftText: { type: 'string' },
        },
        required: ['approvalId'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const approvalId = String(params.approvalId ?? params.id ?? '').trim();
        const body = String(params.draftBody ?? params.draftText ?? '').trim();
        if (!body) return { ok: false, error: 'draft body is required' };
        const type = await getApprovalType(ctx.worker.workspaceId, approvalId, String(params.type ?? ''));
        if (type === 'email') {
          const result = await pool.query(
            `UPDATE worker_email_approvals
             SET draft_body = $3, modified_body = $3, decision = 'modified'
             WHERE workspace_id = $1 AND id = $2 AND status = 'pending'
             RETURNING *`,
            [ctx.worker.workspaceId, approvalId, body],
          );
          return result.rows[0] ? { ok: true, type, approval: result.rows[0] } : { ok: false, error: 'Approval not found or already resolved' };
        }
        if (type === 'social') {
          const { patchSocialApprovalDraft } = await import('../ingestion/social/social-send-on-approve.js');
          const approval = await patchSocialApprovalDraft({
            workspaceId: ctx.worker.workspaceId,
            approvalId,
            draftText: body,
          });
          return approval ? { ok: true, type, approval } : { ok: false, error: 'Approval not found or already resolved' };
        }
        return { ok: false, error: 'Approval not found' };
      },
    },
    {
      name: 'workspace-approval-approve',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Approve a pending email or social approval and release the action.',
      parameters: {
        type: 'object',
        properties: {
          approvalId: { type: 'string' },
          type: { type: 'string', enum: ['email', 'social'] },
          modifiedBody: { type: 'string' },
        },
        required: ['approvalId'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const approvalId = String(params.approvalId ?? params.id ?? '').trim();
        const type = await getApprovalType(ctx.worker.workspaceId, approvalId, String(params.type ?? ''));
        if (type === 'email') {
          const { sendApprovedEmail } = await import('../ingestion/email/email-draft-handler.js');
          const approval = await sendApprovedEmail({
            workspaceId: ctx.worker.workspaceId,
            approvalId,
            reviewedBy: ctx.contactId ?? 'workspace_owner',
            modifiedBody: typeof params.modifiedBody === 'string' ? params.modifiedBody : undefined,
          });
          return approval ? { ok: true, type, approval } : { ok: false, error: 'Approval not found or already resolved' };
        }
        if (type === 'social') {
          const { approveSocialApproval } = await import('../ingestion/social/social-send-on-approve.js');
          const approval = await approveSocialApproval({
            workspaceId: ctx.worker.workspaceId,
            approvalId,
            decisionBy: ctx.contactId ?? 'workspace_owner',
            modifiedDraft: typeof params.modifiedBody === 'string' ? params.modifiedBody : undefined,
          });
          return approval ? { ok: true, type, approval } : { ok: false, error: 'Approval not found or already resolved' };
        }
        return { ok: false, error: 'Approval not found' };
      },
    },
    {
      name: 'workspace-approval-reject',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Reject a pending email or social approval.',
      parameters: {
        type: 'object',
        properties: {
          approvalId: { type: 'string' },
          type: { type: 'string', enum: ['email', 'social'] },
        },
        required: ['approvalId'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const approvalId = String(params.approvalId ?? params.id ?? '').trim();
        const type = await getApprovalType(ctx.worker.workspaceId, approvalId, String(params.type ?? ''));
        if (type === 'email') {
          const { rejectEmailApproval } = await import('../ingestion/email/email-draft-handler.js');
          const approval = await rejectEmailApproval({
            workspaceId: ctx.worker.workspaceId,
            approvalId,
            reviewedBy: ctx.contactId ?? 'workspace_owner',
          });
          return approval ? { ok: true, type, approval } : { ok: false, error: 'Approval not found or already resolved' };
        }
        if (type === 'social') {
          const { rejectSocialApproval } = await import('../ingestion/social/social-send-on-approve.js');
          const approval = await rejectSocialApproval({
            workspaceId: ctx.worker.workspaceId,
            approvalId,
            decisionBy: ctx.contactId ?? 'workspace_owner',
          });
          return approval ? { ok: true, type, approval } : { ok: false, error: 'Approval not found or already resolved' };
        }
        return { ok: false, error: 'Approval not found' };
      },
    },
    {
      name: 'workspace-worker-get',
      description: 'Read this Aiva worker settings and capability state.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const { getWorker } = await import('../workers/worker-store.js');
        return { ok: true, worker: await getWorker(ctx.worker.workspaceId, ctx.worker.id) };
      },
    },
    {
      name: 'workspace-worker-update',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Update this Aiva worker name, role, persona, language, skill packs, or worker config.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          roleDescription: { type: 'string' },
          personaPrompt: { type: 'string' },
          language: { type: 'string' },
          skillPacks: { type: 'array', items: { type: 'string' } },
          workerConfig: { type: 'object' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const patch: Record<string, unknown> = {};
        if (typeof params.name === 'string') patch.name = params.name.trim();
        if (typeof params.roleDescription === 'string') patch.roleDescription = params.roleDescription.trim();
        if (typeof params.personaPrompt === 'string') patch.personaPrompt = params.personaPrompt;
        if (typeof params.language === 'string') patch.language = params.language.trim();
        if (Array.isArray(params.skillPacks)) patch.skillPacks = params.skillPacks.filter((x): x is string => typeof x === 'string');
        if (params.workerConfig && typeof params.workerConfig === 'object') {
          patch.workerConfig = {
            ...(ctx.worker.workerConfig ?? {}),
            ...(params.workerConfig as Record<string, unknown>),
          };
        }
        const { updateWorker } = await import('../workers/worker-store.js');
        return { ok: true, worker: await updateWorker(ctx.worker.workspaceId, ctx.worker.id, patch) };
      },
    },
    {
      name: 'workspace-worker-pause',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Pause this Aiva worker.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const { pauseWorker } = await import('../workers/worker-store.js');
        await pauseWorker(ctx.worker.workspaceId, ctx.worker.id);
        return { ok: true, status: 'paused' };
      },
    },
    {
      name: 'workspace-worker-resume',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Resume this Aiva worker.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const { resumeWorker } = await import('../workers/worker-store.js');
        await resumeWorker(ctx.worker.workspaceId, ctx.worker.id);
        return { ok: true, status: 'active' };
      },
    },
    {
      name: 'workspace-worker-voice-settings-update',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Update this Aiva Telegram voice preference. Default should be text unless the user asks for audio.',
      parameters: {
        type: 'object',
        properties: {
          preferVoiceReplies: { type: 'boolean' },
          askBeforeVoice: { type: 'boolean' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const workerConfig = {
          ...(ctx.worker.workerConfig ?? {}),
          telegram: {
            ...((ctx.worker.workerConfig?.telegram as Record<string, unknown> | undefined) ?? {}),
            preferVoiceReplies: Boolean(params.preferVoiceReplies),
            askBeforeVoice: params.askBeforeVoice !== false,
          },
        };
        const { updateWorker } = await import('../workers/worker-store.js');
        return { ok: true, worker: await updateWorker(ctx.worker.workspaceId, ctx.worker.id, { workerConfig }) };
      },
    },
    {
      name: 'workspace-worker-skill-enable',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Enable a skill pack for this Aiva worker.',
      parameters: {
        type: 'object',
        properties: { skillPack: { type: 'string' } },
        required: ['skillPack'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const skillPack = String(params.skillPack ?? params.id ?? '').trim();
        if (!skillPack) return { ok: false, error: 'skillPack required' };
        const skillPacks = Array.from(new Set([...(ctx.worker.skillPacks ?? []), skillPack]));
        const { updateWorker } = await import('../workers/worker-store.js');
        return { ok: true, worker: await updateWorker(ctx.worker.workspaceId, ctx.worker.id, { skillPacks }) };
      },
    },
    {
      name: 'workspace-worker-skill-disable',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Disable a skill pack for this Aiva worker.',
      parameters: {
        type: 'object',
        properties: { skillPack: { type: 'string' } },
        required: ['skillPack'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const skillPack = String(params.skillPack ?? params.id ?? '').trim();
        if (!skillPack) return { ok: false, error: 'skillPack required' };
        const skillPacks = (ctx.worker.skillPacks ?? []).filter((item) => item !== skillPack);
        const { updateWorker } = await import('../workers/worker-store.js');
        return { ok: true, worker: await updateWorker(ctx.worker.workspaceId, ctx.worker.id, { skillPacks }) };
      },
    },
    {
      name: 'workspace-worker-scout-mode-update',
      dangerous: true,
      requiresConfirmation: true,
      description:
        'Update Scout mode for this Aiva in workerConfig. Use monitoring_only to stop defensive blocking, or defense_enabled to restore defensive actions.',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['monitoring_only', 'defense_enabled'] },
        },
        required: ['mode'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const mode = String(params.mode ?? '').trim();
        if (mode !== 'monitoring_only' && mode !== 'defense_enabled') {
          return { ok: false, error: 'mode must be monitoring_only or defense_enabled' };
        }
        const currentConfig = (ctx.worker.workerConfig ?? {}) as Record<string, unknown>;
        const workerConfig = {
          ...currentConfig,
          scout: {
            ...((currentConfig.scout as Record<string, unknown> | undefined) ?? {}),
            mode,
            defenseEnabled: mode === 'defense_enabled',
            monitoringOnly: mode === 'monitoring_only',
          },
        };
        const { updateWorker } = await import('../workers/worker-store.js');
        return {
          ok: true,
          worker: await updateWorker(ctx.worker.workspaceId, ctx.worker.id, { workerConfig: workerConfig as never }),
        };
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

  const registered: string[] = [];
  for (const tool of createWorkspaceSurfaceTools(sessionId)) {
    registerSessionTool(sessionId, tool);
    registered.push(tool.name);
  }

  const grants = await listToolGrants(ctx.worker.workspaceId, ctx.worker.id);
  const connected = new Set(
    grants.filter((g) => g.status === 'connected').map((g) => g.toolSlug),
  );

  for (const [slug, factory] of Object.entries(SLUG_TO_TOOLS)) {
    if (!connected.has(slug)) continue;
    for (const tool of factory(sessionId)) {
      registerSessionTool(sessionId, tool);
      registered.push(tool.name);
    }
  }
  return registered;
}
