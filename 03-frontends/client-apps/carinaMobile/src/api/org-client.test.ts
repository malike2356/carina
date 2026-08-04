import { describe, expect, it, vi, beforeEach } from 'vitest';
import { acceptOrgInvite, listOrgInvites } from './org-client';

describe('org-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists pending org invites', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          invites: [
            {
              id: 'inv1',
              orgId: 'org1',
              email: 'new@example.com',
              role: 'viewer',
              expiresAt: '2026-08-01T00:00:00.000Z',
              acceptedAt: null,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await listOrgInvites('https://app.carinaai.uk');
    expect(result.invites).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.carinaai.uk/app/auth/org/invites',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('accepts an org invite token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, orgId: 'org1', role: 'viewer' }), { status: 200 }),
    );

    const result = await acceptOrgInvite('https://app.carinaai.uk', 'token123');
    expect(result.orgId).toBe('org1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.carinaai.uk/app/auth/org/invites/accept',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'token123' }),
      }),
    );
  });
});
