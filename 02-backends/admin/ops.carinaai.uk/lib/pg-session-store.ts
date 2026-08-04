import session from 'express-session';
import { pool, query } from './db.js';

const TABLE = 'ops_express_sessions';

type SessionData = session.SessionData;

/**
 * Postgres-backed express-session store.
 * Survives container restarts (unlike the default MemoryStore).
 */
export class PgSessionStore extends session.Store {
  private ready: Promise<void>;

  constructor() {
    super();
    this.ready = this.ensureTable();
  }

  private async ensureTable(): Promise<void> {
    await query(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        sid VARCHAR(255) PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMPTZ NOT NULL
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS ${TABLE}_expire_idx
      ON ${TABLE} (expire)
    `);
  }

  override get(
    sid: string,
    callback: (err: unknown, session?: SessionData | null) => void,
  ): void {
    void this.ready
      .then(async () => {
        const result = await query<{ sess: SessionData }>(
          `SELECT sess FROM ${TABLE}
           WHERE sid = $1 AND expire > NOW()`,
          [sid],
        );
        callback(null, result.rows[0]?.sess ?? null);
      })
      .catch((err) => callback(err));
  }

  override set(
    sid: string,
    sess: SessionData,
    callback?: (err?: unknown) => void,
  ): void {
    const maxAge = sess.cookie?.maxAge;
    const ttlMs = typeof maxAge === 'number' && maxAge > 0
      ? maxAge
      : 24 * 60 * 60 * 1000;
    const expire = new Date(Date.now() + ttlMs);

    void this.ready
      .then(async () => {
        await query(
          `INSERT INTO ${TABLE} (sid, sess, expire)
           VALUES ($1, $2::jsonb, $3)
           ON CONFLICT (sid) DO UPDATE
             SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
          [sid, JSON.stringify(sess), expire.toISOString()],
        );
        callback?.();
      })
      .catch((err) => callback?.(err));
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    void this.ready
      .then(async () => {
        await query(`DELETE FROM ${TABLE} WHERE sid = $1`, [sid]);
        callback?.();
      })
      .catch((err) => callback?.(err));
  }

  override touch(
    sid: string,
    sess: SessionData,
    callback?: (err?: unknown) => void,
  ): void {
    const maxAge = sess.cookie?.maxAge;
    const ttlMs = typeof maxAge === 'number' && maxAge > 0
      ? maxAge
      : 24 * 60 * 60 * 1000;
    const expire = new Date(Date.now() + ttlMs);

    void this.ready
      .then(async () => {
        await query(
          `UPDATE ${TABLE} SET expire = $2 WHERE sid = $1`,
          [sid, expire.toISOString()],
        );
        callback?.();
      })
      .catch((err) => callback?.(err));
  }

  /** Best-effort cleanup of expired rows (safe to call on a timer). */
  async pruneExpired(): Promise<number> {
    await this.ready;
    const result = await query(`DELETE FROM ${TABLE} WHERE expire <= NOW()`);
    return result.rowCount ?? 0;
  }
}

export async function createPgSessionStore(): Promise<PgSessionStore> {
  // Verify DB is reachable before mounting the store; fail soft to MemoryStore caller.
  await pool.query('SELECT 1');
  const store = new PgSessionStore();
  await store.pruneExpired().catch(() => 0);
  return store;
}
