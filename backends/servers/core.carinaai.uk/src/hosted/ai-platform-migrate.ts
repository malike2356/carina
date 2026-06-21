import { randomUUID } from 'crypto';
import type pg from 'pg';
import { pool } from '../memory/db.js';
import { queryForOrg } from './scoped-query.js';
import { AI_PLATFORM_SCHEMA, DEFAULT_MODELS } from './ai-platform-schema.js';

/** Legacy ops prototype tables may exist without org_id; patch before indexes run. */
const AI_PLATFORM_LEGACY_ORG_PATCHES = [
  'ai_platform_models',
  'ai_platform_workbench_runs',
  'ai_platform_environments',
  'ai_platform_deployments',
  'ai_platform_assets',
  'ai_platform_agents',
  'ai_platform_sessions',
  'ai_platform_memory_stores',
  'ai_platform_usage_daily',
].flatMap((table) => [
  `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS org_id UUID`,
]);

const AI_PLATFORM_LEGACY_CONSTRAINT_PATCHES = [
  `ALTER TABLE ai_platform_models DROP CONSTRAINT IF EXISTS ai_platform_models_provider_model_key`,
];

const AI_PLATFORM_LEGACY_COLUMN_PATCHES = [
  `ALTER TABLE ai_platform_sessions ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'workbench'`,
  `ALTER TABLE ai_platform_sessions ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE ai_platform_sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE ai_platform_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE ai_platform_workbench_runs ADD COLUMN IF NOT EXISTS tokens_cached INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE ai_platform_workbench_runs ADD COLUMN IF NOT EXISTS model_class TEXT`,
  `ALTER TABLE ai_platform_workbench_runs ADD COLUMN IF NOT EXISTS credits_billed NUMERIC(18,6) NOT NULL DEFAULT 0`,
];

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith('--'));
}

async function runSqlStatements(
  client: pg.PoolClient,
  sql: string,
  label: string,
): Promise<void> {
  for (const statement of splitSqlStatements(sql)) {
    try {
      await client.query(statement);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[${label}] skipped: ${msg.slice(0, 180)}`);
    }
  }
}

export async function runAiPlatformMigrations(client: pg.PoolClient): Promise<void> {
  for (const patch of [
    ...AI_PLATFORM_LEGACY_ORG_PATCHES,
    ...AI_PLATFORM_LEGACY_CONSTRAINT_PATCHES,
    ...AI_PLATFORM_LEGACY_COLUMN_PATCHES,
  ]) {
    try {
      await client.query(patch);
    } catch {
      // Table may not exist yet; CREATE TABLE IF NOT EXISTS below will create the org-scoped shape.
    }
  }
  await runSqlStatements(client, AI_PLATFORM_SCHEMA, 'ai-platform-migrate');
}

export async function seedDefaultModelsForOrg(orgId: string): Promise<void> {
  const existing = await queryForOrg<{ count: string }>(
    orgId,
    'SELECT COUNT(*)::TEXT AS count FROM ai_platform_models WHERE org_id = $1',
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0) return;

  for (const model of DEFAULT_MODELS) {
    await pool.query(
      `INSERT INTO ai_platform_models
        (id, org_id, provider, model, tier, is_default, status, input_price, output_price, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        randomUUID(),
        orgId,
        model.provider,
        model.model,
        model.tier,
        model.isDefault,
        model.status,
        model.inputPrice,
        model.outputPrice,
        model.notes,
      ],
    );
  }
}
