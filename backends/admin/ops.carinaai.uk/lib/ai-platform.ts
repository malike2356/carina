import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query } from './db.js';
import { generateApiKey, hashPassword } from './tenant-provisioning.js';

const OPS_PLATFORM_USER_EMAIL = 'ops-platform@internal.carina';
const OPS_PLATFORM_ORG_SLUG = 'ops-platform';

export interface AiPlatformOrg {
  id: string;
  name: string;
  creditBalance: number;
  monthlyLimit: number;
  autoReloadEnabled: boolean;
  promptCachingEnabled: boolean;
  batchEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiPlatformModel {
  id: string;
  provider: string;
  model: string;
  tier: string;
  isDefault: boolean;
  status: string;
  inputPrice: number;
  outputPrice: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkbenchRun {
  id: string;
  orgId: string;
  title: string;
  prompt: string;
  provider: string;
  model: string;
  status: string;
  tokensIn: number;
  tokensOut: number;
  costEstimate: number;
  responseText: string | null;
  createdAt: Date;
}

export interface PlatformAsset {
  id: string;
  kind: string;
  name: string;
  slug: string;
  status: string;
  metadataJson: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformAgent {
  id: string;
  name: string;
  status: string;
  model: string;
  provider: string;
  lastRunAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformSession {
  id: string;
  agentId: string | null;
  title: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  summary: string | null;
  metadataJson: Record<string, unknown>;
}

export interface PlatformDeployment {
  id: string;
  name: string;
  environmentId: string | null;
  status: string;
  model: string;
  provider: string;
  version: string;
  deployedAt: Date | null;
  metadataJson: Record<string, unknown>;
}

export interface PlatformEnvironment {
  id: string;
  name: string;
  slug: string;
  status: string;
  apiBaseUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultItem {
  id: string;
  environmentId: string | null;
  name: string;
  provider: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryStore {
  id: string;
  name: string;
  scope: string;
  status: string;
  itemCount: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageDailyRow {
  id: string;
  usageDate: string;
  provider: string;
  model: string;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  cacheHits: number;
  batchJobs: number;
  estimatedCost: number;
}

export interface PlatformCounts {
  agents: number;
  sessions: number;
  deployments: number;
  vaultItems: number;
  memoryStores: number;
  assets: number;
  batches: number;
}

export interface UsageSummary {
  requests: number;
  tokensIn: number;
  tokensOut: number;
  cacheHits: number;
  batchJobs: number;
  estimatedCost: number;
  hasData: boolean;
}

const DEFAULT_MODELS: Array<Omit<AiPlatformModel, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    tier: 'balanced',
    isDefault: true,
    status: 'active',
    inputPrice: 3,
    outputPrice: 15,
    notes: 'Everyday tasks, writing, cost-efficient',
  },
  {
    provider: 'anthropic',
    model: 'claude-opus-4-20250514',
    tier: 'premium',
    isDefault: false,
    status: 'active',
    inputPrice: 15,
    outputPrice: 75,
    notes: 'Complex projects, agents, coding',
  },
  {
    provider: 'anthropic',
    model: 'claude-haiku-3-5-20241022',
    tier: 'fast',
    isDefault: false,
    status: 'active',
    inputPrice: 0.8,
    outputPrice: 4,
    notes: 'Fastest, lowest cost, high volume',
  },
  {
    provider: 'openai',
    model: 'gpt-4o',
    tier: 'balanced',
    isDefault: false,
    status: 'active',
    inputPrice: 2.5,
    outputPrice: 10,
    notes: 'General purpose multimodal',
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    tier: 'fast',
    isDefault: false,
    status: 'active',
    inputPrice: 0.15,
    outputPrice: 0.6,
    notes: 'Low cost high volume',
  },
];

function encryptionKey(): Buffer {
  const k = process.env.TENANT_KEY_ENCRYPTION_KEY
    ?? process.env.CARINA_ENCRYPTION_KEY
    ?? 'carina-dev-key-change-in-production-32';
  return Buffer.from(k.slice(0, 32), 'utf-8');
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey(), iv);
  let enc = cipher.update(plaintext, 'utf-8', 'hex');
  enc += cipher.final('hex');
  return `${iv.toString('hex')}:${enc}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'item';
}

export function estimateCost(
  tokensIn: number,
  tokensOut: number,
  inputPrice: number,
  outputPrice: number,
): number {
  return (tokensIn / 1_000_000) * inputPrice + (tokensOut / 1_000_000) * outputPrice;
}

export function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

async function tableExists(name: string): Promise<boolean> {
  const res = await query<{ reg: string | null }>(
    `SELECT to_regclass($1) AS reg`,
    [name],
  );
  return !!res.rows[0]?.reg;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const res = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS exists`,
    [table, column],
  );
  return Boolean(res.rows[0]?.exists);
}

let hostedOrgScope: boolean | undefined;
async function usesHostedOrgScope(): Promise<boolean> {
  if (hostedOrgScope === undefined) {
    hostedOrgScope = (await tableExists('public.organizations'))
      && (await columnExists('ai_platform_models', 'org_id'));
  }
  return hostedOrgScope;
}

let hostedUsageDaily: boolean | undefined;
async function usesHostedUsageDaily(): Promise<boolean> {
  if (hostedUsageDaily === undefined) {
    hostedUsageDaily = await columnExists('ai_platform_usage_daily', 'request_count');
  }
  return hostedUsageDaily;
}

let hostedSessions: boolean | undefined;
async function usesHostedSessions(): Promise<boolean> {
  if (hostedSessions === undefined) {
    hostedSessions = await columnExists('ai_platform_sessions', 'last_activity_at');
  }
  return hostedSessions;
}

let cachedHostedOrgId: string | null | undefined;

/** Core-hosted schema stores org-scoped rows in organizations, not ai_platform_orgs. */
export async function resolveHostedOrgId(): Promise<string | null> {
  if (cachedHostedOrgId !== undefined) return cachedHostedOrgId;
  if (!(await usesHostedOrgScope())) {
    cachedHostedOrgId = null;
    return null;
  }

  const existing = await query<{ id: string }>(
    `SELECT id FROM organizations ORDER BY created_at ASC NULLS LAST LIMIT 1`,
  );
  if (existing.rows[0]) {
    cachedHostedOrgId = String(existing.rows[0].id);
    return cachedHostedOrgId;
  }

  if (!(await tableExists('public.hosted_users'))) {
    cachedHostedOrgId = null;
    return null;
  }

  const slugRow = await query<{ id: string }>(
    `SELECT id FROM organizations WHERE slug = $1 LIMIT 1`,
    [OPS_PLATFORM_ORG_SLUG],
  );
  if (slugRow.rows[0]) {
    cachedHostedOrgId = String(slugRow.rows[0].id);
    return cachedHostedOrgId;
  }

  let userId: string;
  const userRow = await query<{ id: string }>(
    `SELECT id FROM hosted_users WHERE email = $1 LIMIT 1`,
    [OPS_PLATFORM_USER_EMAIL],
  );
  if (userRow.rows[0]) {
    userId = String(userRow.rows[0].id);
  } else {
    const apiKey = generateApiKey();
    const schemaName = `ops_${crypto.randomBytes(4).toString('hex')}`;
    const inserted = await query<{ id: string }>(
      `INSERT INTO hosted_users (
         email, password_hash, api_key, schema_name, tier,
         display_name, provisioning_type, access_status, updated_at
       )
       VALUES ($1, $2, $3, $4, 'free', 'Ops Platform', 'manual', 'active', NOW())
       RETURNING id`,
      [OPS_PLATFORM_USER_EMAIL, hashPassword(crypto.randomBytes(24).toString('hex')), apiKey, schemaName],
    );
    userId = String(inserted.rows[0]!.id);
    const safeSchema = schemaName.replace(/[^a-z0-9_]/gi, '');
    await query(`CREATE SCHEMA IF NOT EXISTS "${safeSchema}"`);
  }

  const orgInsert = await query<{ id: string }>(
    `INSERT INTO organizations (name, slug, owner_user_id, plan, status)
     VALUES ('Ops Platform', $1, $2, 'free', 'active')
     RETURNING id`,
    [OPS_PLATFORM_ORG_SLUG, userId],
  );
  cachedHostedOrgId = String(orgInsert.rows[0]!.id);
  return cachedHostedOrgId;
}

export async function _resetAiPlatformHostedCacheForTests(): Promise<void> {
  hostedOrgScope = undefined;
  hostedUsageDaily = undefined;
  cachedHostedOrgId = undefined;
}

export async function aiPlatformTablesReady(): Promise<boolean> {
  return tableExists('ai_platform_orgs');
}

export async function ensureAiPlatformSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS ai_platform_orgs (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      credit_balance NUMERIC(12,4) NOT NULL DEFAULT 0,
      monthly_limit NUMERIC(12,4) NOT NULL DEFAULT 500,
      auto_reload_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      prompt_caching_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      batch_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_platform_models (
      id UUID PRIMARY KEY,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'balanced',
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'active',
      input_price NUMERIC(10,4) NOT NULL DEFAULT 0,
      output_price NUMERIC(10,4) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (provider, model)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_platform_workbench_runs (
      id UUID PRIMARY KEY,
      org_id UUID REFERENCES ai_platform_orgs(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled run',
      prompt TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0,
      cost_estimate NUMERIC(12,6) NOT NULL DEFAULT 0,
      response_text TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_platform_assets (
      id UUID PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      metadata_json JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_platform_agents (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      last_run_at TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_platform_sessions (
      id UUID PRIMARY KEY,
      agent_id UUID REFERENCES ai_platform_agents(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      summary TEXT,
      metadata_json JSONB NOT NULL DEFAULT '{}'
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_platform_environments (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      api_base_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_platform_deployments (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      environment_id UUID REFERENCES ai_platform_environments(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0.0',
      deployed_at TIMESTAMPTZ,
      metadata_json JSONB NOT NULL DEFAULT '{}'
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_platform_credential_vault_items (
      id UUID PRIMARY KEY,
      environment_id UUID REFERENCES ai_platform_environments(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      encrypted_secret TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_platform_memory_stores (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'org',
      status TEXT NOT NULL DEFAULT 'active',
      item_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_platform_usage_daily (
      id UUID PRIMARY KEY,
      usage_date DATE NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      requests INTEGER NOT NULL DEFAULT 0,
      tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0,
      cache_hits INTEGER NOT NULL DEFAULT 0,
      batch_jobs INTEGER NOT NULL DEFAULT 0,
      estimated_cost NUMERIC(12,6) NOT NULL DEFAULT 0,
      UNIQUE (usage_date, provider, model)
    )
  `);

  await seedDefaultOrgIfMissing();
  await seedDefaultModelsIfMissing();
}

function mapOrg(row: Record<string, unknown>): AiPlatformOrg {
  return {
    id: String(row.id),
    name: String(row.name),
    creditBalance: Number(row.credit_balance),
    monthlyLimit: Number(row.monthly_limit),
    autoReloadEnabled: Boolean(row.auto_reload_enabled),
    promptCachingEnabled: Boolean(row.prompt_caching_enabled),
    batchEnabled: Boolean(row.batch_enabled),
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function mapModel(row: Record<string, unknown>): AiPlatformModel {
  return {
    id: String(row.id),
    provider: String(row.provider),
    model: String(row.model),
    tier: String(row.tier),
    isDefault: Boolean(row.is_default),
    status: String(row.status),
    inputPrice: Number(row.input_price),
    outputPrice: Number(row.output_price),
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function mapRun(row: Record<string, unknown>): WorkbenchRun {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    title: String(row.title),
    prompt: String(row.prompt),
    provider: String(row.provider),
    model: String(row.model),
    status: String(row.status),
    tokensIn: Number(row.tokens_in),
    tokensOut: Number(row.tokens_out),
    costEstimate: Number(row.cost_estimate),
    responseText: row.response_text != null ? String(row.response_text) : null,
    createdAt: row.created_at as Date,
  };
}

function mapAsset(row: Record<string, unknown>): PlatformAsset {
  return {
    id: String(row.id),
    kind: String(row.kind),
    name: String(row.name),
    slug: String(row.slug),
    status: String(row.status),
    metadataJson: (row.metadata_json ?? {}) as Record<string, unknown>,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function seedDefaultOrgIfMissing(): Promise<AiPlatformOrg> {
  const existing = await query(`SELECT * FROM ai_platform_orgs ORDER BY created_at ASC LIMIT 1`);
  if (existing.rows[0]) return mapOrg(existing.rows[0]);

  const id = uuidv4();
  await query(
    `INSERT INTO ai_platform_orgs (id, name, credit_balance, monthly_limit)
     VALUES ($1, $2, 0, 500)`,
    [id, 'Default Organization'],
  );
  const row = await query(`SELECT * FROM ai_platform_orgs WHERE id = $1`, [id]);
  return mapOrg(row.rows[0]);
}

export async function getDefaultOrg(): Promise<AiPlatformOrg> {
  await seedDefaultOrgIfMissing();
  const res = await query(`SELECT * FROM ai_platform_orgs ORDER BY created_at ASC LIMIT 1`);
  return mapOrg(res.rows[0]);
}

export async function updateOrg(
  id: string,
  patch: Partial<{
    name: string;
    creditBalance: number;
    monthlyLimit: number;
    autoReloadEnabled: boolean;
    promptCachingEnabled: boolean;
    batchEnabled: boolean;
  }>,
): Promise<AiPlatformOrg> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (patch.name !== undefined) { fields.push(`name = $${idx++}`); values.push(patch.name); }
  if (patch.creditBalance !== undefined) { fields.push(`credit_balance = $${idx++}`); values.push(patch.creditBalance); }
  if (patch.monthlyLimit !== undefined) { fields.push(`monthly_limit = $${idx++}`); values.push(patch.monthlyLimit); }
  if (patch.autoReloadEnabled !== undefined) { fields.push(`auto_reload_enabled = $${idx++}`); values.push(patch.autoReloadEnabled); }
  if (patch.promptCachingEnabled !== undefined) { fields.push(`prompt_caching_enabled = $${idx++}`); values.push(patch.promptCachingEnabled); }
  if (patch.batchEnabled !== undefined) { fields.push(`batch_enabled = $${idx++}`); values.push(patch.batchEnabled); }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  await query(
    `UPDATE ai_platform_orgs SET ${fields.join(', ')} WHERE id = $${idx}`,
    values,
  );
  const res = await query(`SELECT * FROM ai_platform_orgs WHERE id = $1`, [id]);
  return mapOrg(res.rows[0]);
}

export async function seedDefaultModelsIfMissing(): Promise<void> {
  const hostedOrgId = await resolveHostedOrgId();
  if (hostedOrgId) {
    const count = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ai_platform_models WHERE org_id = $1`,
      [hostedOrgId],
    );
    if (Number(count.rows[0]?.count ?? 0) > 0) return;

    for (const m of DEFAULT_MODELS) {
      await query(
        `INSERT INTO ai_platform_models
         (id, org_id, provider, model, tier, is_default, status, input_price, output_price, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          uuidv4(),
          hostedOrgId,
          m.provider,
          m.model,
          m.tier,
          m.isDefault,
          m.status,
          m.inputPrice,
          m.outputPrice,
          m.notes,
        ],
      );
    }
    return;
  }

  const count = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ai_platform_models`);
  if (Number(count.rows[0]?.count ?? 0) > 0) return;

  for (const m of DEFAULT_MODELS) {
    await query(
      `INSERT INTO ai_platform_models
       (id, provider, model, tier, is_default, status, input_price, output_price, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [uuidv4(), m.provider, m.model, m.tier, m.isDefault, m.status, m.inputPrice, m.outputPrice, m.notes],
    );
  }
}

export async function listModels(): Promise<AiPlatformModel[]> {
  const res = await query(`SELECT * FROM ai_platform_models ORDER BY is_default DESC, provider, model`);
  return res.rows.map(mapModel);
}

export async function getModelById(id: string): Promise<AiPlatformModel | null> {
  const res = await query(`SELECT * FROM ai_platform_models WHERE id = $1`, [id]);
  return res.rows[0] ? mapModel(res.rows[0]) : null;
}

export async function createWorkbenchRun(input: {
  orgId: string;
  title?: string;
  prompt: string;
  provider: string;
  model: string;
  status?: string;
}): Promise<WorkbenchRun> {
  const id = uuidv4();
  const orgId = (await resolveHostedOrgId()) ?? input.orgId;
  await query(
    `INSERT INTO ai_platform_workbench_runs
     (id, org_id, title, prompt, provider, model, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      orgId,
      input.title?.trim() || 'Untitled run',
      input.prompt,
      input.provider,
      input.model,
      input.status ?? 'draft',
    ],
  );
  const res = await query(`SELECT * FROM ai_platform_workbench_runs WHERE id = $1`, [id]);
  return mapRun(res.rows[0]);
}

export async function updateWorkbenchRun(
  id: string,
  patch: Partial<{
    title: string;
    status: string;
    tokensIn: number;
    tokensOut: number;
    costEstimate: number;
    responseText: string;
  }>,
): Promise<WorkbenchRun | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (patch.title !== undefined) { fields.push(`title = $${idx++}`); values.push(patch.title); }
  if (patch.status !== undefined) { fields.push(`status = $${idx++}`); values.push(patch.status); }
  if (patch.tokensIn !== undefined) { fields.push(`tokens_in = $${idx++}`); values.push(patch.tokensIn); }
  if (patch.tokensOut !== undefined) { fields.push(`tokens_out = $${idx++}`); values.push(patch.tokensOut); }
  if (patch.costEstimate !== undefined) { fields.push(`cost_estimate = $${idx++}`); values.push(patch.costEstimate); }
  if (patch.responseText !== undefined) { fields.push(`response_text = $${idx++}`); values.push(patch.responseText); }

  if (!fields.length) return getWorkbenchRun(id);
  values.push(id);
  await query(`UPDATE ai_platform_workbench_runs SET ${fields.join(', ')} WHERE id = $${idx}`, values);
  return getWorkbenchRun(id);
}

export async function getWorkbenchRun(id: string): Promise<WorkbenchRun | null> {
  const res = await query(`SELECT * FROM ai_platform_workbench_runs WHERE id = $1`, [id]);
  return res.rows[0] ? mapRun(res.rows[0]) : null;
}

export async function listWorkbenchRuns(limit = 20): Promise<WorkbenchRun[]> {
  const res = await query(
    `SELECT * FROM ai_platform_workbench_runs ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return res.rows.map(mapRun);
}

export async function listAssets(kind?: string): Promise<PlatformAsset[]> {
  const res = kind
    ? await query(`SELECT * FROM ai_platform_assets WHERE kind = $1 ORDER BY updated_at DESC`, [kind])
    : await query(`SELECT * FROM ai_platform_assets ORDER BY updated_at DESC`);
  return res.rows.map(mapAsset);
}

export async function createAsset(input: {
  kind: string;
  name: string;
  slug?: string;
  status?: string;
  metadataJson?: Record<string, unknown>;
}): Promise<PlatformAsset> {
  const id = uuidv4();
  const slug = input.slug?.trim() || slugify(input.name);
  await query(
    `INSERT INTO ai_platform_assets (id, kind, name, slug, status, metadata_json)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, input.kind, input.name, slug, input.status ?? 'active', JSON.stringify(input.metadataJson ?? {})],
  );
  const res = await query(`SELECT * FROM ai_platform_assets WHERE id = $1`, [id]);
  return mapAsset(res.rows[0]);
}

export async function updateAsset(
  id: string,
  patch: Partial<{ name: string; slug: string; status: string; metadataJson: Record<string, unknown> }>,
): Promise<PlatformAsset | null> {
  const fields: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;

  if (patch.name !== undefined) { fields.push(`name = $${idx++}`); values.push(patch.name); }
  if (patch.slug !== undefined) { fields.push(`slug = $${idx++}`); values.push(patch.slug); }
  if (patch.status !== undefined) { fields.push(`status = $${idx++}`); values.push(patch.status); }
  if (patch.metadataJson !== undefined) { fields.push(`metadata_json = $${idx++}`); values.push(JSON.stringify(patch.metadataJson)); }

  values.push(id);
  await query(`UPDATE ai_platform_assets SET ${fields.join(', ')} WHERE id = $${idx}`, values);
  const res = await query(`SELECT * FROM ai_platform_assets WHERE id = $1`, [id]);
  return res.rows[0] ? mapAsset(res.rows[0]) : null;
}

export async function deleteAsset(id: string): Promise<boolean> {
  const res = await query(`DELETE FROM ai_platform_assets WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function listAgents(): Promise<PlatformAgent[]> {
  const res = await query(`SELECT * FROM ai_platform_agents ORDER BY updated_at DESC`);
  return res.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    status: String(row.status),
    model: String(row.model),
    provider: String(row.provider),
    lastRunAt: row.last_run_at as Date | null,
    lastError: row.last_error != null ? String(row.last_error) : null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  }));
}

export async function createAgent(input: {
  name: string;
  model: string;
  provider: string;
  status?: string;
}): Promise<PlatformAgent> {
  const id = uuidv4();
  await query(
    `INSERT INTO ai_platform_agents (id, name, model, provider, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, input.name, input.model, input.provider, input.status ?? 'idle'],
  );
  const agents = await listAgents();
  return agents.find((a) => a.id === id)!;
}

export async function updateAgent(
  id: string,
  patch: Partial<{ name: string; status: string; model: string; provider: string; lastError: string | null }>,
): Promise<void> {
  const fields: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;

  if (patch.name !== undefined) { fields.push(`name = $${idx++}`); values.push(patch.name); }
  if (patch.status !== undefined) { fields.push(`status = $${idx++}`); values.push(patch.status); }
  if (patch.model !== undefined) { fields.push(`model = $${idx++}`); values.push(patch.model); }
  if (patch.provider !== undefined) { fields.push(`provider = $${idx++}`); values.push(patch.provider); }
  if (patch.lastError !== undefined) { fields.push(`last_error = $${idx++}`); values.push(patch.lastError); }
  if (patch.status === 'running') { fields.push(`last_run_at = NOW()`); }

  values.push(id);
  await query(`UPDATE ai_platform_agents SET ${fields.join(', ')} WHERE id = $${idx}`, values);
}

export async function listSessions(limit = 50): Promise<PlatformSession[]> {
  if (await usesHostedSessions()) {
    const orgId = await resolveHostedOrgId();
    const res = orgId
      ? await query(
        `SELECT id, agent_id, title, status, last_activity_at, created_at, metadata_json
         FROM ai_platform_sessions
         WHERE org_id = $1
         ORDER BY last_activity_at DESC
         LIMIT $2`,
        [orgId, limit],
      )
      : await query(
        `SELECT id, agent_id, title, status, last_activity_at, created_at, metadata_json
         FROM ai_platform_sessions
         ORDER BY last_activity_at DESC
         LIMIT $1`,
        [limit],
      );
    return res.rows.map((row) => mapSessionRow(row));
  }

  const res = await query(
    `SELECT * FROM ai_platform_sessions ORDER BY started_at DESC LIMIT $1`,
    [limit],
  );
  return res.rows.map((row) => mapSessionRow(row));
}

function mapSessionRow(row: Record<string, unknown>): PlatformSession {
  const metadata = (row.metadata_json ?? {}) as Record<string, unknown>;
  const summaryFromMeta = metadata.summary != null ? String(metadata.summary) : null;
  return {
    id: String(row.id),
    agentId: row.agent_id != null ? String(row.agent_id) : null,
    title: String(row.title),
    status: String(row.status),
    startedAt: (row.last_activity_at ?? row.started_at ?? row.created_at) as Date,
    endedAt: (row.ended_at as Date | null) ?? null,
    summary: row.summary != null ? String(row.summary) : summaryFromMeta,
    metadataJson: metadata,
  };
}

export async function createSession(input: {
  agentId?: string;
  title: string;
  status?: string;
  summary?: string;
}): Promise<PlatformSession> {
  const id = uuidv4();
  if (await usesHostedSessions()) {
    const orgId = await resolveHostedOrgId();
    if (!orgId) {
      throw new Error('No hosted organization found for platform sessions');
    }
    const metadataJson = input.summary?.trim()
      ? { summary: input.summary.trim() }
      : {};
    await query(
      `INSERT INTO ai_platform_sessions (id, org_id, agent_id, title, channel, status, metadata_json)
       VALUES ($1, $2, $3, $4, 'ops', $5, $6)`,
      [id, orgId, input.agentId ?? null, input.title, input.status ?? 'open', JSON.stringify(metadataJson)],
    );
  } else {
    await query(
      `INSERT INTO ai_platform_sessions (id, agent_id, title, status, summary)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, input.agentId ?? null, input.title, input.status ?? 'open', input.summary ?? null],
    );
  }

  const created = await query(`SELECT * FROM ai_platform_sessions WHERE id = $1`, [id]);
  return mapSessionRow(created.rows[0]);
}

export async function listEnvironments(): Promise<PlatformEnvironment[]> {
  const res = await query(`SELECT * FROM ai_platform_environments ORDER BY name`);
  return res.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    status: String(row.status),
    apiBaseUrl: row.api_base_url != null ? String(row.api_base_url) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  }));
}

export async function createEnvironment(input: {
  name: string;
  slug?: string;
  apiBaseUrl?: string;
  notes?: string;
  status?: string;
}): Promise<PlatformEnvironment> {
  const id = uuidv4();
  const slug = input.slug?.trim() || slugify(input.name);
  await query(
    `INSERT INTO ai_platform_environments (id, name, slug, api_base_url, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, input.name, slug, input.apiBaseUrl ?? null, input.notes ?? null, input.status ?? 'active'],
  );
  const envs = await listEnvironments();
  return envs.find((e) => e.id === id)!;
}

export async function updateEnvironment(
  id: string,
  patch: Partial<{ name: string; slug: string; apiBaseUrl: string; notes: string; status: string }>,
): Promise<void> {
  const fields: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;

  if (patch.name !== undefined) { fields.push(`name = $${idx++}`); values.push(patch.name); }
  if (patch.slug !== undefined) { fields.push(`slug = $${idx++}`); values.push(patch.slug); }
  if (patch.apiBaseUrl !== undefined) { fields.push(`api_base_url = $${idx++}`); values.push(patch.apiBaseUrl || null); }
  if (patch.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(patch.notes || null); }
  if (patch.status !== undefined) { fields.push(`status = $${idx++}`); values.push(patch.status); }

  values.push(id);
  await query(`UPDATE ai_platform_environments SET ${fields.join(', ')} WHERE id = $${idx}`, values);
}

export async function listDeployments(): Promise<PlatformDeployment[]> {
  const res = await query(`SELECT * FROM ai_platform_deployments ORDER BY deployed_at DESC NULLS LAST`);
  return res.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    environmentId: row.environment_id != null ? String(row.environment_id) : null,
    status: String(row.status),
    model: String(row.model),
    provider: String(row.provider),
    version: String(row.version),
    deployedAt: row.deployed_at as Date | null,
    metadataJson: (row.metadata_json ?? {}) as Record<string, unknown>,
  }));
}

export async function createDeployment(input: {
  name: string;
  environmentId?: string;
  model: string;
  provider: string;
  version?: string;
  status?: string;
}): Promise<PlatformDeployment> {
  const id = uuidv4();
  const status = input.status ?? 'pending';
  await query(
    `INSERT INTO ai_platform_deployments
     (id, name, environment_id, model, provider, version, status, deployed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      input.name,
      input.environmentId ?? null,
      input.model,
      input.provider,
      input.version ?? '1.0.0',
      status,
      status === 'live' ? new Date() : null,
    ],
  );
  const deps = await listDeployments();
  return deps.find((d) => d.id === id)!;
}

export async function updateDeployment(
  id: string,
  patch: Partial<{ name: string; status: string; version: string; environmentId: string }>,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (patch.name !== undefined) { fields.push(`name = $${idx++}`); values.push(patch.name); }
  if (patch.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(patch.status);
    if (patch.status === 'live') fields.push(`deployed_at = NOW()`);
  }
  if (patch.version !== undefined) { fields.push(`version = $${idx++}`); values.push(patch.version); }
  if (patch.environmentId !== undefined) { fields.push(`environment_id = $${idx++}`); values.push(patch.environmentId || null); }

  if (!fields.length) return;
  values.push(id);
  await query(`UPDATE ai_platform_deployments SET ${fields.join(', ')} WHERE id = $${idx}`, values);
}

export async function listVaultItems(environmentId?: string): Promise<VaultItem[]> {
  const res = environmentId
    ? await query(
      `SELECT id, environment_id, name, provider, is_active, created_at, updated_at
       FROM ai_platform_credential_vault_items WHERE environment_id = $1 ORDER BY name`,
      [environmentId],
    )
    : await query(
      `SELECT id, environment_id, name, provider, is_active, created_at, updated_at
       FROM ai_platform_credential_vault_items ORDER BY name`,
    );
  return res.rows.map((row) => ({
    id: String(row.id),
    environmentId: row.environment_id != null ? String(row.environment_id) : null,
    name: String(row.name),
    provider: String(row.provider),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  }));
}

export async function createVaultItem(input: {
  environmentId?: string;
  name: string;
  provider: string;
  secret: string;
}): Promise<VaultItem> {
  const id = uuidv4();
  const encrypted = encryptSecret(input.secret);
  await query(
    `INSERT INTO ai_platform_credential_vault_items
     (id, environment_id, name, provider, encrypted_secret)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, input.environmentId ?? null, input.name, input.provider, encrypted],
  );
  const items = await listVaultItems();
  return items.find((v) => v.id === id)!;
}

export async function toggleVaultItem(id: string, isActive: boolean): Promise<void> {
  await query(
    `UPDATE ai_platform_credential_vault_items SET is_active = $2, updated_at = NOW() WHERE id = $1`,
    [id, isActive],
  );
}

export async function deleteVaultItem(id: string): Promise<void> {
  await query(`DELETE FROM ai_platform_credential_vault_items WHERE id = $1`, [id]);
}

export async function listMemoryStores(): Promise<MemoryStore[]> {
  const res = await query(`SELECT * FROM ai_platform_memory_stores ORDER BY name`);
  return res.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    scope: String(row.scope),
    status: String(row.status),
    itemCount: Number(row.item_count),
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  }));
}

export async function createMemoryStore(input: {
  name: string;
  scope?: string;
  notes?: string;
}): Promise<MemoryStore> {
  const id = uuidv4();
  await query(
    `INSERT INTO ai_platform_memory_stores (id, name, scope, notes)
     VALUES ($1, $2, $3, $4)`,
    [id, input.name, input.scope ?? 'org', input.notes ?? null],
  );
  const stores = await listMemoryStores();
  return stores.find((s) => s.id === id)!;
}

export async function updateMemoryStore(
  id: string,
  patch: Partial<{ name: string; scope: string; status: string; itemCount: number; notes: string }>,
): Promise<void> {
  const fields: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;

  if (patch.name !== undefined) { fields.push(`name = $${idx++}`); values.push(patch.name); }
  if (patch.scope !== undefined) { fields.push(`scope = $${idx++}`); values.push(patch.scope); }
  if (patch.status !== undefined) { fields.push(`status = $${idx++}`); values.push(patch.status); }
  if (patch.itemCount !== undefined) { fields.push(`item_count = $${idx++}`); values.push(patch.itemCount); }
  if (patch.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(patch.notes || null); }

  values.push(id);
  await query(`UPDATE ai_platform_memory_stores SET ${fields.join(', ')} WHERE id = $${idx}`, values);
}

export async function recordUsageDaily(input: {
  provider: string;
  model: string;
  requests?: number;
  tokensIn?: number;
  tokensOut?: number;
  cacheHits?: number;
  batchJobs?: number;
  estimatedCost?: number;
  usageDate?: string;
}): Promise<void> {
  const date = input.usageDate ?? new Date().toISOString().slice(0, 10);
  await query(
    `INSERT INTO ai_platform_usage_daily
     (id, usage_date, provider, model, requests, tokens_in, tokens_out, cache_hits, batch_jobs, estimated_cost)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (usage_date, provider, model)
     DO UPDATE SET
       requests = ai_platform_usage_daily.requests + EXCLUDED.requests,
       tokens_in = ai_platform_usage_daily.tokens_in + EXCLUDED.tokens_in,
       tokens_out = ai_platform_usage_daily.tokens_out + EXCLUDED.tokens_out,
       cache_hits = ai_platform_usage_daily.cache_hits + EXCLUDED.cache_hits,
       batch_jobs = ai_platform_usage_daily.batch_jobs + EXCLUDED.batch_jobs,
       estimated_cost = ai_platform_usage_daily.estimated_cost + EXCLUDED.estimated_cost`,
    [
      uuidv4(),
      date,
      input.provider,
      input.model,
      input.requests ?? 0,
      input.tokensIn ?? 0,
      input.tokensOut ?? 0,
      input.cacheHits ?? 0,
      input.batchJobs ?? 0,
      input.estimatedCost ?? 0,
    ],
  );
}

export async function getUsageSummary(days = 30): Promise<UsageSummary> {
  if (await usesHostedUsageDaily()) {
    const orgId = await resolveHostedOrgId();
    if (!orgId) {
      return {
        requests: 0,
        tokensIn: 0,
        tokensOut: 0,
        cacheHits: 0,
        batchJobs: 0,
        estimatedCost: 0,
        hasData: false,
      };
    }
    const res = await query<{
      requests: string;
      tokens_in: string;
      tokens_out: string;
      estimated_cost: string;
    }>(
      `SELECT
         COALESCE(SUM(request_count), 0)::text AS requests,
         COALESCE(SUM(tokens_in), 0)::text AS tokens_in,
         COALESCE(SUM(tokens_out), 0)::text AS tokens_out,
         COALESCE(SUM(cost_estimate), 0)::text AS estimated_cost
       FROM ai_platform_usage_daily
       WHERE org_id = $1 AND usage_date >= CURRENT_DATE - $2::int`,
      [orgId, days],
    );
    const row = res.rows[0];
    const requests = Number(row?.requests ?? 0);
    return {
      requests,
      tokensIn: Number(row?.tokens_in ?? 0),
      tokensOut: Number(row?.tokens_out ?? 0),
      cacheHits: 0,
      batchJobs: 0,
      estimatedCost: Number(row?.estimated_cost ?? 0),
      hasData: requests > 0,
    };
  }

  const res = await query<{
    requests: string;
    tokens_in: string;
    tokens_out: string;
    cache_hits: string;
    batch_jobs: string;
    estimated_cost: string;
  }>(
    `SELECT
       COALESCE(SUM(requests), 0)::text AS requests,
       COALESCE(SUM(tokens_in), 0)::text AS tokens_in,
       COALESCE(SUM(tokens_out), 0)::text AS tokens_out,
       COALESCE(SUM(cache_hits), 0)::text AS cache_hits,
       COALESCE(SUM(batch_jobs), 0)::text AS batch_jobs,
       COALESCE(SUM(estimated_cost), 0)::text AS estimated_cost
     FROM ai_platform_usage_daily
     WHERE usage_date >= CURRENT_DATE - $1::int`,
    [days],
  );
  const row = res.rows[0];
  const requests = Number(row?.requests ?? 0);
  return {
    requests,
    tokensIn: Number(row?.tokens_in ?? 0),
    tokensOut: Number(row?.tokens_out ?? 0),
    cacheHits: Number(row?.cache_hits ?? 0),
    batchJobs: Number(row?.batch_jobs ?? 0),
    estimatedCost: Number(row?.estimated_cost ?? 0),
    hasData: requests > 0,
  };
}

export async function getUsageByProviderModel(days = 30): Promise<UsageDailyRow[]> {
  if (await usesHostedUsageDaily()) {
    return [];
  }

  const res = await query(
    `SELECT provider, model,
            SUM(requests)::int AS requests,
            SUM(tokens_in)::int AS tokens_in,
            SUM(tokens_out)::int AS tokens_out,
            SUM(cache_hits)::int AS cache_hits,
            SUM(batch_jobs)::int AS batch_jobs,
            SUM(estimated_cost)::float AS estimated_cost
     FROM ai_platform_usage_daily
     WHERE usage_date >= CURRENT_DATE - $1::int
     GROUP BY provider, model
     ORDER BY estimated_cost DESC`,
    [days],
  );
  return res.rows.map((row) => ({
    id: `${row.provider}:${row.model}`,
    usageDate: '',
    provider: String(row.provider),
    model: String(row.model),
    requests: Number(row.requests),
    tokensIn: Number(row.tokens_in),
    tokensOut: Number(row.tokens_out),
    cacheHits: Number(row.cache_hits),
    batchJobs: Number(row.batch_jobs),
    estimatedCost: Number(row.estimated_cost),
  }));
}

export async function getUsageDailyRows(days = 30): Promise<UsageDailyRow[]> {
  if (await usesHostedUsageDaily()) {
    const orgId = await resolveHostedOrgId();
    if (!orgId) return [];
    const res = await query(
      `SELECT * FROM ai_platform_usage_daily
       WHERE org_id = $1 AND usage_date >= CURRENT_DATE - $2::int
       ORDER BY usage_date DESC`,
      [orgId, days],
    );
    return res.rows.map((row) => ({
      id: String(row.id),
      usageDate: String(row.usage_date).slice(0, 10),
      provider: 'all',
      model: 'all',
      requests: Number(row.request_count ?? 0),
      tokensIn: Number(row.tokens_in),
      tokensOut: Number(row.tokens_out),
      cacheHits: 0,
      batchJobs: 0,
      estimatedCost: Number(row.cost_estimate ?? 0),
    }));
  }

  const res = await query(
    `SELECT * FROM ai_platform_usage_daily
     WHERE usage_date >= CURRENT_DATE - $1::int
     ORDER BY usage_date DESC, provider, model`,
    [days],
  );
  return res.rows.map((row) => ({
    id: String(row.id),
    usageDate: String(row.usage_date).slice(0, 10),
    provider: String(row.provider),
    model: String(row.model),
    requests: Number(row.requests),
    tokensIn: Number(row.tokens_in),
    tokensOut: Number(row.tokens_out),
    cacheHits: Number(row.cache_hits),
    batchJobs: Number(row.batch_jobs),
    estimatedCost: Number(row.estimated_cost),
  }));
}

export async function getPlatformCounts(): Promise<PlatformCounts> {
  const [agents, sessions, deployments, vaultItems, memoryStores, assets, batches] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ai_platform_agents`),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ai_platform_sessions`),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ai_platform_deployments`),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ai_platform_credential_vault_items`),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ai_platform_memory_stores`),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ai_platform_assets WHERE kind = 'file'`),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ai_platform_assets WHERE kind = 'batch'`),
  ]);
  return {
    agents: Number(agents.rows[0]?.count ?? 0),
    sessions: Number(sessions.rows[0]?.count ?? 0),
    deployments: Number(deployments.rows[0]?.count ?? 0),
    vaultItems: Number(vaultItems.rows[0]?.count ?? 0),
    memoryStores: Number(memoryStores.rows[0]?.count ?? 0),
    assets: Number(assets.rows[0]?.count ?? 0),
    batches: Number(batches.rows[0]?.count ?? 0),
  };
}

export async function getSpendThisMonth(): Promise<number> {
  if (await usesHostedUsageDaily()) {
    const orgId = await resolveHostedOrgId();
    if (!orgId) return 0;
    const res = await query<{ total: string }>(
      `SELECT COALESCE(SUM(cost_estimate), 0)::text AS total
       FROM ai_platform_usage_daily
       WHERE org_id = $1 AND usage_date >= date_trunc('month', CURRENT_DATE)::date`,
      [orgId],
    );
    return Number(res.rows[0]?.total ?? 0);
  }

  const res = await query<{ total: string }>(
    `SELECT COALESCE(SUM(estimated_cost), 0)::text AS total
     FROM ai_platform_usage_daily
     WHERE usage_date >= date_trunc('month', CURRENT_DATE)::date`,
  );
  return Number(res.rows[0]?.total ?? 0);
}

export async function pingEnvironmentUrl(url: string): Promise<'ok' | 'fail' | 'skip'> {
  if (!url.trim()) return 'skip';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'skip';
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
    return res.ok || res.status < 500 ? 'ok' : 'fail';
  } catch {
    return 'fail';
  }
}

export async function getSkillPackOverrides(): Promise<Map<string, { featured: boolean; enabled: boolean }>> {
  const assets = await listAssets('skill_pack');
  const map = new Map<string, { featured: boolean; enabled: boolean }>();
  for (const a of assets) {
    map.set(a.slug, {
      featured: Boolean(a.metadataJson.featured),
      enabled: a.status !== 'disabled',
    });
  }
  return map;
}

export async function upsertSkillPackOverride(
  slug: string,
  name: string,
  patch: { featured?: boolean; enabled?: boolean },
): Promise<void> {
  const existing = await query(`SELECT * FROM ai_platform_assets WHERE kind = 'skill_pack' AND slug = $1`, [slug]);
  if (existing.rows[0]) {
    const current = mapAsset(existing.rows[0]);
    const meta = { ...current.metadataJson };
    if (patch.featured !== undefined) meta.featured = patch.featured;
    await updateAsset(current.id, {
      status: patch.enabled === false ? 'disabled' : patch.enabled === true ? 'active' : current.status,
      metadataJson: meta,
    });
    return;
  }
  await createAsset({
    kind: 'skill_pack',
    name,
    slug,
    status: patch.enabled === false ? 'disabled' : 'active',
    metadataJson: { featured: patch.featured ?? false },
  });
}
