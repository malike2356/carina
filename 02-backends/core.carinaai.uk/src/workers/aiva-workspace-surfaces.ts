import { pool } from '../memory/db.js';

function resolveAppBaseUrl(): string {
  return (
    process.env.AIVA_APP_PUBLIC_URL
    ?? process.env.AIVA_APP_URL
    ?? process.env.CARINA_HOSTED_APP_URL
    ?? 'https://admin.hireaiva.co.uk'
  )
    .trim()
    .replace(/\/$/, '');
}

async function appFetch(
  pathWithQuery: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const key = process.env.CARINA_INTERNAL_KEY?.trim();
  if (!key) {
    return { ok: false, status: 503, json: { error: 'CARINA_INTERNAL_KEY not set' } };
  }
  const url = `${resolveAppBaseUrl()}${pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': key,
        ...(init?.headers ?? {}),
      },
      signal: init?.signal ?? AbortSignal.timeout(30000),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, json };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      json: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}

export async function createWorkspaceResearchJob(input: {
  workspaceId: string;
  query: string;
  mode?: string;
  rounds?: number;
}): Promise<{ ok: boolean; data?: unknown; openUrl?: string; error?: string }> {
  const result = await appFetch('/api/internal/research/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!result.ok) {
    return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
  }
  return {
    ok: true,
    data: result.json.data,
    openUrl: typeof result.json.openUrl === 'string' ? result.json.openUrl : undefined,
  };
}

export async function listWorkspaceResearchJobs(input: {
  workspaceId: string;
  limit?: number;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const params = new URLSearchParams({ workspaceId: input.workspaceId });
  params.set('limit', String(Math.min(50, Math.max(1, input.limit ?? 10))));
  const result = await appFetch(`/api/internal/research/jobs?${params}`);
  if (!result.ok) {
    return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
  }
  return { ok: true, data: result.json.data };
}

export async function createWorkspaceDocument(input: {
  workspaceId: string;
  title: string;
  content: string;
  format?: 'markdown' | 'plain';
}): Promise<{ ok: boolean; data?: unknown; openUrl?: string; error?: string }> {
  const result = await appFetch('/api/internal/documents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!result.ok) {
    return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
  }
  return {
    ok: true,
    data: result.json.data,
    openUrl: typeof result.json.openUrl === 'string' ? result.json.openUrl : undefined,
  };
}

export async function listWorkspaceDocuments(input: {
  workspaceId: string;
  limit?: number;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const params = new URLSearchParams({ workspaceId: input.workspaceId });
  params.set('limit', String(Math.min(100, Math.max(1, input.limit ?? 20))));
  const result = await appFetch(`/api/internal/documents?${params}`);
  if (!result.ok) {
    return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
  }
  return { ok: true, data: result.json.data };
}

export async function getWorkspaceDocument(input: {
  workspaceId: string;
  id: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const params = new URLSearchParams({
    workspaceId: input.workspaceId,
    id: input.id,
  });
  const result = await appFetch(`/api/internal/documents?${params}`);
  if (!result.ok) {
    return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
  }
  return { ok: true, data: result.json.data };
}

export type WorkspaceNoteFormat = 'note' | 'task' | 'reminder';

export interface WorkspaceNoteRecord {
  id: string;
  title: string;
  content: string;
  format: WorkspaceNoteFormat;
  remindAt: string | null;
  pinned: boolean;
  archived: boolean;
  openUrl: string;
}

function cloudDatabaseUrl(): string | null {
  const explicit = process.env.CLOUD_DATABASE_URL?.trim()
    || process.env.CARINA_CLOUD_DATABASE_URL?.trim();
  if (explicit) return explicit;
  const base = process.env.DATABASE_URL?.trim();
  if (!base) return null;
  if (/\/carina_cloud(\?|$)/.test(base)) return base;
  if (/\/carina(\?|$)/.test(base)) return base.replace(/\/carina(\?|$)/, '/carina_cloud$1');
  return null;
}

function mapNoteRow(row: Record<string, unknown>): WorkspaceNoteRecord {
  const remindAt = row.reminder_at
    ? new Date(String(row.reminder_at)).toISOString()
    : null;
  const format: WorkspaceNoteFormat = remindAt
    ? 'reminder'
    : String(row.format ?? '').toLowerCase() === 'note'
      ? 'note'
      : 'task';
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    content: String(row.content ?? ''),
    format,
    remindAt,
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    openUrl: remindAt ? '/calendar' : '/notes',
  };
}

async function withCloudDb<T>(
  run: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>,
): Promise<T | null> {
  const url = cloudDatabaseUrl();
  if (!url) return null;
  const pg = await import('pg');
  const Client = pg.default?.Client ?? (pg as unknown as { Client: typeof pg.default.Client }).Client;
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    return await run(async (sql, params = []) => {
      const result = await client.query(sql, params);
      return { rows: result.rows as Array<Record<string, unknown>> };
    });
  } catch {
    return null;
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function createWorkspaceNote(input: {
  workspaceId: string;
  title: string;
  content?: string;
  format?: WorkspaceNoteFormat;
  remindAt?: string | null;
  pinned?: boolean;
}): Promise<{ ok: boolean; data?: WorkspaceNoteRecord; openUrl?: string; error?: string }> {
  const format = input.format ?? 'task';
  const title = input.title.trim() || 'Untitled task';
  const content = (input.content ?? title).trim() || title;
  let remindAt = input.remindAt?.trim() || null;
  if (format === 'reminder' && !remindAt) {
    remindAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  }
  const pinned = input.pinned ?? (format === 'task' || format === 'reminder');

  const result = await appFetch('/api/internal/notes', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      title,
      content,
      format,
      remindAt,
      pinned,
    }),
  });
  if (result.ok) {
    const raw = (result.json.data ?? {}) as Record<string, unknown>;
    const data = mapNoteRow({
      ...raw,
      reminder_at: raw.reminderAt ?? raw.reminder_at ?? remindAt,
      format,
    });
    return {
      ok: true,
      data,
      openUrl: typeof result.json.openUrl === 'string' ? result.json.openUrl : data.openUrl,
    };
  }

  const fallback = await withCloudDb(async (query) => {
    const rows = await query(
      `INSERT INTO user_notes (workspace_id, title, content, reminder_at, pinned)
       VALUES ($1::uuid, $2, $3, $4::timestamptz, $5)
       RETURNING id::text, title, content, reminder_at, pinned, archived`,
      [input.workspaceId, title, content, remindAt, pinned],
    );
    return rows.rows[0] ?? null;
  });
  if (fallback) {
    const data = mapNoteRow({ ...fallback, format });
    return { ok: true, data, openUrl: data.openUrl };
  }

  return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
}

export async function listWorkspaceNotes(input: {
  workspaceId: string;
  limit?: number;
  remindersOnly?: boolean;
}): Promise<{ ok: boolean; data?: WorkspaceNoteRecord[]; error?: string }> {
  const params = new URLSearchParams({ workspaceId: input.workspaceId });
  params.set('limit', String(Math.min(100, Math.max(1, input.limit ?? 20))));
  if (input.remindersOnly) params.set('reminders', '1');
  const result = await appFetch(`/api/internal/notes?${params}`);
  if (result.ok && Array.isArray(result.json.data)) {
    return {
      ok: true,
      data: (result.json.data as Array<Record<string, unknown>>).map((row) => mapNoteRow({
        ...row,
        reminder_at: row.reminderAt ?? row.reminder_at,
      })),
    };
  }

  const fallback = await withCloudDb(async (query) => {
    const sql = input.remindersOnly
      ? `SELECT id::text, title, content, reminder_at, pinned, archived
         FROM user_notes
         WHERE workspace_id = $1::uuid AND archived = false AND reminder_at IS NOT NULL
         ORDER BY pinned DESC, updated_at DESC
         LIMIT $2`
      : `SELECT id::text, title, content, reminder_at, pinned, archived
         FROM user_notes
         WHERE workspace_id = $1::uuid AND archived = false
         ORDER BY pinned DESC, updated_at DESC
         LIMIT $2`;
    const rows = await query(sql, [input.workspaceId, Math.min(100, Math.max(1, input.limit ?? 20))]);
    return rows.rows.map((row) => mapNoteRow(row));
  });
  if (fallback) return { ok: true, data: fallback };
  return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
}

export async function getWorkspaceNote(input: {
  workspaceId: string;
  id: string;
}): Promise<{ ok: boolean; data?: WorkspaceNoteRecord; error?: string }> {
  const params = new URLSearchParams({
    workspaceId: input.workspaceId,
    id: input.id,
  });
  const result = await appFetch(`/api/internal/notes?${params}`);
  if (result.ok && result.json.data && typeof result.json.data === 'object') {
    const raw = result.json.data as Record<string, unknown>;
    return {
      ok: true,
      data: mapNoteRow({
        ...raw,
        reminder_at: raw.reminderAt ?? raw.reminder_at,
      }),
    };
  }

  const fallback = await withCloudDb(async (query) => {
    const rows = await query(
      `SELECT id::text, title, content, reminder_at, pinned, archived
       FROM user_notes
       WHERE workspace_id = $1::uuid AND id = $2::uuid
       LIMIT 1`,
      [input.workspaceId, input.id],
    );
    return rows.rows[0] ?? null;
  });
  if (fallback) return { ok: true, data: mapNoteRow(fallback) };
  if (result.status === 404) return { ok: false, error: 'not found' };
  return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
}

export async function updateWorkspaceNote(input: {
  workspaceId: string;
  id: string;
  title?: string;
  content?: string;
  remindAt?: string | null;
  pinned?: boolean;
  done?: boolean;
}): Promise<{ ok: boolean; data?: WorkspaceNoteRecord; error?: string }> {
  const result = await appFetch('/api/internal/notes', {
    method: 'PATCH',
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      id: input.id,
      title: input.title,
      content: input.content,
      remindAt: input.remindAt,
      pinned: input.pinned,
      done: input.done,
    }),
  });
  if (result.ok && result.json.data && typeof result.json.data === 'object') {
    const raw = result.json.data as Record<string, unknown>;
    return {
      ok: true,
      data: mapNoteRow({
        ...raw,
        reminder_at: raw.reminderAt ?? raw.reminder_at,
      }),
    };
  }

  const fallback = await withCloudDb(async (query) => {
    const rows = await query(
      `UPDATE user_notes
       SET
         title = COALESCE($3, title),
         content = COALESCE($4, content),
         reminder_at = CASE
           WHEN $5::text = '__UNSET__' THEN reminder_at
           WHEN $5::text IS NULL THEN NULL
           ELSE $5::timestamptz
         END,
         pinned = COALESCE($6, pinned),
         archived = CASE WHEN $7::boolean = true THEN true ELSE archived END,
         updated_at = NOW()
       WHERE workspace_id = $1::uuid AND id = $2::uuid
       RETURNING id::text, title, content, reminder_at, pinned, archived`,
      [
        input.workspaceId,
        input.id,
        input.title ?? null,
        input.content ?? null,
        input.remindAt === undefined ? '__UNSET__' : input.remindAt,
        input.pinned ?? null,
        input.done === true,
      ],
    );
    return rows.rows[0] ?? null;
  });
  if (fallback) return { ok: true, data: mapNoteRow(fallback) };
  if (result.status === 404) return { ok: false, error: 'not found' };
  return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
}

export async function deleteWorkspaceNote(input: {
  workspaceId: string;
  id: string;
  hard?: boolean;
}): Promise<{ ok: boolean; data?: { id: string; archived?: boolean; deleted?: boolean }; error?: string }> {
  const result = await appFetch('/api/internal/notes', {
    method: 'DELETE',
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      id: input.id,
      hard: input.hard === true,
    }),
  });
  if (result.ok) {
    return {
      ok: true,
      data: {
        id: input.id,
        archived: input.hard !== true,
        deleted: input.hard === true,
      },
    };
  }

  const fallback = await withCloudDb(async (query) => {
    if (input.hard) {
      const rows = await query(
        `DELETE FROM user_notes
         WHERE workspace_id = $1::uuid AND id = $2::uuid
         RETURNING id::text`,
        [input.workspaceId, input.id],
      );
      return rows.rows[0] ?? null;
    }
    const rows = await query(
      `UPDATE user_notes
       SET archived = true, updated_at = NOW()
       WHERE workspace_id = $1::uuid AND id = $2::uuid
       RETURNING id::text, archived`,
      [input.workspaceId, input.id],
    );
    return rows.rows[0] ?? null;
  });
  if (fallback) {
    return {
      ok: true,
      data: {
        id: input.id,
        archived: input.hard !== true,
        deleted: input.hard === true,
      },
    };
  }
  if (result.status === 404) return { ok: false, error: 'not found' };
  return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
}

/** Normalize reminder titles for near-duplicate detection. */
export function normalizeReminderDedupeKey(title: string, content?: string): string {
  const raw = `${title} ${content ?? ''}`.toLowerCase();
  return raw
    .replace(/\b(reminder|task|todo|follow-?up|id test|request your|added after|claimed done|without saving)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(key: string): string[] {
  return key
    .split(' ')
    .filter((token) => token.length >= 4)
    .filter((token) => !['from', 'with', 'that', 'this', 'your', 'have', 'been'].includes(token));
}

export function remindersLookSimilar(aTitle: string, aContent: string | undefined, bTitle: string, bContent: string | undefined): boolean {
  const a = normalizeReminderDedupeKey(aTitle, aContent);
  const b = normalizeReminderDedupeKey(bTitle, bContent);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const aTokens = new Set(significantTokens(a));
  const bTokens = significantTokens(b);
  if (aTokens.size === 0 || bTokens.length === 0) return false;
  const overlap = bTokens.filter((token) => aTokens.has(token)).length;
  const minSize = Math.min(aTokens.size, bTokens.length);
  return overlap >= 2 && overlap / minSize >= 0.6;
}

export async function findSimilarActiveReminder(input: {
  workspaceId: string;
  title: string;
  content?: string;
}): Promise<WorkspaceNoteRecord | null> {
  const key = normalizeReminderDedupeKey(input.title, input.content);
  if (key.length < 8) return null;
  const listed = await listWorkspaceNotes({
    workspaceId: input.workspaceId,
    limit: 50,
    remindersOnly: true,
  });
  if (!listed.ok || !listed.data?.length) return null;
  for (const note of listed.data) {
    if (note.archived) continue;
    if (remindersLookSimilar(input.title, input.content, note.title, note.content)) {
      return note;
    }
  }
  return null;
}

export async function getWorkspaceInventory(input: {
  workspaceId: string;
  workerId?: string;
  limit?: number;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const params = new URLSearchParams({ workspaceId: input.workspaceId });
  params.set('limit', String(Math.min(50, Math.max(1, input.limit ?? 10))));
  const result = await appFetch(`/api/internal/workspace/inventory?${params}`);
  if (!result.ok) {
    if (result.status === 404 || result.status === 503) {
      const sections = await getCoreInventorySections(
        input.workspaceId,
        input.workerId,
        Math.min(50, Math.max(1, input.limit ?? 10)),
      );
      return {
        ok: true,
        data: {
          workspaceId: input.workspaceId,
          sections,
          source: 'core',
        },
      };
    }
    return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
  }
  const data = await mergeCoreInventorySections(result.json.data, input);
  return { ok: true, data };
}

async function mergeCoreInventorySections(
  appData: unknown,
  input: { workspaceId: string; workerId?: string; limit?: number },
): Promise<unknown> {
  if (!appData || typeof appData !== 'object') return appData;
  const data = appData as {
    sections?: Record<string, unknown>;
  };
  const sections = data.sections && typeof data.sections === 'object' ? data.sections : {};
  const limit = Math.min(50, Math.max(1, input.limit ?? 10));
  const coreSections = await getCoreInventorySections(input.workspaceId, input.workerId, limit);
  return {
    ...data,
    sections: {
      ...sections,
      ...coreSections,
    },
  };
}

async function getCoreInventorySections(
  workspaceId: string,
  workerId: string | undefined,
  limit: number,
): Promise<Record<string, unknown>> {
  const [aivas, channels, automations, approvals, skills] = await Promise.all([
    inventorySection('aivas', () => pool.query(
      `SELECT id::text, name, role_description, template_id, skill_packs, channels,
              language, status, created_at, updated_at
       FROM ai_workers
       WHERE workspace_id = $1 AND status != 'dismissed'
       ORDER BY created_at DESC
       LIMIT $2`,
      [workspaceId, limit],
    )),
    inventorySection('channels', () => pool.query(
      `SELECT id::text, worker_id::text, channel, identifier, enabled, connected_at, updated_at
       FROM ai_worker_channels
       WHERE workspace_id = $1
       ORDER BY connected_at DESC
       LIMIT $2`,
      [workspaceId, limit],
    )),
    inventorySection('automations', () => pool.query(
      `SELECT id::text, worker_id::text, name, description, cron_expression,
              schedule_label, trigger_type, trigger_event, enabled, last_run_at,
              next_run_at, created_at
       FROM ai_worker_automations
       WHERE workspace_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [workspaceId, limit],
    )),
    inventorySection('approvals', () => pool.query(
      `SELECT id, worker_id, type, category, recipient, subject, status, requested_at
       FROM (
         SELECT id::text, worker_id::text, 'email' AS type, category, recipient,
                subject, status, requested_at
         FROM worker_email_approvals
         WHERE workspace_id = $1
         UNION ALL
         SELECT id::text, worker_id::text, 'social' AS type, channel AS category,
                contact_id AS recipient, left(draft_text, 120) AS subject, status, requested_at
         FROM worker_social_approvals
         WHERE workspace_id = $1
       ) approvals
       ORDER BY requested_at DESC
       LIMIT $2`,
      [workspaceId, limit],
    )),
    workerId
      ? inventorySection('skills', () => pool.query(
        `SELECT id::text, tool_slug, scopes, status, meta, created_at, updated_at
         FROM aiva_worker_tool_grants
         WHERE workspace_id = $1 AND worker_id = $2
         ORDER BY tool_slug
         LIMIT $3`,
        [workspaceId, workerId, limit],
      ))
      : Promise.resolve({
        available: false,
        items: [],
        count: 0,
        error: 'Current worker id unavailable for skill grant inventory',
      }),
  ]);

  return { aivas, channels, automations, approvals, skills };
}

async function inventorySection(
  name: string,
  query: () => Promise<{ rows: Array<Record<string, unknown>> }>,
): Promise<{ available: boolean; items: Array<Record<string, unknown>>; count: number; error?: string }> {
  try {
    const result = await query();
    return { available: true, items: result.rows, count: result.rows.length };
  } catch (err) {
    return {
      available: false,
      items: [],
      count: 0,
      error: `${name}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
