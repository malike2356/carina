import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenericWebhookConnector } from '../generic-webhook.js';
import type { ScoutFinding } from '../types.js';

function sampleFinding(): ScoutFinding {
  return {
    id: 'finding-1',
    type: 'prompt_injection',
    severity: 'high',
    title: 'Injection blocked',
    description: 'Blocked prompt injection attempt',
    agentId: 'agent-1',
    agentName: 'Agent One',
    sessionId: 'session-1',
    timestamp: '2026-06-25T12:00:00.000Z',
    mitreAttackIds: ['T1059'],
    riskScore: 80,
    accountId: 'account-1',
  };
}

describe('GenericWebhookConnector', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 202,
        text: async () => '{"ok":true}',
        headers: new Headers({ 'x-request-id': 'req-123' }),
      }),
    );
  });

  it('POSTs default Scout payload to configured URL', async () => {
    const connector = new GenericWebhookConnector();
    await connector.init({
      url: 'https://example.com/hooks/scout',
      authHeader: 'Bearer test-token',
    });

    const result = await connector.pushFinding(sampleFinding());
    expect(result.ok).toBe(true);
    expect(result.vendorId).toBe('req-123');

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/hooks/scout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('renders template fields from finding data', async () => {
    const connector = new GenericWebhookConnector();
    await connector.init({
      url: 'https://example.com/hooks/scout',
      template: '{"title":"{{title}}","agent":"{{agentId}}"}',
    });

    await connector.pushFinding(sampleFinding());
    const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body;
    expect(String(body)).toContain('Injection blocked');
    expect(String(body)).toContain('agent-1');
  });
});
