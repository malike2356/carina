import { randomUUID } from 'crypto';
import type pg from 'pg';
import { pool } from '../memory/db.js';
import { queryForOrg } from './scoped-query.js';
import { AI_PLATFORM_SCHEMA, DEFAULT_MODELS } from './ai-platform-schema.js';

export async function runAiPlatformMigrations(client: pg.PoolClient): Promise<void> {
  await client.query(AI_PLATFORM_SCHEMA);
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
