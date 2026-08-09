import type { PoolClient, QueryResultRow } from 'pg';
import { pool } from '../../memory/db.js';
import { rejectMissingWorkspaceId } from '../../hosted/workspace-scoped-query.js';

export async function withOutreachTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Workspace-scoped advisory lock (transaction-level). */
export async function lockOutreachWorkspace(client: PoolClient, workspaceId: string): Promise<void> {
  rejectMissingWorkspaceId(workspaceId);
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
    'outreach',
    workspaceId,
  ]);
}

export async function queryWs<T extends QueryResultRow = QueryResultRow>(
  client: PoolClient | typeof pool,
  workspaceId: string,
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; rowCount: number }> {
  rejectMissingWorkspaceId(workspaceId);
  const result = await client.query<T>(sql, [workspaceId, ...params]);
  return { rows: result.rows, rowCount: result.rowCount ?? 0 };
}
