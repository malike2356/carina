import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (_sql: string, params?: unknown[]) => ({
      rows: [{ org_id: params?.[0] }],
      rowCount: 1,
    })),
  },
}));

vi.mock('./org-service.js', () => ({
  getPrimaryOrgForUser: vi.fn(async (userId: string) =>
    userId === 'user-1' ? { orgId: 'org-1', userId, role: 'owner' as const } : null,
  ),
}));

import { pool } from '../memory/db.js';
import {
  assertOrgId,
  MissingOrgError,
  orgWhereClause,
  queryForOrg,
  rejectMissingOrgId,
  resolveOrgIdFromUser,
} from './scoped-query.js';

describe('scoped-query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('orgWhereClause returns org_id = $1', () => {
    expect(orgWhereClause()).toBe('org_id = $1');
    expect(orgWhereClause('u')).toBe('u.org_id = $1');
  });

  it('rejectMissingOrgId throws for empty orgId', () => {
    expect(() => rejectMissingOrgId(undefined)).toThrow(MissingOrgError);
  });

  it('assertOrgId narrows type', () => {
    const orgId: string | undefined = 'org-1';
    assertOrgId(orgId);
    expect(orgId).toBe('org-1');
  });

  it('queryForOrg passes orgId as first param', async () => {
    await queryForOrg('org-abc', 'SELECT * FROM usage_records WHERE org_id = $1 AND date >= $2', [
      '2026-01-01',
    ]);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM usage_records WHERE org_id = $1 AND date >= $2',
      ['org-abc', '2026-01-01'],
    );
  });

  it('queryForOrg throws before query when orgId missing', async () => {
    await expect(queryForOrg('', 'SELECT 1')).rejects.toThrow(MissingOrgError);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('resolveOrgIdFromUser returns membership orgId', async () => {
    await expect(resolveOrgIdFromUser('user-1')).resolves.toBe('org-1');
    await expect(resolveOrgIdFromUser('unknown')).resolves.toBeNull();
  });
});
