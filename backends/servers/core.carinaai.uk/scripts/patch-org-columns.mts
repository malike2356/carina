/**
 * One-shot repair for carina_central databases missing org-scoped billing columns.
 * Run from core.carinaai.uk after setting DATABASE_URL:
 *   pnpm exec tsx scripts/patch-org-columns.mts
 */
import { pool } from '../src/memory/db.js';
import { runHostedMigrations } from '../src/api/hosted-migrations.js';
import { runMigrations } from '../src/memory/migrations.js';

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('Running core memory migrations (includes org-scoped column patches)...');
    await runMigrations(client);
    console.log('Running hosted SaaS migrations...');
    await runHostedMigrations(client);
    console.log('Done. Restart carina-core if it is already running.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
