import pg from 'pg';
import pgvector from 'pgvector/pg';
import { isDatabaseConfigured, resolveDatabaseUrl } from '../config/database-url.js';
import { runMigrations } from './migrations.js';

let poolInstance: pg.Pool | null = null;

function getPoolInternal(): pg.Pool {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!poolInstance) {
    poolInstance = new pg.Pool({
      connectionString,
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
  }
  return poolInstance;
}

export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    const real = getPoolInternal();
    const value = Reflect.get(real, prop, real) as unknown;
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

let initPromise: Promise<void> | null = null;

export function initDb(): Promise<void> {
  if (!isDatabaseConfigured()) {
    return Promise.reject(new Error('DATABASE_URL is not configured'));
  }
  if (!initPromise) {
    initPromise = (async () => {
      const client = await pool.connect();
      try {
        await runMigrations(client);
      } finally {
        client.release();
      }
      const { refreshBillingConfigCache } = await import('../billing/billing-config.js');
      await refreshBillingConfigCache(true).catch(() => undefined);
      if (process.env.AI_WORKERS_ENABLED !== 'false') {
        const { rebuildRegistry } = await import('../channels/worker-registry.js');
        await rebuildRegistry().catch((err) => {
          console.warn('[channels] registry rebuild failed:', err);
        });
      }
    })();
  }
  return initPromise;
}
