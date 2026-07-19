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
      description: 'Fetch one Gmail message by id (subject, from, body text). Use after gmail-list.',
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
        + 'Prefer this over email-smtp-send / email-send when Gmail is connected.',
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
        return invokeGranted(sessionId, 'gmail', 'send', { to, subject, body });
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

const SLUG_TO_TOOLS: Record<string, (sessionId: string) => Tool[]> = {
  gmail: createGmailTools,
  'google-drive': createDriveTools,
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
