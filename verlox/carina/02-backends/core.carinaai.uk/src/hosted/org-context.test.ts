import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { getOrgContext, requireOrgContext } from './org-context.js';

vi.mock('../api/hosted-auth.js', () => ({
  getUserProfile: vi.fn(async (userId: string) => ({
    email: `${userId}@example.com`,
    apiKey: 'key',
    tier: 'free',
  })),
}));

vi.mock('./org-service.js', () => ({
  getPrimaryOrgForUser: vi.fn(async (userId: string) => ({
    orgId: 'org-1',
    userId,
    role: 'operator',
  })),
}));

describe('org-context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requireOrgContext returns 401 when session missing', async () => {
    const req = { session: {} } as Request;
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status, json } as unknown as Response;

    const ctx = await requireOrgContext(req, res);
    expect(ctx).toBeNull();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('requireOrgContext populates orgContext on request', async () => {
    const req = {
      session: { hostedAccountId: 'user-1' },
    } as Request;
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status, json } as unknown as Response;

    const ctx = await requireOrgContext(req, res);
    expect(ctx?.orgId).toBe('org-1');
    expect(ctx?.role).toBe('operator');
    expect(getOrgContext(req)?.userId).toBe('user-1');
  });
});
