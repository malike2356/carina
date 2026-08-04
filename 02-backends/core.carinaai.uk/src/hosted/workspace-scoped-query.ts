/**
 * Workspace-scoped database access helpers, mirroring scoped-query.ts
 * (which does the same thing for org_id). Every SELECT/UPDATE/DELETE on
 * Aiva tenant tables (ai_workers, ai_worker_*, aiva_*, channel_threads,
 * etc.) must use queryForWorkspace or workspaceWhereClause. Never
 * concatenate workspaceId into SQL strings; always parameterize.
 *
 * "workspaceId" in the Aiva product is the same UUID as organizations.id
 * in core (see createHostedAccountForProvisioning in hosted-auth.ts,
 * which returns `workspaceId: orgId`). This module names it "workspace"
 * because that is the vocabulary used across the Aiva API surface
 * (X-Workspace-Id header, req.workspaceId) and in app.carinaai.uk.
 */
import type pg from 'pg';
import { pool } from '../memory/db.js';

export class MissingWorkspaceError extends Error {
  readonly statusCode = 400;

  constructor(message = 'Workspace context required') {
    super(message);
    this.name = 'MissingWorkspaceError';
  }
}

export function rejectMissingWorkspaceId(workspaceId: string | undefined): asserts workspaceId is string {
  if (!workspaceId) {
    throw new MissingWorkspaceError('workspaceId is required');
  }
}

export function assertWorkspaceId(workspaceId: string | undefined): asserts workspaceId is string {
  rejectMissingWorkspaceId(workspaceId);
}

export function workspaceWhereClause(alias?: string): string {
  const col = alias ? `${alias}.workspace_id` : 'workspace_id';
  return `${col} = $1`;
}

export async function queryForWorkspace<T extends pg.QueryResultRow = pg.QueryResultRow>(
  workspaceId: string,
  sql: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  rejectMissingWorkspaceId(workspaceId);
  return pool.query<T>(sql, [workspaceId, ...params]);
}

/**
 * Best-effort check that a workspaceId corresponds to a real organization.
 * Disabled by default (CARINA_STRICT_WORKSPACE_CHECK=true to enable)
 * because some Aiva deployments provision workspaces outside the
 * `organizations` table (for example embedded/widget tenants); enabling
 * this only hardens the hosted SaaS path where workspaceId == org id.
 * Cached briefly per process to avoid a query on every request.
 */
const existsCache = new Map<string, number>();
const EXISTS_CACHE_TTL_MS = 60_000;

export function strictWorkspaceCheckEnabled(): boolean {
  return process.env.CARINA_STRICT_WORKSPACE_CHECK === 'true';
}

export async function workspaceExists(workspaceId: string): Promise<boolean> {
  const cached = existsCache.get(workspaceId);
  if (cached !== undefined && Date.now() - cached < EXISTS_CACHE_TTL_MS) {
    return true;
  }
  try {
    const result = await pool.query('SELECT 1 FROM organizations WHERE id = $1', [workspaceId]);
    const found = (result.rowCount ?? 0) > 0;
    if (found) existsCache.set(workspaceId, Date.now());
    return found;
  } catch {
    // If the check itself fails (for example organizations table absent in
    // a non-hosted deployment), do not block the request on it.
    return true;
  }
}

/** Reset the existence cache (tests only). */
export function _resetWorkspaceExistsCacheForTests(): void {
  existsCache.clear();
}
