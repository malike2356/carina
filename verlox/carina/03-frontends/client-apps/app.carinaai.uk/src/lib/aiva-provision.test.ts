import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';
import { provisionCoreAivaTrial } from '@/lib/aiva-provision';

vi.mock('@/lib/core-proxy', () => ({
  coreProxyEnabled: vi.fn(),
  resolveCoreProxyToken: vi.fn(),
  resolveCoreUrl: vi.fn(),
}));

describe('provisionCoreAivaTrial', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(coreProxyEnabled).mockReturnValue(true);
    vi.mocked(resolveCoreProxyToken).mockReturnValue('ops-token');
    vi.mocked(resolveCoreUrl).mockReturnValue('http://carina-web:3000');
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('skips when core proxy is disabled', async () => {
    vi.mocked(coreProxyEnabled).mockReturnValue(false);
    await provisionCoreAivaTrial('00000000-0000-4000-8000-000000000001');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts trial provision with workspace header and ops token', async () => {
    const workspaceId = '00000000-0000-4000-8000-000000000001';
    await provisionCoreAivaTrial(workspaceId, {
      email: 'owner@example.com',
      name: 'Owner',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://carina-web:3000/api/aiva/subscription/trial',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Workspace-Id': workspaceId,
          Authorization: 'Bearer ops-token',
          'x-internal-key': 'ops-token',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          ownerEmail: 'owner@example.com',
          ownerName: 'Owner',
          sendWelcome: true,
        }),
      }),
    );
  });
});
