/**
 * Seeds the staging Postgres database with Aiva trial data and a bootstrap admin operator.
 * Run via: pnpm exec tsx scripts/seed-staging.ts
 * Or: bash docker/scripts/seed-staging.sh
 */
import crypto from 'node:crypto';
import pg from 'pg';
import { pool } from '../dist/src/memory/db.js';
import { runMigrations } from '../dist/src/memory/migrations.js';

const STAGING_WORKSPACE_ID = '00000000-0000-4000-a000-000000000001';
const STAGING_WORKER_ID = '00000000-0000-4000-a000-000000000010';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for seed-staging');
  }

  const bootstrap = new pg.Client({ connectionString: databaseUrl });
  await bootstrap.connect();
  await bootstrap.query('CREATE EXTENSION IF NOT EXISTS vector');
  await bootstrap.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await bootstrap.end();

  const client = await pool.connect();
  try {
    await runMigrations(client);
  } finally {
    client.release();
  }

  const adminEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@staging.carinaai.uk').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? 'AdminPassword123!';
  const contactEmail = (process.env.STAGING_CONTACT_EMAIL ?? 'test@staging.carinaai.uk').toLowerCase().trim();

  await pool.query(
    `INSERT INTO aiva_workspace_contacts (workspace_id, owner_email, owner_name)
     VALUES ($1, $2, 'Staging Test')
     ON CONFLICT (workspace_id) DO UPDATE SET
       owner_email = EXCLUDED.owner_email,
       owner_name = EXCLUDED.owner_name,
       deleted_at = NULL,
       updated_at = NOW()`,
    [STAGING_WORKSPACE_ID, contactEmail],
  );

  await pool.query(
    `INSERT INTO aiva_subscriptions
       (workspace_id, plan_tier, status, trial_ends_at, aiva_slot_limit)
     VALUES ($1, 'trial', 'trialing', NOW() + INTERVAL '14 days', 1)
     ON CONFLICT (workspace_id) DO UPDATE SET
       plan_tier = 'trial',
       status = 'trialing',
       trial_ends_at = NOW() + INTERVAL '14 days',
       aiva_slot_limit = 1,
       updated_at = NOW()`,
    [STAGING_WORKSPACE_ID],
  );

  await pool.query(
    `INSERT INTO ai_workers
       (id, workspace_id, name, role_description, template_id, persona_prompt, status, channels, skill_packs)
     VALUES ($1, $2, 'Staging Aiva', 'Customer support for staging smoke tests', 'customer-support', 'You are a helpful staging assistant.', 'active', ARRAY['web']::text[], ARRAY[]::text[])
     ON CONFLICT (id) DO UPDATE SET
       workspace_id = EXCLUDED.workspace_id,
       name = EXCLUDED.name,
       status = 'active',
       updated_at = NOW()`,
    [STAGING_WORKER_ID, STAGING_WORKSPACE_ID],
  );

  await pool.query('DELETE FROM ai_worker_channels WHERE worker_id = $1 AND channel = $2', [
    STAGING_WORKER_ID,
    'web',
  ]);
  await pool.query(
    `INSERT INTO ai_worker_channels (worker_id, workspace_id, channel, identifier, credentials, enabled, verified)
     VALUES ($1, $2, 'web', $3, '{}'::jsonb, true, true)`,
    [STAGING_WORKER_ID, STAGING_WORKSPACE_ID, `web:${STAGING_WORKER_ID}`],
  );

  await pool.query(
    `INSERT INTO admin_operators (email, password_hash, name, totp_enabled)
     VALUES ($1, $2, 'Staging Admin', false)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name`,
    [adminEmail, hashPassword(adminPassword)],
  );

  console.log('[seed-staging] Seeded workspace:', STAGING_WORKSPACE_ID);
  console.log('[seed-staging] Sample worker:', STAGING_WORKER_ID);
  console.log('[seed-staging] Admin operator:', adminEmail);
  console.log('[seed-staging] Contact email:', contactEmail);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[seed-staging] failed:', err);
    void pool.end();
    process.exit(1);
  });
