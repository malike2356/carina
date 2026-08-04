import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { listToolGrants } from '../workers/spinnable-parity-store.js';
import { invokeProductTool } from '../workers/product-tools/invoke.js';
import { registerSessionTool } from './session-tool-store.js';
import { createCompaniesHouseTools } from './companies-house-tools.js';
import { createOutreachDiscoveryTools } from './outreach-discovery-tools.js';
import { createOutreachCadenceTools } from './outreach-cadence-tools.js';
import { createOutreachReplyTools } from './outreach-reply-tools.js';
import { createOutreachBookingTools } from './outreach-booking-tools.js';
import { createVicalBookingTools } from './vical-booking-tools.js';
import { buildOutreachBoardSummary, getOutreachBoardConfig, updateOutreachBoardConfig } from '../outreach/kanban.js';
import { buildWeeklyOwnerDigest, listFollowUpTasks, processDueFollowUps } from '../outreach/follow-ups.js';
import { getOutreachAlertTarget, updateOutreachAlertTarget, sendOutreachTelegramAlert } from '../outreach/alerts.js';
import { getOutreachControlState, pauseOutreach, resumeOutreach, outreachControlSummary } from '../outreach/control.js';
import { importYouTubeLeadsIntoOutreach } from '../outreach/youtube-import.js';

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
      dangerous: false,
      requiresConfirmation: false,
      description:
        'Create an outbound email draft and queue it for owner approval at /aiva/approvals. '
        + 'Does NOT send. Use this when the user asks to draft an email, keep it in the workspace, '
        + 'or approve before sending. For new emails pass to + subject + draftBody (or body). '
        + 'For replies to synced mail, pass messageId. Prefer this over gmail-send when approval is requested.',
      parameters: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'Synced email_messages id to reply to (optional for new outbound).',
          },
          draftBody: {
            type: 'string',
            description: 'Full draft email body to queue for approval.',
          },
          to: { type: 'string', description: 'Recipient email for a new outbound draft' },
          subject: { type: 'string', description: 'Subject for a new outbound draft' },
          body: {
            type: 'string',
            description: 'Alias for draftBody, or original message context when replying.',
          },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };

        const messageId = String(params.messageId ?? '').trim();
        let recipient = String(params.to ?? '').trim();
        let subject = String(params.subject ?? '').trim();
        let originalBody = '';
        let originalFrom = recipient;
        let draftBody = String(params.draftBody ?? '').trim();
        if (!draftBody && typeof params.body === 'string' && params.body.trim()) {
          draftBody = params.body.trim();
        }

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
            body: originalBody || String(params.body ?? ''),
            category: 'client_query',
          });
        }

        const approvalSubject = messageId
          ? (/^re:/i.test(subject) ? subject : `Re: ${subject}`)
          : subject;
        const { createEmailApproval } = await import('../ingestion/email/worker-approval-store.js');
        const approval = await createEmailApproval({
          workerId: ctx.worker.id,
          workspaceId: ctx.worker.workspaceId,
          messageId: messageId || undefined,
          category: 'client_query',
          recipient,
          subject: approvalSubject,
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
        'List files in Google Drive (optionally under a folderId). Use for browsing folders.',
      parameters: {
        type: 'object',
        properties: {
          folderId: { type: 'string', description: 'Optional Drive folder id' },
        },
      },
      execute: async (params) => {
        const folderId = typeof params.folderId === 'string' ? params.folderId.trim() : '';
        return invokeGranted(sessionId, 'google-drive', 'list', {
          folderId: folderId || undefined,
        });
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
      name: 'google-drive-share',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Share a Drive file with an email (role: reader|writer|commenter).',
      parameters: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', description: 'reader (default), writer, or commenter' },
        },
        required: ['fileId', 'email'],
      },
      execute: async (params) => {
        const fileId = String(params.fileId ?? '').trim();
        const email = String(params.email ?? '').trim();
        if (!fileId || !email) return { ok: false, error: 'fileId and email required' };
        return invokeGranted(sessionId, 'google-drive', 'share', {
          fileId,
          email,
          role: typeof params.role === 'string' ? params.role : 'reader',
        });
      },
    },
    {
      name: 'google-drive-create-file',
      dangerous: true,
      requiresConfirmation: true,
      description:
        'Create a Google Doc in Drive under parentId (folder). Requires connected Drive with write scope.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string', description: 'Initial document body text' },
          parentId: { type: 'string', description: 'Destination folder id (required)' },
        },
        required: ['title', 'parentId'],
      },
      execute: async (params) => {
        const title = String(params.title ?? params.name ?? '').trim();
        const parentId = String(params.parentId ?? params.folderId ?? '').trim();
        if (!title || !parentId) return { ok: false, error: 'title and parentId required' };
        return invokeGranted(sessionId, 'google-drive', 'create', {
          title,
          parentId,
          content: String(params.content ?? params.body ?? ''),
        });
      },
    },
    {
      name: 'google-drive-create-folder',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Create a Drive folder under parentId.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          parentId: { type: 'string' },
        },
        required: ['title', 'parentId'],
      },
      execute: async (params) => {
        const title = String(params.title ?? params.name ?? '').trim();
        const parentId = String(params.parentId ?? params.folderId ?? '').trim();
        if (!title || !parentId) return { ok: false, error: 'title and parentId required' };
        return invokeGranted(sessionId, 'google-drive', 'create', {
          title,
          parentId,
          mimeType: 'application/vnd.google-apps.folder',
        });
      },
    },
    {
      name: 'google-drive-update-file',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Replace Google Doc body text by fileId.',
      parameters: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['fileId', 'content'],
      },
      execute: async (params) => {
        const fileId = String(params.fileId ?? params.id ?? '').trim();
        const content = String(params.content ?? params.body ?? '');
        if (!fileId) return { ok: false, error: 'fileId required' };
        return invokeGranted(sessionId, 'google-drive', 'update', { fileId, content });
      },
    },
    {
      name: 'google-drive-move-file',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Move a Drive file into parentId (destination folder).',
      parameters: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
          parentId: { type: 'string' },
        },
        required: ['fileId', 'parentId'],
      },
      execute: async (params) => {
        const fileId = String(params.fileId ?? params.id ?? '').trim();
        const parentId = String(params.parentId ?? params.folderId ?? '').trim();
        if (!fileId || !parentId) return { ok: false, error: 'fileId and parentId required' };
        return invokeGranted(sessionId, 'google-drive', 'move', { fileId, parentId });
      },
    },
    {
      name: 'google-drive-delete-file',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Trash/delete a Drive file by id. Only when the owner clearly asks to delete.',
      parameters: {
        type: 'object',
        properties: { fileId: { type: 'string' } },
        required: ['fileId'],
      },
      execute: async (params) => {
        const fileId = String(params.fileId ?? params.id ?? '').trim();
        if (!fileId) return { ok: false, error: 'fileId required' };
        return invokeGranted(sessionId, 'google-drive', 'delete', { fileId });
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
      description:
        'Create a Google Calendar event on the connected primary calendar. '
        + 'Requires chat confirmation. After create, the event is also mirrored into the Aiva Calendar page.',
      parameters: {
        type: 'object',
          properties: {
            summary: { type: 'string', description: 'Event title' },
            start: { type: 'string', description: 'ISO datetime start' },
            end: { type: 'string', description: 'ISO datetime end' },
            description: { type: 'string', description: 'Optional event description' },
            location: { type: 'string', description: 'Optional location or room link' },
            attendees: { type: 'array', description: 'Optional attendee email objects' },
            conferenceData: { type: 'object', description: 'Optional conferenceData payload for Meet' },
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
          location: typeof params.location === 'string' ? params.location : undefined,
          attendees: Array.isArray(params.attendees) ? params.attendees : undefined,
          conferenceData: params.conferenceData && typeof params.conferenceData === 'object' ? params.conferenceData : undefined,
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

function createTrelloTools(sessionId: string): Tool[] {
  return [
    {
      name: 'trello-list-boards',
      description:
        'List Trello boards for this worker (connected Trello tool account). '
        + 'Use for "list my Trello boards" or when the user asks about Trello boards. '
        + 'Do NOT use kanban-list for Trello; that is the internal Aiva kanban only.',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async () => invokeGranted(sessionId, 'trello', 'list-boards'),
    },
    {
      name: 'trello-list-lists',
      description: 'List lists on a Trello board. Requires boardId from trello-list-boards.',
      parameters: {
        type: 'object',
        properties: {
          boardId: { type: 'string', description: 'Trello board id' },
        },
        required: ['boardId'],
      },
      execute: async (params) => {
        const boardId = String(params.boardId ?? '').trim();
        if (!boardId) return { ok: false, error: 'boardId required' };
        return invokeGranted(sessionId, 'trello', 'list-lists', { boardId });
      },
    },
    {
      name: 'trello-list-cards',
      description: 'List cards in a Trello list. Requires listId from trello-list-lists.',
      parameters: {
        type: 'object',
        properties: {
          listId: { type: 'string', description: 'Trello list id' },
        },
        required: ['listId'],
      },
      execute: async (params) => {
        const listId = String(params.listId ?? '').trim();
        if (!listId) return { ok: false, error: 'listId required' };
        return invokeGranted(sessionId, 'trello', 'list-cards', { listId });
      },
    },
    {
      name: 'trello-create-card',
      description: 'Create a card on a Trello list. Requires listId and name.',
      parameters: {
        type: 'object',
        properties: {
          listId: { type: 'string', description: 'Trello list id' },
          name: { type: 'string', description: 'Card title' },
          desc: { type: 'string', description: 'Optional card description' },
        },
        required: ['listId', 'name'],
      },
      execute: async (params) => {
        const listId = String(params.listId ?? '').trim();
        const name = String(params.name ?? '').trim();
        const desc = typeof params.desc === 'string' ? params.desc : '';
        if (!listId) return { ok: false, error: 'listId required' };
        if (!name) return { ok: false, error: 'name required' };
        return invokeGranted(sessionId, 'trello', 'create-card', { listId, name, desc });
      },
    },
  ];
}

function createSheetsTools(sessionId: string): Tool[] {
  return [
    {
      name: 'google-sheets-list',
      description: 'List recent Google Spreadsheets in Drive, or read a range when spreadsheetId is set.',
      parameters: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Optional spreadsheet id; omit to list sheets' },
          range: { type: 'string', description: 'A1 range when reading (default A1:D10)' },
        },
      },
      execute: async (params) => {
        const spreadsheetId = typeof params.spreadsheetId === 'string' ? params.spreadsheetId.trim() : '';
        return invokeGranted(sessionId, 'google-sheets', 'read', {
          spreadsheetId: spreadsheetId || undefined,
          range: typeof params.range === 'string' ? params.range : undefined,
        });
      },
    },
    {
      name: 'google-sheets-append',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Append rows to a Google Sheet. values must be an array of row arrays.',
      parameters: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          range: { type: 'string', description: 'Start range, e.g. Sheet1!A1' },
          values: { type: 'array', description: 'Rows to append' },
        },
        required: ['spreadsheetId', 'values'],
      },
      execute: async (params) => {
        const spreadsheetId = String(params.spreadsheetId ?? '').trim();
        if (!spreadsheetId) return { ok: false, error: 'spreadsheetId required' };
        return invokeGranted(sessionId, 'google-sheets', 'append', {
          spreadsheetId,
          range: typeof params.range === 'string' ? params.range : 'A1',
          values: params.values,
        });
      },
    },
  ];
}

function createContactsTools(sessionId: string): Tool[] {
  return [
    {
      name: 'google-contacts-list',
      description: 'List Google Contacts (People API) for this worker.',
      parameters: {
        type: 'object',
        properties: {
          pageSize: { type: 'number', description: '1-50, default 10' },
        },
      },
      execute: async (params) =>
        invokeGranted(sessionId, 'google-contacts', 'list', {
          pageSize: Number(params.pageSize ?? 10),
        }),
    },
    {
      name: 'google-contacts-search',
      description: 'Search Google Contacts / synced Contacts directory by name or email.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          pageSize: { type: 'number' },
        },
        required: ['query'],
      },
      execute: async (params) => {
        const query = String(params.query ?? '').trim();
        if (!query) return { ok: false, error: 'query required' };
        return invokeGranted(sessionId, 'google-contacts', 'search', {
          query,
          pageSize: Number(params.pageSize ?? 10),
        });
      },
    },
  ];
}

function createTasksTools(sessionId: string): Tool[] {
  return [
    {
      name: 'google-tasks-list',
      description: 'List Google Tasks from the default list (or tasklist id).',
      parameters: {
        type: 'object',
        properties: {
          tasklist: { type: 'string', description: 'Task list id or @default' },
          limit: { type: 'number' },
        },
      },
      execute: async (params) =>
        invokeGranted(sessionId, 'google-tasks', 'list', {
          tasklist: typeof params.tasklist === 'string' ? params.tasklist : '@default',
          maxResults: Number(params.limit ?? 20),
        }),
    },
    {
      name: 'google-tasks-create',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Create a Google Task.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          notes: { type: 'string' },
          due: { type: 'string', description: 'RFC3339 due date' },
          tasklist: { type: 'string' },
        },
        required: ['title'],
      },
      execute: async (params) => {
        const title = String(params.title ?? '').trim();
        if (!title) return { ok: false, error: 'title required' };
        return invokeGranted(sessionId, 'google-tasks', 'create', {
          title,
          notes: typeof params.notes === 'string' ? params.notes : undefined,
          due: typeof params.due === 'string' ? params.due : undefined,
          tasklist: typeof params.tasklist === 'string' ? params.tasklist : '@default',
        });
      },
    },
  ];
}

function createGithubTools(sessionId: string): Tool[] {
  return [
    {
      name: 'github-me',
      description: 'Show the authenticated GitHub user for the connected token.',
      parameters: { type: 'object', properties: {} },
      execute: async () => invokeGranted(sessionId, 'github', 'me'),
    },
    {
      name: 'github-list-repos',
      description: 'List recent GitHub repos for the connected account.',
      parameters: { type: 'object', properties: {} },
      execute: async () => invokeGranted(sessionId, 'github', 'list_repos'),
    },
  ];
}

function createSlackToolTools(sessionId: string): Tool[] {
  return [
    {
      name: 'slack-tool-list-channels',
      description: 'List Slack channels using the Slack (tools) bot token grant.',
      parameters: { type: 'object', properties: {} },
      execute: async () => invokeGranted(sessionId, 'slack-tool', 'list_channels'),
    },
    {
      name: 'slack-tool-post-message',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Post a message to a Slack channel with the Slack (tools) bot token.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Channel id or name' },
          text: { type: 'string' },
        },
        required: ['channel', 'text'],
      },
      execute: async (params) => {
        const channel = String(params.channel ?? '').trim();
        const text = String(params.text ?? '').trim();
        if (!channel || !text) return { ok: false, error: 'channel and text required' };
        return invokeGranted(sessionId, 'slack-tool', 'post_message', { channel, text });
      },
    },
  ];
}

function createOutreachBoardTools(sessionId: string): Tool[] {
  return [
    {
      name: 'outreach-board-summary',
      description: 'Summarise the outreach board state, counts by stage, and current sync status.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.worker.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return { ok: true, data: buildOutreachBoardSummary(workspaceId) };
      },
    },
    {
      name: 'outreach-board-config-get',
      description: 'Read the outreach board sync configuration for this workspace.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.worker.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return { ok: true, data: getOutreachBoardConfig(workspaceId) };
      },
    },
    {
      name: 'outreach-board-config-update',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Update outreach board sync settings for Trello or native kanban.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          backend: { type: 'string', enum: ['trello', 'native'] },
          trelloBoardId: { type: 'string' },
          trelloListIds: { type: 'object' },
          nativeSessionId: { type: 'string' },
          nativeBoardId: { type: 'string' },
          enabled: { type: 'boolean' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.worker.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return {
          ok: true,
          data: updateOutreachBoardConfig(workspaceId, {
            backend: params.backend === 'native' || params.backend === 'trello' ? params.backend : undefined,
            trelloBoardId: typeof params.trelloBoardId === 'string' ? params.trelloBoardId : undefined,
            trelloListIds: params.trelloListIds && typeof params.trelloListIds === 'object'
              ? (params.trelloListIds as Record<string, string>)
              : undefined,
            nativeSessionId: typeof params.nativeSessionId === 'string' ? params.nativeSessionId : undefined,
            nativeBoardId: typeof params.nativeBoardId === 'string' ? params.nativeBoardId : undefined,
            enabled: typeof params.enabled === 'boolean' ? params.enabled : undefined,
          }),
        };
      },
    },
  ];
}

function createOutreachAlertTools(sessionId: string): Tool[] {
  return [
    {
      name: 'outreach-alert-config-get',
      description: 'Read the outreach Telegram alert target for this workspace.',
      parameters: { type: 'object', properties: { workspaceId: { type: 'string' } } },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.worker.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return { ok: true, data: getOutreachAlertTarget(workspaceId) };
      },
    },
    {
      name: 'outreach-alert-config-update',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Configure the Telegram target that receives outreach alerts and owner prompts.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          enabled: { type: 'boolean' },
          conversationId: { type: 'string' },
          workerId: { type: 'string' },
          label: { type: 'string' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.worker.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return {
          ok: true,
          data: updateOutreachAlertTarget(workspaceId, {
            enabled: typeof params.enabled === 'boolean' ? params.enabled : undefined,
            conversationId: typeof params.conversationId === 'string' ? params.conversationId : undefined,
            workerId: typeof params.workerId === 'string' ? params.workerId : undefined,
            label: typeof params.label === 'string' ? params.label : undefined,
          }),
        };
      },
    },
    {
      name: 'outreach-alert-test',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Send a test outreach alert to the configured Telegram target.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.worker.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return sendOutreachTelegramAlert({
          workspaceId,
          title: typeof params.title === 'string' ? params.title : 'Outreach alert test',
          message: typeof params.message === 'string' ? params.message : 'This is a test alert.',
          workerId: ctx?.worker.id,
        });
      },
    },
  ];
}

function createOutreachFollowUpTools(sessionId: string): Tool[] {
  return [
    {
      name: 'outreach-follow-up-list',
      description: 'List follow-up tasks and owner prompts for the outreach funnel.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          status: { type: 'string', enum: ['scheduled', 'sent', 'skipped', 'cancelled'] },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.worker.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return {
          ok: true,
          data: listFollowUpTasks(
            workspaceId,
            typeof params.status === 'string'
              ? (params.status as 'scheduled' | 'sent' | 'skipped' | 'cancelled')
              : undefined,
          ),
        };
      },
    },
    {
      name: 'outreach-follow-up-run',
      description: 'Process due follow-ups and owner prompts for this workspace.',
      parameters: {
        type: 'object',
        properties: { workspaceId: { type: 'string' } },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.worker.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return {
          ok: true,
          data: await processDueFollowUps(workspaceId),
          digest: buildWeeklyOwnerDigest(workspaceId),
        };
      },
    },
  ];
}

function createOutreachControlTools(sessionId: string): Tool[] {
  return [
    {
      name: 'outreach-control-get',
      description: 'Read the outreach pause state for this workspace.',
      parameters: { type: 'object', properties: { workspaceId: { type: 'string' } } },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.worker.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        const state = getOutreachControlState(workspaceId);
        return { ok: true, data: state, summary: outreachControlSummary(state) };
      },
    },
    {
      name: 'outreach-control-pause',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Pause outreach sends for this workspace until resumed.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          reason: { type: 'string' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.worker.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return {
          ok: true,
          data: pauseOutreach(workspaceId, typeof params.reason === 'string' ? params.reason : undefined, ctx?.worker.id),
        };
      },
    },
    {
      name: 'outreach-control-resume',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Resume outreach sends for this workspace.',
      parameters: {
        type: 'object',
        properties: { workspaceId: { type: 'string' } },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.worker.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return {
          ok: true,
          data: resumeOutreach(workspaceId, ctx?.worker.id),
        };
      },
    },
  ];
}

function createOutreachYouTubeTools(sessionId: string): Tool[] {
  return [
    {
      name: 'outreach-youtube-import',
      description: 'Import YouTube comment leads into the outreach lead store and keep nurture tags aligned.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          channelId: { type: 'string' },
          campaignId: { type: 'string' },
        },
        required: ['channelId'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.worker.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        const channelId = String(params.channelId ?? '').trim();
        if (!channelId) return { ok: false, error: 'channelId required' };
        return {
          ok: true,
          data: importYouTubeLeadsIntoOutreach({
            workspaceId,
            channelId,
            campaignId: typeof params.campaignId === 'string' ? params.campaignId : undefined,
          }),
        };
      },
    },
  ];
}

const SLUG_TO_TOOLS: Record<string, (sessionId: string) => Tool[]> = {
  gmail: createGmailTools,
  'google-drive': createDriveTools,
  'google-calendar': createCalendarTools,
  'google-sheets': createSheetsTools,
  'google-contacts': createContactsTools,
  'google-tasks': createTasksTools,
  github: createGithubTools,
  'slack-tool': createSlackToolTools,
  trello: createTrelloTools,
  'companies-house': createCompaniesHouseTools,
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
  for (const tool of createOutreachDiscoveryTools(sessionId)) {
    registerSessionTool(sessionId, tool);
    registered.push(tool.name);
  }
  for (const tool of createOutreachCadenceTools(sessionId)) {
    registerSessionTool(sessionId, tool);
    registered.push(tool.name);
  }
  for (const tool of createOutreachReplyTools(sessionId)) {
    registerSessionTool(sessionId, tool);
    registered.push(tool.name);
  }
  for (const tool of createOutreachBookingTools(sessionId)) {
    registerSessionTool(sessionId, tool);
    registered.push(tool.name);
  }
  // Canonical viCal tools (prompts aiva-vical-booking 04). Outreach tools above remain aliases for funnel utterances.
  for (const tool of createVicalBookingTools(sessionId)) {
    registerSessionTool(sessionId, tool);
    registered.push(tool.name);
  }
  for (const tool of createOutreachBoardTools(sessionId)) {
    registerSessionTool(sessionId, tool);
    registered.push(tool.name);
  }
  for (const tool of createOutreachAlertTools(sessionId)) {
    registerSessionTool(sessionId, tool);
    registered.push(tool.name);
  }
  for (const tool of createOutreachFollowUpTools(sessionId)) {
    registerSessionTool(sessionId, tool);
    registered.push(tool.name);
  }
  for (const tool of createOutreachControlTools(sessionId)) {
    registerSessionTool(sessionId, tool);
    registered.push(tool.name);
  }
  for (const tool of createOutreachYouTubeTools(sessionId)) {
    registerSessionTool(sessionId, tool);
    registered.push(tool.name);
  }
  return registered;
}
