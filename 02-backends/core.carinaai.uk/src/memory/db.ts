import pg from 'pg';
import pgvector from 'pgvector/pg';
import { config } from '../config/index.js';
import { runMigrations } from './migrations.js';

export const pool = new pg.Pool({
  connectionString: config.database.url,
  onConnect: async (client) => {
    await pgvector.registerTypes(client);
  },
});

let initPromise: Promise<void> | null = null;

export function initDb(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const client = await pool.connect();
      try {
        await runMigrations(client);
      } finally {
        client.release();
      }
    })();
  }
  return initPromise;
}
