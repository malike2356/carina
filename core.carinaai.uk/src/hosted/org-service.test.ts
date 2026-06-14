import { describe, expect, it, vi, beforeEach } from 'vitest';

const orgs: Array<Record<string, unknown>> = [];
const memberships: Array<Record<string, unknown>> = [];
const subscriptions: Array<Record<string, unknown>> = [];

vi.mock('../memory/db.js', () => {
  const mockQuery = vi.fn(async (sql: string, params?: unknown[]) => {
    const s = sql.replace(/\s+/g, ' ').trim();

    if (/SELECT 1 FROM organizations WHERE slug/.test(s)) {
      const slug = params?.[0] as string;
      const found = orgs.filter((o) => o.slug === slug);
      return { rows: found, rowCount: found.length };
    }

    if (/INSERT INTO organizations/.test(s)) {
      const id = `org-${Math.random().toString(36).slice(2)}`;
      orgs.push({
        id,
        name: params?.[0],
        slug: params?.[1],
        owner_user_id: params?.[2],
        plan: 'free',
      });
      return { rows: [{ id }], rowCount: 1 };
    }

    if (/INSERT INTO org_memberships/.test(s)) {
      memberships.push({
        org_id: params?.[0],
        user_id: params?.[1],
        role: params?.[2] ?? 'owner',
        joined_at: new Date(),
      });
      return { rows: [], rowCount: 1 };
    }

    if (/INSERT INTO subscriptions/.test(s)) {
      subscriptions.push({
        tenant_id: params?.[0],
        org_id: params?.[1],
        plan: 'free',
        status: 'active',
      });
      return { rows: [], rowCount: 1 };
    }

    if (/FROM org_memberships om/.test(s)) {
      const userId = params?.[0] as string;
      const found = memberships.filter((m) => m.user_id === userId);
      return {
        rows: found.map((m) => ({
          org_id: m.org_id,
          user_id: m.user_id,
          role: m.role,
        })),
        rowCount: found.length,
      };
    }

    if (/SELECT id, name, plan FROM organizations/.test(s)) {
      const id = params?.[0] as string;
      const found = orgs.filter((o) => o.id === id);
      return {
        rows: found.map((o) => ({ id: o.id, name: o.name, plan: o.plan })),
        rowCount: found.length,
      };
    }

    return { rows: [], rowCount: 0 };
  });

  return { pool: { query: mockQuery } };
});

import { createOrgForUser, getPrimaryOrgForUser, slugifyOrgName } from './org-service.js';

describe('org-service', () => {
  beforeEach(() => {
    orgs.length = 0;
    memberships.length = 0;
    subscriptions.length = 0;
  });

  it('slugifyOrgName produces a safe slug from email', () => {
    expect(slugifyOrgName('user@example.com')).toBe('user');
  });

  it('createOrgForUser inserts org and membership', async () => {
    const result = await createOrgForUser('user-1', 'owner@example.com');
    expect(result.orgId).toBeTruthy();
    expect(result.role).toBe('owner');
    expect(memberships.some((m) => m.user_id === 'user-1' && m.role === 'owner')).toBe(true);
    expect(subscriptions.some((s) => s.tenant_id === 'user-1' && s.org_id === result.orgId)).toBe(true);
  });

  it('getPrimaryOrgForUser returns owner role', async () => {
    const { orgId } = await createOrgForUser('user-2', 'alice@example.com');
    const membership = await getPrimaryOrgForUser('user-2');
    expect(membership).toEqual({ orgId, userId: 'user-2', role: 'owner' });
  });
});
