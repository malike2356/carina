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
