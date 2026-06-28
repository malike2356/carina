import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/core-proxy', () => ({
  coreProxyEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/aiva-proxy', () => ({
  proxyAivaRequest: vi.fn(),
}));

vi.mock('@/lib/calendar-connection', () => ({
  getWorkspaceCalendarConnection: vi.fn(async () => null),
  isCalendarConnectionConfigured: vi.fn(() => false),
  toConnectionView: vi.fn(),
}));

vi.mock('@/lib/pairing', () => ({
  listPairingDevices: vi.fn(async () => []),
}));

import { coreProxyEnabled } from '@/lib/core-proxy';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { loadIntegrationStatuses } from '@/lib/integration-status';

describe('loadIntegrationStatuses', () => {
  beforeEach(() => {
    vi.mocked(coreProxyEnabled).mockReturnValue(true);
    vi.mocked(proxyAivaRequest).mockReset();
  });

  it('fetches workers once and maps aiva channel status', async () => {
    vi.mocked(proxyAivaRequest).mockImplementation(async (_workspaceId, path) => {
      if (path === '/api/aiva/workers') {
        return new Response(JSON.stringify({ workers: [{ id: 'w1' }, { id: 'w2' }] }), { status: 200 });
      }
      if (path === '/api/aiva/workers/w1/channels') {
        return new Response(
          JSON.stringify({
            channels: [
              { type: 'slack', connected: true },
              { type: 'whatsapp', connected: false },
            ],
          }),
          { status: 200 },
        );
      }
      if (path === '/api/aiva/workers/w2/channels') {
        return new Response(
          JSON.stringify({
            channels: [
              { type: 'slack', connected: false },
              { type: 'whatsapp', connected: true },
            ],
          }),
          { status: 200 },
        );
      }
      if (path === '/api/trello/settings') {
        return new Response(JSON.stringify({ configured: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    });

    const statuses = await loadIntegrationStatuses('ws-1');

    const workersCalls = vi.mocked(proxyAivaRequest).mock.calls.filter(
      ([, path]) => path === '/api/aiva/workers',
    );
    expect(workersCalls).toHaveLength(1);
    expect(statuses.slack).toBe('partial');
    expect(statuses.whatsapp).toBe('partial');
    expect(statuses.trello).toBe('connected');
  });

  it('marks aiva integrations unknown when core proxy fails', async () => {
    vi.mocked(proxyAivaRequest).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );

    const statuses = await loadIntegrationStatuses('ws-1');

    expect(statuses.slack).toBe('unknown');
    expect(statuses.calendar).toBe('not_connected');
  });
});
