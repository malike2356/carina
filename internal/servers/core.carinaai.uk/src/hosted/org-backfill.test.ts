import { describe, expect, it, vi, beforeEach } from 'vitest';

const users = [{ id: 'user-1', email: 'legacy@example.com' }];
const memberships: Array<Record<string, unknown>> = [];

vi.mock('./org-service.js', () => ({
  getPrimaryOrgForUser: vi.fn(async (userId: string) => {
    const found = memberships.find((m) => m.user_id === userId);
    if (!found) return null;
    return { orgId: String(found.org_id), userId, role: found.role };
  }),
  createOrgForUser: vi.fn(async (userId: string, email: string) => {
    const orgId = 'org-new';
    memberships.push({ org_id: orgId, user_id: userId, role: 'owner' });
    return { orgId, slug: 'legacy', role: 'owner' as const };
  }),
}));

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, ' ').trim();
      if (/FROM hosted_users hu/.test(s)) {
        const without = users.filter(
          (u) => !memberships.some((m) => m.user_id === u.id),
        );
        return { rows: without, rowCount: without.length };
      }
      if (/SELECT email FROM hosted_users WHERE id/.test(s)) {
        const id = params?.[0] as string;
        const user = users.find((u) => u.id === id);
        return { rows: user ? [{ email: user.email }] : [], rowCount: user ? 1 : 0 };
      }
      if (/UPDATE subscriptions|UPDATE usage_records|UPDATE invoices/.test(s)) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  },
}));

import { backfillAllOrgs, backfillOrgForUser } from './org-backfill.js';
import { createOrgForUser } from './org-service.js';

describe('org-backfill', () => {
  beforeEach(() => {
    memberships.length = 0;
    vi.clearAllMocks();
  });

  it('backfillAllOrgs on users without org creates orgs', async () => {
    const result = await backfillAllOrgs();
    expect(result.created).toBe(1);
    expect(createOrgForUser).toHaveBeenCalledWith('user-1', 'legacy@example.com');
  });

  it('backfillOrgForUser is idempotent', async () => {
    memberships.push({ org_id: 'org-existing', user_id: 'user-1', role: 'owner' });
    const result = await backfillOrgForUser('user-1');
    expect(result.created).toBe(false);
    expect(result.orgId).toBe('org-existing');
    expect(createOrgForUser).not.toHaveBeenCalled();
  });

  it('dry run does not call createOrgForUser', async () => {
    const result = await backfillAllOrgs({ dryRun: true });
    expect(result.created).toBe(1);
    expect(createOrgForUser).not.toHaveBeenCalled();
  });
});
