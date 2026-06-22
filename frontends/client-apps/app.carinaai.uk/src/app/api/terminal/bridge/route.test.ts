import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
  requireWorkspace: vi.fn(),
}));

describe('terminal bridge route', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CARINA_INTERNAL_KEY = 'bridge-test-secret';
    delete process.env.CARINA_CORE_URL;
    delete process.env.CARINA_CORE_PUBLIC_URL;
    delete process.env.NEXT_PUBLIC_CARINA_CORE_URL;
  });

  it('returns a same-origin wss url for the cloud app host', async () => {
    const { getSession, requireWorkspace } = await import('@/lib/session');
    vi.mocked(getSession).mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.test', name: 'User One' },
    } as never);
    vi.mocked(requireWorkspace).mockResolvedValue({ id: 'workspace-1' } as never);

    const { GET } = await import('./route');
    const request = new Request('https://app.example.test/api/terminal/bridge', {
      headers: {
        host: 'app.example.test',
        'x-forwarded-proto': 'https',
      },
    });
    const res = await GET(request);
    expect(res.status).toBe(200);

    const body = await res.json() as { data: { token: string; wsUrl: string; expiresInSeconds: number } };
    expect(body.data.expiresInSeconds).toBe(300);
    expect(body.data.token).toBeTruthy();

    const wsUrl = new URL(body.data.wsUrl);
    expect(wsUrl.protocol).toBe('wss:');
    expect(wsUrl.hostname).toBe('app.example.test');
    expect(wsUrl.pathname).toBe('/api/terminal/ws');

    const token = wsUrl.searchParams.get('token');
    expect(token).toBe(body.data.token);
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

  it('never returns ws or an internal host when proxied from run-server', async () => {
    process.env.BETTER_AUTH_URL = 'https://app.carinaai.uk';
    process.env.NODE_ENV = 'production';
    const { getSession, requireWorkspace } = await import('@/lib/session');
    vi.mocked(getSession).mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.test', name: 'User One' },
    } as never);
    vi.mocked(requireWorkspace).mockResolvedValue({ id: 'workspace-1' } as never);

    const { GET } = await import('./route');
    const request = new Request('http://127.0.0.1:4102/api/terminal/bridge', {
      headers: {
        host: '127.0.0.1:4102',
        'x-forwarded-host': 'app.carinaai.uk',
        'x-forwarded-proto': 'http',
      },
    });
    const res = await GET(request);
    const body = await res.json() as { data: { wsUrl: string } };
    const wsUrl = new URL(body.data.wsUrl);
    expect(wsUrl.protocol).toBe('wss:');
    expect(wsUrl.hostname).toBe('app.carinaai.uk');
  });
});
