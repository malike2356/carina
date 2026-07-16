import { afterEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../../memory/db.js', () => ({
  pool: {
    query: vi.fn(async () => ({ rows: [{ status: 'active' }] })),
  },
}));

describe('n8n-webhook-client', () => {
  afterEach(() => {
    mockFetch.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('emits on Scout social event when configured', async () => {
    vi.stubEnv('N8N_ILAUD_ENABLED', 'true');
    vi.stubEnv('N8N_ILAUD_WEBHOOK_URL', 'https://n8n.example/webhook/ilaud-engagement');
    vi.stubEnv('AIVA_APP_URL', 'https://admin.hireaiva.co.uk');
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const { emitIlaudN8nEvent } = await import('./n8n-webhook-client.js');
    const result = await emitIlaudN8nEvent({
      eventType: 'social_approval_requested',
      workspaceId: 'ws-1',
      workerId: 'worker-1',
      description: 'Draft waiting',
      metadata: {
        channel: 'linkedin',
        contactId: 'user-999',
        draftText: 'Thanks for reaching out',
      },
    });

    expect(result.sent).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { event: string; approvalUrl: string };
    expect(body.event).toBe('social_approval_requested');
    expect(body.approvalUrl).toContain('/aiva/approvals?tab=social');
  });

  it('skips emit when worker is not active', async () => {
    vi.stubEnv('N8N_ILAUD_ENABLED', 'true');
    vi.stubEnv('N8N_ILAUD_WEBHOOK_URL', 'https://n8n.example/webhook/ilaud-engagement');
    const { pool } = await import('../../memory/db.js');
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ status: 'suspended_by_scout' }] } as never);

    const { emitIlaudN8nEvent } = await import('./n8n-webhook-client.js');
    const result = await emitIlaudN8nEvent({
      eventType: 'social_inbound_received',
      workspaceId: 'ws-1',
      workerId: 'worker-1',
    });

    expect(result.sent).toBe(false);
    expect(result.skipped).toBe('worker_not_active');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
