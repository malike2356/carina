import type pg from 'pg';

export async function runFreeScanSchemaMigration(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS free_scans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scan_run_id UUID NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
      domain TEXT NOT NULL,
      client_ip TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_free_scans_domain_created
      ON free_scans (domain, created_at DESC)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_free_scans_scan_run
      ON free_scans (scan_run_id)
  `);
}
