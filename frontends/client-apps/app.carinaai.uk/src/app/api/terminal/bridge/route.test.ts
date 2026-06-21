import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
  requireWorkspace: vi.fn(),
}));

describe('terminal bridge route', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CARINA_INTERNAL_KEY = 'bridge-test-secret';
    process.env.CARINA_CORE_URL = 'https://core.example.test';
  });

  it('returns a signed websocket url for the current workspace', async () => {
    const { getSession, requireWorkspace } = await import('@/lib/session');
    vi.mocked(getSession).mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.test', name: 'User One' },
    } as never);
    vi.mocked(requireWorkspace).mockResolvedValue({ id: 'workspace-1' } as never);

    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as { data: { wsUrl: string; expiresInSeconds: number } };
    expect(body.data.expiresInSeconds).toBe(300);

    const wsUrl = new URL(body.data.wsUrl);
    expect(wsUrl.protocol).toBe('wss:');
    expect(wsUrl.pathname).toBe('/api/terminal/ws');

    const token = wsUrl.searchParams.get('token');
    expect(token).toBeTruthy();
    const parts = String(token).split('.');
    expect(parts).toHaveLength(3);
    const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString()) as {
      kind: string;
      userId: string;
      email: string;
      workspaceId: string;
      exp: number;
    };
    expect(payload).toMatchObject({
      kind: 'terminal-bridge',
      userId: 'user-1',
      email: 'user@example.test',
      workspaceId: 'workspace-1',
    });
    expect(payload.exp).toBeGreaterThan(Date.now());
  });
});
