/**
 * Org-scoped database access helpers.
 * Every SELECT/UPDATE/DELETE on product tables must use queryForOrg or orgWhereClause.
 * Never concatenate orgId into SQL strings; always parameterize.
 */
import type pg from 'pg';
import { pool } from '../memory/db.js';
import { getPrimaryOrgForUser } from './org-service.js';

export class MissingOrgError extends Error {
  readonly statusCode = 400;

  constructor(message = 'Organization context required') {
    super(message);
    this.name = 'MissingOrgError';
  }
}

export function rejectMissingOrgId(orgId: string | undefined): asserts orgId is string {
  if (!orgId) {
    throw new MissingOrgError('Organization missing. Run: carina hosted backfill-orgs');
  }
}

export function assertOrgId(orgId: string | undefined): asserts orgId is string {
  rejectMissingOrgId(orgId);
}

export function orgWhereClause(alias?: string): string {
  const col = alias ? `${alias}.org_id` : 'org_id';
  return `${col} = $1`;
}

export async function queryForOrg<T extends pg.QueryResultRow = pg.QueryResultRow>(
  orgId: string,
  sql: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  rejectMissingOrgId(orgId);
  return pool.query<T>(sql, [orgId, ...params]);
}

export async function resolveOrgIdFromUser(userId: string): Promise<string | null> {
  const membership = await getPrimaryOrgForUser(userId);
  return membership?.orgId ?? null;
}

/** Transition helper: org_id match, or legacy tenant_id when org_id is unset. */
export function orgOrTenantWhere(alias?: string): string {
  const orgCol = alias ? `${alias}.org_id` : 'org_id';
  const tenantCol = alias ? `${alias}.tenant_id` : 'tenant_id';
  return `(${orgCol} = $1 OR (${orgCol} IS NULL AND ${tenantCol} = $2))`;
}
