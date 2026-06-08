import pg from 'pg';
import { config } from './config/index.js';
import { runMigrations } from './migrations.js';

export const pool = new pg.Pool({
  connectionString: config.db.url,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[scout:db] Unexpected pool error:', err.message);
});

let migrated = false;

export async function initDb(): Promise<void> {
  if (migrated) return;
  const client = await pool.connect();
  try {
    await runMigrations(client);
    migrated = true;
  } finally {
    client.release();
  }
}
