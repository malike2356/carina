import { describe, expect, it, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

const invites: Array<Record<string, unknown>> = [];
const memberships: Array<Record<string, unknown>> = [];
const users = [{ id: 'user-1', email: 'jane@example.com' }];

vi.mock('../../config/index.js', () => ({
  config: {
    hosted: { appHost: 'app.test' },
    resend: { apiKey: '', from: 'test@example.com' },
  },
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: 'email-id' }) },
  })),
}));

vi.mock('../../hosted/product-audit.js', () => ({
  writeProductAudit: vi.fn(async () => undefined),
}));

vi.mock('../../hosted/invite-email.js', () => ({
  buildInviteUrl: vi.fn((token: string) => `https://app.test/hosted-register?invite=${token}`),
  sendInviteEmail: vi.fn(async () => false),
}));

vi.mock('../../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, ' ').trim();

      if (/INSERT INTO org_invites/.test(s)) {
        const id = `inv-${invites.length + 1}`;
        invites.push({
          id,
          org_id: params?.[0],
          email: params?.[1],
          role: params?.[2],
          token_hash: params?.[3],
          expires_at: params?.[4],
          accepted_at: null,
          created_at: new Date(),
        });
        return { rows: [{ id }], rowCount: 1 };
      }

      if (/SELECT name FROM organizations/.test(s)) {
        return { rows: [{ name: 'Test Org' }], rowCount: 1 };
      }

      if (/SELECT email FROM hosted_users WHERE id/.test(s)) {
        const id = params?.[0] as string;
        const user = users.find((u) => u.id === id);
        return { rows: user ? [{ email: user.email }] : [], rowCount: user ? 1 : 0 };
      }

      if (/COUNT\(\*\).*org_invites.*CURRENT_DATE/.test(s)) {
        const orgId = params?.[0] as string;
        const count = invites.filter((i) => i.org_id === orgId).length;
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }

      if (/FROM org_invites/.test(s) && /token_hash/.test(s)) {
        const hash = params?.[0] as string;
        const found = invites.filter(
          (i) => i.token_hash === hash && !i.accepted_at && (i.expires_at as Date) > new Date(),
        );
        return { rows: found, rowCount: found.length };
      }

      if (/FROM org_memberships WHERE org_id/.test(s)) {
        const orgId = params?.[0] as string;
        const userId = params?.[1] as string;
        const found = memberships.filter((m) => m.org_id === orgId && m.user_id === userId);
        return { rows: found, rowCount: found.length };
      }

      if (/INSERT INTO org_memberships/.test(s)) {
        memberships.push({
          org_id: params?.[0],
          user_id: params?.[1],
          role: params?.[2],
        });
        return { rows: [], rowCount: 1 };
      }

      if (/UPDATE org_invites SET accepted_at/.test(s)) {
        const id = params?.[0] as string;
        const invite = invites.find((i) => i.id === id);
        if (invite) invite.accepted_at = new Date();
        return { rows: [], rowCount: 1 };
      }

      if (/FROM org_invites.*WHERE org_id/.test(s)) {
        const orgId = params?.[0] as string;
        const pending = invites.filter(
          (i) => i.org_id === orgId && !i.accepted_at && (i.expires_at as Date) > new Date(),
        );
        return { rows: pending, rowCount: pending.length };
      }

      if (/DELETE FROM org_invites/.test(s)) {
        const inviteId = params?.[0] as string;
        const orgId = params?.[1] as string;
        const idx = invites.findIndex((i) => i.id === inviteId && i.org_id === orgId);
        if (idx >= 0) invites.splice(idx, 1);
        return { rows: [], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    }),
  },
}));

import {
  acceptInvite,
  createInvite,
  listPendingInvites,
  revokeInvite,
} from '../../hosted/org-invites.js';

describe('hosted org invites', () => {
  beforeEach(() => {
    invites.length = 0;
    memberships.length = 0;
  });

  it('createInvite stores hashed token', async () => {
    const { inviteId, token } = await createInvite('org-1', 'jane@example.com', 'operator', 'owner-1');
    expect(inviteId).toBeTruthy();
    expect(token.length).toBeGreaterThan(20);
    expect(invites[0].token_hash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
  });

  it('acceptInvite adds membership for valid token', async () => {
    const { token } = await createInvite('org-1', 'jane@example.com', 'operator', 'owner-1');
    const result = await acceptInvite(token, 'user-1');
    expect(result).toEqual({ orgId: 'org-1', role: 'operator' });
    expect(memberships.some((m) => m.user_id === 'user-1')).toBe(true);
  });

  it('acceptInvite rejects expired token', async () => {
    const raw = crypto.randomBytes(32).toString('hex');
    invites.push({
      id: 'expired',
      org_id: 'org-1',
      email: 'jane@example.com',
      role: 'operator',
      token_hash: crypto.createHash('sha256').update(raw).digest('hex'),
      expires_at: new Date(Date.now() - 1000),
      accepted_at: null,
    });
    await expect(acceptInvite(raw, 'user-1')).rejects.toThrow(/Invalid or expired/);
  });

  it('acceptInvite rejects duplicate membership', async () => {
    memberships.push({ org_id: 'org-1', user_id: 'user-1', role: 'viewer' });
    const { token } = await createInvite('org-1', 'jane@example.com', 'operator', 'owner-1');
    await expect(acceptInvite(token, 'user-1')).rejects.toThrow(/Already a member/);
  });

  it('listPendingInvites returns open invites', async () => {
    await createInvite('org-1', 'a@example.com', 'viewer', 'owner-1');
    const pending = await listPendingInvites('org-1');
    expect(pending).toHaveLength(1);
  });

  it('revokeInvite removes pending invite', async () => {
    const { inviteId } = await createInvite('org-1', 'b@example.com', 'auditor', 'owner-1');
    await revokeInvite('org-1', inviteId);
    const pending = await listPendingInvites('org-1');
    expect(pending).toHaveLength(0);
  });
});
