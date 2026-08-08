import { pool } from '../memory/db.js';
import { encryptCredentials, decryptCredentials } from '../channels/credential-store.js';
import { listPublicProductTools, getCatalogTool } from './product-tools/catalog.js';

let schemaReady: Promise<void> | null = null;

export function getAivaProductTools() {
  return listPublicProductTools().map((tool) => ({
    slug: tool.slug,
    label: tool.label,
    scopes: tool.scopes,
    category: tool.category,
    status: tool.status,
    auth: tool.auth,
    oauthProvider: tool.oauthProvider,
    configFields: tool.configFields,
  }));
}

/** @deprecated Prefer getAivaProductTools() (config-driven, may change after reload). */
export const AIVA_PRODUCT_TOOLS = new Proxy([] as ReturnType<typeof getAivaProductTools>, {
  get(_target, prop, receiver) {
    const tools = getAivaProductTools();
    if (prop === 'length') return tools.length;
    if (prop === Symbol.iterator) return tools[Symbol.iterator].bind(tools);
    if (typeof prop === 'string' && /^\d+$/.test(prop)) return tools[Number(prop)];
    const value = Reflect.get(tools, prop, receiver);
    return typeof value === 'function' ? value.bind(tools) : value;
  },
});

export type AivaProductToolSlug = string;

export async function ensureAivaParitySchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_worker_tool_grants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL,
          worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
          tool_slug TEXT NOT NULL,
          scopes TEXT[] NOT NULL DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'connected',
          credentials_enc TEXT,
          meta JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (worker_id, tool_slug)
        );
        CREATE TABLE IF NOT EXISTS aiva_worker_vault_secrets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL,
          worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
          label TEXT NOT NULL,
          kind TEXT NOT NULL DEFAULT 'api_key',
          ciphertext TEXT NOT NULL,
          last4 TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_used_at TIMESTAMPTZ,
          UNIQUE (worker_id, label)
        );
        CREATE TABLE IF NOT EXISTS aiva_worker_skills (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL,
          worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          trigger_hints TEXT[] NOT NULL DEFAULT '{}',
          steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          tool_slugs TEXT[] NOT NULL DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS aiva_projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL,
          worker_id UUID REFERENCES ai_workers(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'planned',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS aiva_project_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES aiva_projects(id) ON DELETE CASCADE,
          item_type TEXT NOT NULL,
          item_ref TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS aiva_onboarding_progress (
          worker_id UUID PRIMARY KEY REFERENCES ai_workers(id) ON DELETE CASCADE,
          workspace_id UUID NOT NULL,
          plan_id TEXT NOT NULL,
          steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          completed_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS aiva_whatsapp_number_assignments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL,
          worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
          path TEXT NOT NULL DEFAULT 'dedicated',
          phone_e164 TEXT NOT NULL DEFAULT '',
          phone_number_id TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pending',
          meta JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (worker_id)
        );
        CREATE TABLE IF NOT EXISTS aiva_worker_comanagers (
          workspace_id UUID NOT NULL,
          worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
          user_email TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'co_manager',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (worker_id, user_email)
        );
        CREATE TABLE IF NOT EXISTS aiva_worker_memories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL,
          worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
          kind TEXT NOT NULL DEFAULT 'preference',
          content TEXT NOT NULL,
          pinned BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE aiva_worker_comanagers
          ADD COLUMN IF NOT EXISTS manager_worker_id UUID REFERENCES ai_workers(id) ON DELETE CASCADE;
      `);
    })();
  }
  return schemaReady;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

type ToolGrantLike = {
  id: string;
  toolSlug: string;
  scopes: string[];
  status: string;
  meta: Record<string, unknown>;
  lastProbeOk: boolean | null;
  lastProbeError: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listToolGrants(workspaceId: string, workerId: string) {
  await ensureAivaParitySchema();
  const result = await pool.query(
    `SELECT id, tool_slug, scopes, status, meta, last_probe_ok, last_probe_error, created_at, updated_at
     FROM aiva_worker_tool_grants WHERE workspace_id = $1 AND worker_id = $2
     ORDER BY tool_slug`,
    [workspaceId, workerId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    toolSlug: String(row.tool_slug),
    scopes: asStringArray(row.scopes),
    status: String(row.status),
    meta: row.meta ?? {},
    lastProbeOk: row.last_probe_ok === null || row.last_probe_ok === undefined
      ? null
      : Boolean(row.last_probe_ok),
    lastProbeError: row.last_probe_error ? String(row.last_probe_error) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  }));
}

async function listWorkerAccountToolGrants(workspaceId: string, workerId: string): Promise<ToolGrantLike[]> {
  try {
    const result = await pool.query(
      `SELECT account_id, tool_slug, scopes, status, created_at, updated_at
       FROM aiva_worker_tool_account_grants
       WHERE workspace_id = $1 AND worker_id = $2
       ORDER BY tool_slug`,
      [workspaceId, workerId],
    );
    return result.rows.map((row) => ({
      id: `account:${String(row.account_id)}`,
      toolSlug: String(row.tool_slug),
      scopes: asStringArray(row.scopes),
      status: String(row.status),
      meta: { accountId: String(row.account_id) },
      lastProbeOk: null,
      lastProbeError: null,
      createdAt: new Date(String(row.created_at)).toISOString(),
      updatedAt: new Date(String(row.updated_at)).toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function listEffectiveToolGrants(
  workspaceId: string,
  workerId: string,
): Promise<ToolGrantLike[]> {
  const [toolGrants, accountGrants] = await Promise.all([
    listToolGrants(workspaceId, workerId),
    listWorkerAccountToolGrants(workspaceId, workerId),
  ]);
  const merged = new Map<string, ToolGrantLike>();
  const rank = (status: string): number => {
    const normalized = status.toLowerCase();
    if (normalized === 'connected' || normalized === 'ready') return 0;
    if (normalized === 'pending_probe') return 1;
    if (normalized === 'needs_reauth' || normalized === 'error') return 2;
    return 3;
  };

  for (const grant of [...toolGrants, ...accountGrants]) {
    const current = merged.get(grant.toolSlug);
    if (!current) {
      merged.set(grant.toolSlug, grant);
      continue;
    }
    const currentRank = rank(String(current.status ?? ''));
    const nextRank = rank(String(grant.status ?? ''));
    if (nextRank < currentRank) {
      merged.set(grant.toolSlug, grant);
      continue;
    }
    if (nextRank === currentRank) {
      const currentUpdated = Date.parse(String(current.updatedAt ?? '')) || 0;
      const nextUpdated = Date.parse(String(grant.updatedAt ?? '')) || 0;
      if (nextUpdated > currentUpdated) {
        merged.set(grant.toolSlug, grant);
      }
    }
  }

  return [...merged.values()];
}

export async function upsertToolGrant(input: {
  workspaceId: string;
  workerId: string;
  toolSlug: string;
  scopes: string[];
  credentials?: Record<string, string>;
  status?: string;
}) {
  await ensureAivaParitySchema();
  const enc = input.credentials && Object.keys(input.credentials).length > 0
    ? encryptCredentials(input.credentials)
    : null;
  const result = await pool.query(
    `INSERT INTO aiva_worker_tool_grants
      (workspace_id, worker_id, tool_slug, scopes, status, credentials_enc, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (worker_id, tool_slug) DO UPDATE SET
       scopes = EXCLUDED.scopes,
       status = EXCLUDED.status,
       credentials_enc = COALESCE(EXCLUDED.credentials_enc, aiva_worker_tool_grants.credentials_enc),
       updated_at = NOW()
     RETURNING id, tool_slug, scopes, status, created_at, updated_at`,
    [
      input.workspaceId,
      input.workerId,
      input.toolSlug,
      input.scopes,
      input.status ?? 'connected',
      enc,
    ],
  );
  const row = result.rows[0];
  return {
    id: String(row.id),
    toolSlug: String(row.tool_slug),
    scopes: asStringArray(row.scopes),
    status: String(row.status),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function deleteToolGrant(workspaceId: string, workerId: string, toolSlug: string) {
  await ensureAivaParitySchema();
  await pool.query(
    `DELETE FROM aiva_worker_tool_grants WHERE workspace_id = $1 AND worker_id = $2 AND tool_slug = $3`,
    [workspaceId, workerId, toolSlug],
  );
}

export async function workerHasToolGrant(
  workspaceId: string,
  workerId: string,
  toolSlug: string,
  scope?: string,
): Promise<boolean> {
  await ensureAivaParitySchema();
  const grant = (await listEffectiveToolGrants(workspaceId, workerId))
    .find((row) => row.toolSlug === toolSlug && row.status === 'connected');
  if (!grant) return false;
  if (!scope) return true;
  return asStringArray(grant.scopes).includes(scope);
}

export async function listVaultSecrets(workspaceId: string, workerId: string) {
  await ensureAivaParitySchema();
  const result = await pool.query(
    `SELECT id, label, kind, last4, created_at, updated_at, last_used_at
     FROM aiva_worker_vault_secrets WHERE workspace_id = $1 AND worker_id = $2
     ORDER BY label`,
    [workspaceId, workerId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    label: String(row.label),
    kind: String(row.kind),
    last4: String(row.last4),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    lastUsedAt: row.last_used_at ? new Date(String(row.last_used_at)).toISOString() : null,
  }));
}

export async function createVaultSecret(input: {
  workspaceId: string;
  workerId: string;
  label: string;
  kind?: string;
  value: string;
}) {
  await ensureAivaParitySchema();
  const label = input.label.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  if (!label) throw new Error('label is required');
  const value = input.value.trim();
  if (!value) throw new Error('value is required');
  const ciphertext = encryptCredentials({ value });
  const last4 = value.slice(-4);
  const result = await pool.query(
    `INSERT INTO aiva_worker_vault_secrets
      (workspace_id, worker_id, label, kind, ciphertext, last4, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (worker_id, label) DO UPDATE SET
       kind = EXCLUDED.kind,
       ciphertext = EXCLUDED.ciphertext,
       last4 = EXCLUDED.last4,
       updated_at = NOW()
     RETURNING id, label, kind, last4, created_at, updated_at`,
    [input.workspaceId, input.workerId, label, input.kind ?? 'api_key', ciphertext, last4],
  );
  const row = result.rows[0];
  return {
    id: String(row.id),
    label: String(row.label),
    kind: String(row.kind),
    last4: String(row.last4),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function deleteVaultSecret(workspaceId: string, workerId: string, secretId: string) {
  await ensureAivaParitySchema();
  await pool.query(
    `DELETE FROM aiva_worker_vault_secrets WHERE workspace_id = $1 AND worker_id = $2 AND id = $3`,
    [workspaceId, workerId, secretId],
  );
}

export async function resolveVaultSecret(
  workspaceId: string,
  workerId: string,
  label: string,
): Promise<string | null> {
  await ensureAivaParitySchema();
  const result = await pool.query(
    `SELECT id, ciphertext FROM aiva_worker_vault_secrets
     WHERE workspace_id = $1 AND worker_id = $2 AND label = $3`,
    [workspaceId, workerId, label.trim().toLowerCase()],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const unlocked = decryptCredentials(String(row.ciphertext));
  await pool.query(`UPDATE aiva_worker_vault_secrets SET last_used_at = NOW() WHERE id = $1`, [row.id]);
  return unlocked.value ?? null;
}

export async function listWorkerSkills(workspaceId: string, workerId: string) {
  await ensureAivaParitySchema();
  const result = await pool.query(
    `SELECT * FROM aiva_worker_skills WHERE workspace_id = $1 AND worker_id = $2 ORDER BY updated_at DESC`,
    [workspaceId, workerId],
  );
  return result.rows.map(mapSkill);
}

function mapSkill(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ''),
    triggerHints: asStringArray(row.trigger_hints),
    steps: Array.isArray(row.steps_json) ? row.steps_json : [],
    toolSlugs: asStringArray(row.tool_slugs),
    status: String(row.status ?? 'active'),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function createWorkerSkill(input: {
  workspaceId: string;
  workerId: string;
  title: string;
  description?: string;
  steps?: unknown[];
  toolSlugs?: string[];
  triggerHints?: string[];
}) {
  await ensureAivaParitySchema();
  const title = input.title.trim();
  if (!title) throw new Error('title is required');
  const result = await pool.query(
    `INSERT INTO aiva_worker_skills
      (workspace_id, worker_id, title, description, trigger_hints, steps_json, tool_slugs)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING *`,
    [
      input.workspaceId,
      input.workerId,
      title,
      input.description?.trim() ?? '',
      input.triggerHints ?? [],
      JSON.stringify(input.steps ?? []),
      input.toolSlugs ?? [],
    ],
  );
  return mapSkill(result.rows[0]);
}

export async function runWorkerSkill(workspaceId: string, workerId: string, skillId: string) {
  await ensureAivaParitySchema();
  const result = await pool.query(
    `SELECT * FROM aiva_worker_skills WHERE workspace_id = $1 AND worker_id = $2 AND id = $3 AND status = 'active'`,
    [workspaceId, workerId, skillId],
  );
  if (result.rows.length === 0) throw new Error('Skill not found');
  const skill = mapSkill(result.rows[0]);
  return {
    skill,
    prompt: [
      `Run saved skill "${skill.title}".`,
      skill.description ? `Description: ${skill.description}` : '',
      'Steps:',
      ...skill.steps.map((step, index) => `${index + 1}. ${typeof step === 'string' ? step : JSON.stringify(step)}`),
    ].filter(Boolean).join('\n'),
  };
}

export async function listProjects(workspaceId: string, workerId?: string, orgId?: string | null) {
  await ensureAivaParitySchema();
  await pool.query(`ALTER TABLE aiva_projects ADD COLUMN IF NOT EXISTS org_id UUID`);
  let result;
  if (workerId && orgId) {
    result = await pool.query(
      `SELECT * FROM aiva_projects WHERE workspace_id = $1
         AND (worker_id = $2 OR worker_id IS NULL)
         AND (org_id IS NULL OR org_id = $3::uuid)
       ORDER BY updated_at DESC`,
      [workspaceId, workerId, orgId],
    );
  } else if (workerId) {
    result = await pool.query(
      `SELECT * FROM aiva_projects WHERE workspace_id = $1 AND (worker_id = $2 OR worker_id IS NULL)
       ORDER BY updated_at DESC`,
      [workspaceId, workerId],
    );
  } else if (orgId) {
    result = await pool.query(
      `SELECT * FROM aiva_projects WHERE workspace_id = $1 AND (org_id IS NULL OR org_id = $2::uuid)
       ORDER BY updated_at DESC`,
      [workspaceId, orgId],
    );
  } else {
    result = await pool.query(
      `SELECT * FROM aiva_projects WHERE workspace_id = $1 ORDER BY updated_at DESC`,
      [workspaceId],
    );
  }
  return result.rows.map((row) => ({
    id: String(row.id),
    workerId: row.worker_id ? String(row.worker_id) : null,
    orgId: row.org_id ? String(row.org_id) : null,
    title: String(row.title),
    description: String(row.description ?? ''),
    status: String(row.status),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  }));
}

export async function createProject(input: {
  workspaceId: string;
  workerId?: string | null;
  orgId?: string | null;
  title: string;
  description?: string;
  status?: string;
}) {
  await ensureAivaParitySchema();
  await pool.query(`ALTER TABLE aiva_projects ADD COLUMN IF NOT EXISTS org_id UUID`);
  const title = input.title.trim();
  if (!title) throw new Error('title is required');
  const result = await pool.query(
    `INSERT INTO aiva_projects (workspace_id, worker_id, org_id, title, description, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      input.workspaceId,
      input.workerId ?? null,
      input.orgId ?? null,
      title,
      input.description?.trim() ?? '',
      input.status ?? 'planned',
    ],
  );
  const row = result.rows[0];
  return {
    id: String(row.id),
    workerId: row.worker_id ? String(row.worker_id) : null,
    orgId: row.org_id ? String(row.org_id) : null,
    title: String(row.title),
    description: String(row.description ?? ''),
    status: String(row.status),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapProjectRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    workerId: row.worker_id ? String(row.worker_id) : null,
    orgId: row.org_id ? String(row.org_id) : null,
    title: String(row.title),
    description: String(row.description ?? ''),
    status: String(row.status),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  patch: {
    status?: string;
    workerId?: string | null;
    title?: string;
    description?: string;
  },
) {
  await ensureAivaParitySchema();
  await pool.query(`ALTER TABLE aiva_projects ADD COLUMN IF NOT EXISTS org_id UUID`);
  const sets: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [workspaceId, projectId];
  let i = 3;

  if (typeof patch.status === 'string' && patch.status.trim()) {
    sets.push(`status = $${i++}`);
    values.push(patch.status.trim());
  }
  if (patch.workerId !== undefined) {
    sets.push(`worker_id = $${i++}`);
    values.push(patch.workerId || null);
  }
  if (typeof patch.title === 'string') {
    const title = patch.title.trim();
    if (!title) throw new Error('title is required');
    sets.push(`title = $${i++}`);
    values.push(title);
  }
  if (typeof patch.description === 'string') {
    sets.push(`description = $${i++}`);
    values.push(patch.description.trim());
  }

  if (sets.length === 1) {
    const existing = await pool.query(
      `SELECT * FROM aiva_projects WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, projectId],
    );
    if (existing.rows.length === 0) return null;
    return mapProjectRow(existing.rows[0] as Record<string, unknown>);
  }

  const result = await pool.query(
    `UPDATE aiva_projects SET ${sets.join(', ')}
     WHERE workspace_id = $1 AND id = $2 RETURNING *`,
    values,
  );
  if (result.rows.length === 0) return null;
  return mapProjectRow(result.rows[0] as Record<string, unknown>);
}

export async function updateProjectStatus(
  workspaceId: string,
  projectId: string,
  status: string,
) {
  return updateProject(workspaceId, projectId, { status });
}

export async function listProjectItems(workspaceId: string, projectId: string) {
  await ensureAivaParitySchema();
  const owned = await pool.query(
    `SELECT id FROM aiva_projects WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, projectId],
  );
  if (owned.rows.length === 0) throw new Error('Project not found');
  const result = await pool.query(
    `SELECT * FROM aiva_project_items WHERE project_id = $1 ORDER BY created_at ASC`,
    [projectId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    itemType: String(row.item_type),
    itemRef: String(row.item_ref ?? ''),
    title: String(row.title ?? ''),
    createdAt: new Date(String(row.created_at)).toISOString(),
  }));
}

export async function addProjectItem(input: {
  workspaceId: string;
  projectId: string;
  itemType: string;
  itemRef?: string;
  title?: string;
}) {
  await ensureAivaParitySchema();
  const owned = await pool.query(
    `SELECT id FROM aiva_projects WHERE workspace_id = $1 AND id = $2`,
    [input.workspaceId, input.projectId],
  );
  if (owned.rows.length === 0) throw new Error('Project not found');
  const result = await pool.query(
    `INSERT INTO aiva_project_items (project_id, item_type, item_ref, title)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.projectId, input.itemType, input.itemRef ?? '', input.title ?? ''],
  );
  const row = result.rows[0];
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    itemType: String(row.item_type),
    itemRef: String(row.item_ref ?? ''),
    title: String(row.title ?? ''),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export const ONBOARDING_PLANS = [
  {
    id: 'ea-calendar',
    title: 'Executive assistant: calendar',
    steps: [
      { id: 'connect-calendar', label: 'Connect Google Calendar' },
      { id: 'share-prefs', label: 'Add scheduling preferences to Knowledge' },
      { id: 'first-chat', label: 'Ask your worker for tomorrow\'s agenda' },
      { id: 'first-automation', label: 'Create a daily briefing automation' },
    ],
  },
  {
    id: 'helpdesk',
    title: 'IT helpdesk starter',
    steps: [
      { id: 'connect-channel', label: 'Connect email or WhatsApp' },
      { id: 'upload-faq', label: 'Upload an FAQ to Knowledge' },
      { id: 'test-reply', label: 'Send a test support question in Chat' },
      { id: 'save-skill', label: 'Save the reply flow as a Skill' },
    ],
  },
] as const;

export async function getOnboardingProgress(workspaceId: string, workerId: string) {
  await ensureAivaParitySchema();
  const result = await pool.query(
    `SELECT * FROM aiva_onboarding_progress WHERE workspace_id = $1 AND worker_id = $2`,
    [workspaceId, workerId],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    planId: String(row.plan_id),
    steps: Array.isArray(row.steps_json) ? row.steps_json : [],
    completedAt: row.completed_at ? new Date(String(row.completed_at)).toISOString() : null,
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function startOnboardingPlan(input: {
  workspaceId: string;
  workerId: string;
  planId: string;
}) {
  await ensureAivaParitySchema();
  const plan = ONBOARDING_PLANS.find((item) => item.id === input.planId);
  if (!plan) throw new Error('Unknown plan');
  const steps = plan.steps.map((step) => ({ ...step, done: false }));
  await pool.query(
    `INSERT INTO aiva_onboarding_progress (worker_id, workspace_id, plan_id, steps_json, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW())
     ON CONFLICT (worker_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       steps_json = EXCLUDED.steps_json,
       completed_at = NULL,
       updated_at = NOW()`,
    [input.workerId, input.workspaceId, plan.id, JSON.stringify(steps)],
  );
  return getOnboardingProgress(input.workspaceId, input.workerId);
}

export async function completeOnboardingStep(input: {
  workspaceId: string;
  workerId: string;
  stepId: string;
}) {
  const progress = await getOnboardingProgress(input.workspaceId, input.workerId);
  if (!progress) throw new Error('No onboarding plan started');
  const steps = progress.steps.map((step: { id?: string; done?: boolean }) =>
    step.id === input.stepId ? { ...step, done: true } : step,
  );
  const allDone = steps.every((step: { done?: boolean }) => step.done);
  await pool.query(
    `UPDATE aiva_onboarding_progress
     SET steps_json = $3::jsonb,
         completed_at = CASE WHEN $4 THEN NOW() ELSE completed_at END,
         updated_at = NOW()
     WHERE workspace_id = $1 AND worker_id = $2`,
    [input.workspaceId, input.workerId, JSON.stringify(steps), allDone],
  );
  return getOnboardingProgress(input.workspaceId, input.workerId);
}

export async function upsertWhatsAppNumber(input: {
  workspaceId: string;
  workerId: string;
  path: string;
  phoneE164?: string;
  phoneNumberId?: string;
  status?: string;
}) {
  await ensureAivaParitySchema();
  const result = await pool.query(
    `INSERT INTO aiva_whatsapp_number_assignments
      (workspace_id, worker_id, path, phone_e164, phone_number_id, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (worker_id) DO UPDATE SET
       path = EXCLUDED.path,
       phone_e164 = EXCLUDED.phone_e164,
       phone_number_id = EXCLUDED.phone_number_id,
       status = EXCLUDED.status,
       updated_at = NOW()
     RETURNING *`,
    [
      input.workspaceId,
      input.workerId,
      input.path,
      input.phoneE164 ?? '',
      input.phoneNumberId ?? '',
      input.status ?? 'pending',
    ],
  );
  const row = result.rows[0];
  return {
    id: String(row.id),
    path: String(row.path),
    phoneE164: String(row.phone_e164 ?? ''),
    phoneNumberId: String(row.phone_number_id ?? ''),
    status: String(row.status),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function getWhatsAppNumber(workspaceId: string, workerId: string) {
  await ensureAivaParitySchema();
  const result = await pool.query(
    `SELECT * FROM aiva_whatsapp_number_assignments WHERE workspace_id = $1 AND worker_id = $2`,
    [workspaceId, workerId],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: String(row.id),
    path: String(row.path),
    phoneE164: String(row.phone_e164 ?? ''),
    phoneNumberId: String(row.phone_number_id ?? ''),
    status: String(row.status),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function listCoManagers(workspaceId: string, workerId: string) {
  await ensureAivaParitySchema();
  const result = await pool.query(
    `SELECT user_email, role, manager_worker_id, created_at FROM aiva_worker_comanagers
     WHERE workspace_id = $1 AND worker_id = $2 ORDER BY created_at`,
    [workspaceId, workerId],
  );
  return result.rows.map((row) => ({
    email: String(row.user_email),
    role: String(row.role),
    managerWorkerId: row.manager_worker_id ? String(row.manager_worker_id) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  }));
}

export async function addCoManager(input: {
  workspaceId: string;
  workerId: string;
  email?: string;
  managerWorkerId?: string;
  role?: string;
}) {
  await ensureAivaParitySchema();
  const managerWorkerId = input.managerWorkerId?.trim();
  if (managerWorkerId) {
    const { loadDepthFeatures } = await import('./product-tools/features.js');
    if (!loadDepthFeatures().orgs.workersAsManagers) {
      throw new Error('Workers-as-managers disabled in depth-features config');
    }
    if (managerWorkerId === input.workerId) throw new Error('Worker cannot manage itself');
    await requireWorkerExists(input.workspaceId, managerWorkerId);
    const sentinel = `worker:${managerWorkerId}@managers.aiva`;
    await pool.query(
      `INSERT INTO aiva_worker_comanagers (workspace_id, worker_id, user_email, role, manager_worker_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (worker_id, user_email) DO UPDATE SET
         role = EXCLUDED.role,
         manager_worker_id = EXCLUDED.manager_worker_id`,
      [input.workspaceId, input.workerId, sentinel, input.role ?? 'manager_worker', managerWorkerId],
    );
    return listCoManagers(input.workspaceId, input.workerId);
  }
  const email = (input.email ?? '').trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Valid email required');
  await pool.query(
    `INSERT INTO aiva_worker_comanagers (workspace_id, worker_id, user_email, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (worker_id, user_email) DO UPDATE SET role = EXCLUDED.role`,
    [input.workspaceId, input.workerId, email, input.role ?? 'co_manager'],
  );
  return listCoManagers(input.workspaceId, input.workerId);
}

async function requireWorkerExists(workspaceId: string, workerId: string) {
  const { getWorker } = await import('./worker-store.js');
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) throw new Error('Manager worker not found in this workspace');
}

export async function removeCoManager(workspaceId: string, workerId: string, email: string) {
  await ensureAivaParitySchema();
  await pool.query(
    `DELETE FROM aiva_worker_comanagers WHERE workspace_id = $1 AND worker_id = $2 AND user_email = $3`,
    [workspaceId, workerId, email.trim().toLowerCase()],
  );
}

/** Fail-closed: manager workers may not read peer vault secrets. */
export async function assertNotManagerWorkerVaultAccess(
  workspaceId: string,
  actingManagerWorkerId: string | undefined,
  targetWorkerId: string,
): Promise<void> {
  if (!actingManagerWorkerId || actingManagerWorkerId === targetWorkerId) return;
  const { loadDepthFeatures } = await import('./product-tools/features.js');
  if (!loadDepthFeatures().orgs.workersAsManagers) {
    throw new Error('Workers-as-managers disabled');
  }
  const result = await pool.query(
    `SELECT 1 FROM aiva_worker_comanagers
     WHERE workspace_id = $1 AND worker_id = $2 AND manager_worker_id = $3
     LIMIT 1`,
    [workspaceId, targetWorkerId, actingManagerWorkerId],
  );
  if (result.rows.length > 0) {
    throw new Error('Manager workers cannot read peer vault secrets');
  }
}

export async function transferWorker(input: {
  workspaceId: string;
  workerId: string;
  toEmail: string;
}) {
  await ensureAivaParitySchema();
  const email = input.toEmail.trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Valid recipient email required');
  await addCoManager({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    email,
    role: 'owner',
  });
  return {
    ok: true,
    workerId: input.workerId,
    transferredTo: email,
    note: 'Ownership flagged via co-manager role=owner. Cloud workspace billing owner remains unchanged until seat billing is wired.',
  };
}

export async function listMemories(workspaceId: string, workerId: string) {
  await ensureAivaParitySchema();
  const result = await pool.query(
    `SELECT * FROM aiva_worker_memories WHERE workspace_id = $1 AND worker_id = $2
     ORDER BY pinned DESC, updated_at DESC LIMIT 100`,
    [workspaceId, workerId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    kind: String(row.kind),
    content: String(row.content),
    pinned: Boolean(row.pinned),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  }));
}

export async function createMemory(input: {
  workspaceId: string;
  workerId: string;
  content: string;
  kind?: string;
  pinned?: boolean;
}) {
  await ensureAivaParitySchema();
  const content = input.content.trim();
  if (!content) throw new Error('content is required');
  const result = await pool.query(
    `INSERT INTO aiva_worker_memories (workspace_id, worker_id, kind, content, pinned)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.workspaceId, input.workerId, input.kind ?? 'preference', content, Boolean(input.pinned)],
  );
  const row = result.rows[0];
  return {
    id: String(row.id),
    kind: String(row.kind),
    content: String(row.content),
    pinned: Boolean(row.pinned),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function deleteMemory(workspaceId: string, workerId: string, memoryId: string) {
  await ensureAivaParitySchema();
  await pool.query(
    `DELETE FROM aiva_worker_memories WHERE workspace_id = $1 AND worker_id = $2 AND id = $3`,
    [workspaceId, workerId, memoryId],
  );
}

export async function buildMemoryPromptSuffix(workspaceId: string, workerId: string): Promise<string> {
  const memories = await listMemories(workspaceId, workerId);
  const pinned = memories.filter((item) => item.pinned).slice(0, 12);
  if (pinned.length === 0) return '';
  return `\n\nPinned worker preferences:\n${pinned.map((item) => `- ${item.content}`).join('\n')}`;
}

/** Deny-by-default product-tool ACL shown in the worker system prompt. */
export async function describeProductToolGrantsForPrompt(
  workspaceId: string,
  workerId: string,
): Promise<string> {
  const grants = await listEffectiveToolGrants(workspaceId, workerId);
  const knownToolSlugs = [
    'gmail',
    'google-calendar',
    'google-drive',
    'google-contacts',
    'trello',
  ];
  const connected = grants.filter((grant) => grant.status === 'connected');
  const needsReauth = grants.filter((grant) => grant.status === 'needs_reauth' || grant.status === 'error');
  const missing = knownToolSlugs
    .filter((slug) => !grants.some((grant) => grant.toolSlug === slug))
    .map((slug) => getCatalogTool(slug) ?? { slug, label: slug });
  const companiesHouseConnected = connected.some((grant) => grant.toolSlug === 'companies-house');
  const googleConnected = connected.some((grant) =>
    grant.toolSlug === 'gmail'
    || grant.toolSlug.startsWith('google-')
  );

  if (connected.length === 0 && needsReauth.length === 0) {
    return [
      '',
      'Product integrations (SaaS tools):',
      '- No relevant tool grants are connected yet.',
      '- Do not claim you can act in Gmail, Calendar, Drive, Contacts, Trello, or Companies House until the workspace owner connects them under Tools.',
      `- Missing: ${missing.map((tool) => tool.label).join(', ') || 'none'}.`,
      'Sales engagement (Outreach) Soft Wall tools are still available:',
      '- outreach-process-due queues cold sequence drafts into Approvals (does not send).',
      '- Use outreach-* / vical-* for discovery, cadence, replies, bookings, and follow-ups.',
      '- Prefer workspace-email-draft-for-approval for ad-hoc careful outbound mail.',
    ].join('\n');
  }

  const formatGrantLine = (grant: { toolSlug: string; scopes: string[]; status: string }) => {
    const meta = getCatalogTool(grant.toolSlug);
    const label = meta?.label ?? grant.toolSlug;
    const scopes = grant.scopes.length > 0 ? grant.scopes.join(', ') : 'default';
    return `- ${label} (${grant.toolSlug}): status ${grant.status}; scopes ${scopes}`;
  };

  const callableLines: string[] = [];
  if (googleConnected) {
    callableLines.push(
      'Callable tools for connected Google products:',
      '- Gmail live API: use gmail-list, gmail-get, and gmail-send (not email-list; that is Resend inbound only).',
      '- Aiva Email page store: use workspace-email-list and workspace-email-get for synced Inbox/Sent (source tags, drafts).',
      '- Drafts needing owner approval: use workspace-email-draft-for-approval (queues /aiva/approvals; does not send).',
      '- Google Drive: use google-drive-search then google-drive-read (not search-files or http-request).',
      '- Google Calendar: use google-calendar-list (optional timeMin/timeMax ISO), google-calendar-create, google-calendar-update (not calendar-list).',
      '- Google Contacts: use google-contacts-list and google-contacts-search for people lookup, email lookup, and phone lookup.',
    );
  }
  if (companiesHouseConnected) {
    callableLines.push(
      'Callable tools for Companies House (UK register; read-only):',
      '- companies-house-search-companies (q required): find companies by name; returns company_number and status.',
      '- companies-house-search-officers: find people / officers by name. ALWAYS call this in the same turn as contacts search when the user asks to find or identify a person. Set includeAppointments=true (or then call companies-house-list-officer-appointments) to list associated companies.',
      '- companies-house-list-officer-appointments (officerId): companies where that person is appointed.',
      '- companies-house-get-company, companies-house-list-officers, companies-house-list-psc: enrich by company number.',
      '- Companies House does not return marketing emails. Never tell the user to open find-and-update.company-information.service.gov.uk when these tools are connected; call them instead.',
    );
  }

  callableLines.push(
    'Callable Sales engagement (Outreach) tools (Soft Wall kept):',
    '- Discovery: outreach-discovery-plan, outreach-discovery-sheet-schema, outreach-discovery-normalize-leads, outreach-discovery-ingest-leads.',
    '- CRM leads CRUD: outreach-leads-list, outreach-leads-get, outreach-leads-create, outreach-leads-update, outreach-leads-delete, outreach-leads-import.',
    '- Cadence: outreach-cadence-summary, outreach-cadence-validate-from, outreach-process-due (queues Soft Wall drafts into Approvals; does not send cold email).',
    '- Replies: outreach-reply-ingest, outreach-reply-review-list, outreach-reply-review-resolve.',
    '- Bookings: outreach-booking-* and vical-* for discovery call slots, confirm, reschedule, cancel.',
    '- Ops: outreach-board-*, outreach-alert-*, outreach-follow-up-*, outreach-control-*, outreach-youtube-import.',
    '- Soft Wall: never claim cold outreach email was sent unless Approvals shows approved/sent. Prefer workspace-email-draft-for-approval for ad-hoc careful mail.',
  );

  return [
    '',
    'Product integrations (SaaS tools) connected for this worker (deny-by-default for anything else):',
    ...connected.map(formatGrantLine),
    ...(needsReauth.length > 0
      ? [
        'Reauth required:',
        ...needsReauth.map(formatGrantLine),
      ]
      : []),
    ...(missing.length > 0
      ? [
        'Missing and not yet connected:',
        ...missing.map((tool) => `- ${tool.label} (${tool.slug}): not connected yet`),
      ]
      : []),
    ...callableLines,
    'Do not invent access to SaaS products that are not listed as connected above.',
  ].join('\n');
}
