import pg from 'pg';
import pgvector from 'pgvector/pg';
import { config } from '../config/index.js';
import { runMigrations } from './migrations.js';
import { rebuildRegistry } from '../channels/worker-registry.js';

export const pool = new pg.Pool({
  connectionString: config.database.url,
  onConnect: async (client) => {
    try {
      await pgvector.registerTypes(client);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('vector type not found')) throw err;
      // pgvector extension missing; non-vector queries may still work.
    }
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
      if (process.env.AI_WORKERS_ENABLED !== 'false') {
        await rebuildRegistry().catch((err) => {
          console.warn('[channels] registry rebuild failed:', err);
        });
      }
    })();
  }
  return initPromise;
}
