import { randomUUID } from 'crypto';
import { pool } from '../memory/db.js';
import { listAvailablePacks } from '../skills/index.js';
import { queryForOrg } from './scoped-query.js';
import { writeProductAudit } from './product-audit.js';

export class ControlPlaneValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ControlPlaneValidationError';
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'item';
}

export interface PlatformAsset {
  id: string;
  orgId: string;
  kind: 'file' | 'batch';
  name: string;
  status: string;
  mimeType: string | null;
  sizeBytes: number | null;
  storageUri: string | null;
  batchInputCount: number | null;
  batchOutputCount: number | null;
  metadataJson: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformAgent {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  status: string;
  model: string;
  provider: string;
  instructions: string | null;
  metadataJson: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformSession {
  id: string;
  orgId: string;
  agentId: string | null;
  title: string;
  channel: string;
  status: string;
  messageCount: number;
  lastActivityAt: Date;
  metadataJson: Record<string, unknown>;
  createdAt: Date;
}

export interface PlatformMemoryStore {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  storeType: string;
  status: string;
  recordCount: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformUsageDaily {
  usageDate: string;
  tokensIn: number;
  tokensOut: number;
  creditsBilled: number;
  costEstimate: number;
  requestCount: number;
}

export interface ControlPlaneSummary {
  files: number;
  batches: number;
  agents: number;
  sessions: number;
  memoryStores: number;
  workbenchRuns: number;
  deployments: number;
  environments: number;
  skillPacksInstalled: number;
}

export interface PlatformSkillPack {
  name: string;
  version: string;
  description: string;
  skillCount: number;
  installed: boolean;
  status: string | null;
}

export interface PlatformAnalytics {
  days: number;
  totals: {
    tokensIn: number;
    tokensOut: number;
    creditsBilled: number;
    costEstimate: number;
    requestCount: number;
  };
  daily: PlatformUsageDaily[];
  workbenchRuns: number;
}

function mapAsset(row: Record<string, unknown>): PlatformAsset {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    kind: String(row.kind) as 'file' | 'batch',
    name: String(row.name),
    status: String(row.status),
    mimeType: row.mime_type != null ? String(row.mime_type) : null,
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    storageUri: row.storage_uri != null ? String(row.storage_uri) : null,
    batchInputCount: row.batch_input_count != null ? Number(row.batch_input_count) : null,
    batchOutputCount: row.batch_output_count != null ? Number(row.batch_output_count) : null,
    metadataJson: (row.metadata_json ?? {}) as Record<string, unknown>,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function mapAgent(row: Record<string, unknown>): PlatformAgent {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    name: String(row.name),
    slug: String(row.slug),
    status: String(row.status),
    model: String(row.model),
    provider: String(row.provider),
    instructions: row.instructions != null ? String(row.instructions) : null,
    metadataJson: (row.metadata_json ?? {}) as Record<string, unknown>,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function mapSession(row: Record<string, unknown>): PlatformSession {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    agentId: row.agent_id != null ? String(row.agent_id) : null,
    title: String(row.title),
    channel: String(row.channel),
    status: String(row.status),
    messageCount: Number(row.message_count ?? 0),
    lastActivityAt: row.last_activity_at as Date,
    metadataJson: (row.metadata_json ?? {}) as Record<string, unknown>,
    createdAt: row.created_at as Date,
  };
}

function mapMemoryStore(row: Record<string, unknown>): PlatformMemoryStore {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    name: String(row.name),
    slug: String(row.slug),
    storeType: String(row.store_type),
    status: String(row.status),
    recordCount: Number(row.record_count ?? 0),
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function mapUsageDaily(row: Record<string, unknown>): PlatformUsageDaily {
  const date = row.usage_date;
  const usageDate = date instanceof Date
    ? date.toISOString().slice(0, 10)
    : String(date).slice(0, 10);
  return {
    usageDate,
    tokensIn: Number(row.tokens_in ?? 0),
    tokensOut: Number(row.tokens_out ?? 0),
    creditsBilled: Number(row.credits_billed ?? 0),
    costEstimate: Number(row.cost_estimate ?? 0),
    requestCount: Number(row.request_count ?? 0),
  };
}

async function countForOrg(orgId: string, table: string, extraWhere = ''): Promise<number> {
  const result = await queryForOrg<{ count: string }>(
    orgId,
    `SELECT COUNT(*)::TEXT AS count FROM ${table} WHERE org_id = $1${extraWhere}`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function listFilesForOrg(orgId: string): Promise<PlatformAsset[]> {
  const result = await queryForOrg(
    orgId,
    `SELECT id, org_id, kind, name, status, mime_type, size_bytes, storage_uri,
            batch_input_count, batch_output_count, metadata_json, created_at, updated_at
     FROM ai_platform_assets
     WHERE org_id = $1 AND kind = 'file'
     ORDER BY created_at DESC`,
  );
  return result.rows.map(mapAsset);
}

export async function createFileForOrg(
  orgId: string,
  input: { name: string; mimeType?: string; sizeBytes?: number; storageUri?: string; notes?: string },
  actorUserId: string,
): Promise<PlatformAsset> {
  const name = input.name.trim();
  if (!name) throw new ControlPlaneValidationError('name is required');
  const id = randomUUID();
  await queryForOrg(
    orgId,
    `INSERT INTO ai_platform_assets
      (id, org_id, kind, name, status, mime_type, size_bytes, storage_uri, metadata_json)
     VALUES ($2, $1, 'file', $3, 'ready', $4, $5, $6, $7)`,
    [
      id,
      name,
      input.mimeType?.trim() || null,
      input.sizeBytes ?? null,
      input.storageUri?.trim() || null,
      JSON.stringify(input.notes ? { notes: input.notes } : {}),
    ],
  );
  await writeProductAudit({
    orgId,
    actorUserId,
    action: 'platform.file.created',
    resourceType: 'platform_file',
    resourceId: id,
    details: { name },
  });
  const rows = await listFilesForOrg(orgId);
  const created = rows.find((row) => row.id === id);
  if (!created) throw new Error('file create failed');
  return created;
}

export async function listBatchesForOrg(orgId: string): Promise<PlatformAsset[]> {
  const result = await queryForOrg(
    orgId,
    `SELECT id, org_id, kind, name, status, mime_type, size_bytes, storage_uri,
            batch_input_count, batch_output_count, metadata_json, created_at, updated_at
     FROM ai_platform_assets
     WHERE org_id = $1 AND kind = 'batch'
     ORDER BY created_at DESC`,
  );
  return result.rows.map(mapAsset);
}

export async function createBatchForOrg(
  orgId: string,
  input: { name: string; inputCount?: number; notes?: string },
  actorUserId: string,
): Promise<PlatformAsset> {
  const name = input.name.trim();
  if (!name) throw new ControlPlaneValidationError('name is required');
  const id = randomUUID();
  const inputCount = Math.max(0, Number(input.inputCount ?? 0));
  await queryForOrg(
    orgId,
    `INSERT INTO ai_platform_assets
      (id, org_id, kind, name, status, batch_input_count, batch_output_count, metadata_json)
     VALUES ($2, $1, 'batch', $3, 'queued', $4, 0, $5)`,
    [
      id,
      name,
      inputCount,
      JSON.stringify(input.notes ? { notes: input.notes } : {}),
    ],
  );
  await writeProductAudit({
    orgId,
    actorUserId,
    action: 'platform.batch.created',
    resourceType: 'platform_batch',
    resourceId: id,
    details: { name, inputCount },
  });
  const rows = await listBatchesForOrg(orgId);
  const created = rows.find((row) => row.id === id);
  if (!created) throw new Error('batch create failed');
  return created;
}

export async function listAgentsForOrg(orgId: string): Promise<PlatformAgent[]> {
  const result = await queryForOrg(
    orgId,
    `SELECT id, org_id, name, slug, status, model, provider, instructions, metadata_json, created_at, updated_at
     FROM ai_platform_agents
     WHERE org_id = $1
     ORDER BY name`,
  );
  return result.rows.map(mapAgent);
}

export async function createAgentForOrg(
  orgId: string,
  input: {
    name: string;
    slug?: string;
    provider?: string;
    model?: string;
    instructions?: string;
    status?: string;
  },
  actorUserId: string,
): Promise<PlatformAgent> {
  const name = input.name.trim();
  if (!name) throw new ControlPlaneValidationError('name is required');
  const slug = slugify(input.slug?.trim() || name);
  const id = randomUUID();
  await queryForOrg(
    orgId,
    `INSERT INTO ai_platform_agents
      (id, org_id, name, slug, status, model, provider, instructions)
     VALUES ($2, $1, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      name,
      slug,
      input.status?.trim() || 'active',
      input.model?.trim() || '',
      input.provider?.trim() || '',
      input.instructions?.trim() || null,
    ],
  );
  await writeProductAudit({
    orgId,
    actorUserId,
    action: 'platform.agent.created',
    resourceType: 'platform_agent',
    resourceId: id,
    details: { name, slug },
  });
  const rows = await listAgentsForOrg(orgId);
  const created = rows.find((row) => row.id === id);
  if (!created) throw new Error('agent create failed');
  return created;
}

export async function listSessionsForOrg(orgId: string, limit = 50): Promise<PlatformSession[]> {
  const safeLimit = Math.min(Math.max(1, limit), 200);
  const result = await queryForOrg(
    orgId,
    `SELECT id, org_id, agent_id, title, channel, status, message_count, last_activity_at, metadata_json, created_at
     FROM ai_platform_sessions
     WHERE org_id = $1
     ORDER BY last_activity_at DESC
     LIMIT ${safeLimit}`,
  );
  return result.rows.map(mapSession);
}

export async function createSessionForOrg(
  orgId: string,
  input: { title?: string; channel?: string; agentId?: string },
  actorUserId: string,
): Promise<PlatformSession> {
  const title = (input.title?.trim() || 'Untitled session');
  const channel = input.channel?.trim() || 'workbench';
  const id = randomUUID();
  await queryForOrg(
    orgId,
    `INSERT INTO ai_platform_sessions
      (id, org_id, agent_id, title, channel, status)
     VALUES ($2, $1, $3, $4, $5, 'open')`,
    [id, input.agentId?.trim() || null, title, channel],
  );
  await writeProductAudit({
    orgId,
    actorUserId,
    action: 'platform.session.created',
    resourceType: 'platform_session',
    resourceId: id,
    details: { title, channel },
  });
  const rows = await listSessionsForOrg(orgId, 200);
  const created = rows.find((row) => row.id === id);
  if (!created) throw new Error('session create failed');
  return created;
}

export async function listMemoryStoresForOrg(orgId: string): Promise<PlatformMemoryStore[]> {
  const result = await queryForOrg(
    orgId,
    `SELECT id, org_id, name, slug, store_type, status, record_count, notes, created_at, updated_at
     FROM ai_platform_memory_stores
     WHERE org_id = $1
     ORDER BY name`,
  );
  return result.rows.map(mapMemoryStore);
}

export async function createMemoryStoreForOrg(
  orgId: string,
  input: { name: string; slug?: string; storeType?: string; notes?: string },
  actorUserId: string,
): Promise<PlatformMemoryStore> {
  const name = input.name.trim();
  if (!name) throw new ControlPlaneValidationError('name is required');
  const slug = slugify(input.slug?.trim() || name);
  const storeType = input.storeType?.trim() || 'episodic';
  const id = randomUUID();
  await queryForOrg(
    orgId,
    `INSERT INTO ai_platform_memory_stores
      (id, org_id, name, slug, store_type, status, notes)
     VALUES ($2, $1, $3, $4, $5, 'active', $6)`,
    [id, name, slug, storeType, input.notes?.trim() || null],
  );
  await writeProductAudit({
    orgId,
    actorUserId,
    action: 'platform.memory_store.created',
    resourceType: 'platform_memory_store',
    resourceId: id,
    details: { name, slug, storeType },
  });
  const rows = await listMemoryStoresForOrg(orgId);
  const created = rows.find((row) => row.id === id);
  if (!created) throw new Error('memory store create failed');
  return created;
}

export async function listSkillPacksForTenant(tenantId: string): Promise<PlatformSkillPack[]> {
  const available = listAvailablePacks();
  let installed: Array<{ pack_name: string; version: string; status: string }> = [];
  try {
    const result = await pool.query<{ pack_name: string; version: string; status: string }>(
      `SELECT pack_name, version, status
       FROM installed_packs
       WHERE tenant_id = $1
       ORDER BY pack_name`,
      [tenantId],
    );
    installed = result.rows;
  } catch {
    installed = [];
  }
  const installedByName = new Map(installed.map((row) => [row.pack_name, row]));
  return available.map((pack) => {
    const row = installedByName.get(pack.name);
    return {
      name: pack.name,
      version: row?.version ?? pack.version,
      description: pack.description ?? '',
      skillCount: pack.skillCount ?? 0,
      installed: Boolean(row),
      status: row?.status ?? null,
    };
  });
}

export async function syncUsageDailyFromWorkbench(orgId: string, days = 30): Promise<void> {
  const safeDays = Math.min(Math.max(1, days), 90);
  await queryForOrg(
    orgId,
    `INSERT INTO ai_platform_usage_daily
      (id, org_id, usage_date, tokens_in, tokens_out, credits_billed, cost_estimate, request_count, updated_at)
     SELECT
       gen_random_uuid(),
       org_id,
       DATE(created_at) AS usage_date,
       COALESCE(SUM(tokens_in), 0),
       COALESCE(SUM(tokens_out), 0),
       COALESCE(SUM(credits_billed), 0),
       COALESCE(SUM(cost_estimate), 0),
       COUNT(*)::INTEGER,
       NOW()
     FROM ai_platform_workbench_runs
     WHERE org_id = $1
       AND created_at >= (CURRENT_DATE - $2::INTEGER)
     GROUP BY org_id, DATE(created_at)
     ON CONFLICT (org_id, usage_date) DO UPDATE SET
       tokens_in = EXCLUDED.tokens_in,
       tokens_out = EXCLUDED.tokens_out,
       credits_billed = EXCLUDED.credits_billed,
       cost_estimate = EXCLUDED.cost_estimate,
       request_count = EXCLUDED.request_count,
       updated_at = NOW()`,
    [safeDays],
  );
}

export async function getAnalyticsForOrg(orgId: string, days = 30): Promise<PlatformAnalytics> {
  const safeDays = Math.min(Math.max(1, days), 90);
  await syncUsageDailyFromWorkbench(orgId, safeDays);
  const dailyResult = await queryForOrg(
    orgId,
    `SELECT usage_date, tokens_in, tokens_out, credits_billed, cost_estimate, request_count
     FROM ai_platform_usage_daily
     WHERE org_id = $1
       AND usage_date >= (CURRENT_DATE - $2::INTEGER)
     ORDER BY usage_date DESC`,
    [safeDays],
  );
  const daily = dailyResult.rows.map(mapUsageDaily);
  const totals = daily.reduce(
    (acc, row) => ({
      tokensIn: acc.tokensIn + row.tokensIn,
      tokensOut: acc.tokensOut + row.tokensOut,
      creditsBilled: acc.creditsBilled + row.creditsBilled,
      costEstimate: acc.costEstimate + row.costEstimate,
      requestCount: acc.requestCount + row.requestCount,
    }),
    { tokensIn: 0, tokensOut: 0, creditsBilled: 0, costEstimate: 0, requestCount: 0 },
  );
  const workbenchRuns = await countForOrg(orgId, 'ai_platform_workbench_runs');
  return { days: safeDays, totals, daily, workbenchRuns };
}

export async function getControlPlaneSummary(
  orgId: string,
  tenantId: string,
): Promise<ControlPlaneSummary> {
  const [
    files,
    batches,
    agents,
    sessions,
    memoryStores,
    workbenchRuns,
    deployments,
    environments,
    skillPacks,
  ] = await Promise.all([
    countForOrg(orgId, 'ai_platform_assets', " AND kind = 'file'"),
    countForOrg(orgId, 'ai_platform_assets', " AND kind = 'batch'"),
    countForOrg(orgId, 'ai_platform_agents'),
    countForOrg(orgId, 'ai_platform_sessions'),
    countForOrg(orgId, 'ai_platform_memory_stores'),
    countForOrg(orgId, 'ai_platform_workbench_runs'),
    countForOrg(orgId, 'ai_platform_deployments'),
    countForOrg(orgId, 'ai_platform_environments'),
    listSkillPacksForTenant(tenantId),
  ]);
  return {
    files,
    batches,
    agents,
    sessions,
    memoryStores,
    workbenchRuns,
    deployments,
    environments,
    skillPacksInstalled: skillPacks.filter((pack) => pack.installed).length,
  };
}
