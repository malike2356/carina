import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { signPayload, verifyPayloadSignature } from './store.js';

describe('webhook signing', () => {
  it('produces consistent HMAC signatures', () => {
    const sig1 = signPayload('secret', '{"event":"test"}');
    const sig2 = signPayload('secret', '{"event":"test"}');
    expect(sig1).toBe(sig2);
    expect(sig1.length).toBe(64);
  });

  it('differs for different secrets', () => {
    const a = signPayload('secret-a', 'body');
    const b = signPayload('secret-b', 'body');
    expect(a).not.toBe(b);
  });

  it('rejects invalid signatures', () => {
    const body = '{"event":"test"}';
    const sig = signPayload('secret', body);
    expect(verifyPayloadSignature('secret', body, sig)).toBe(true);
    expect(verifyPayloadSignature('secret', body, 'deadbeef'.repeat(8))).toBe(false);
    expect(verifyPayloadSignature('wrong', body, sig)).toBe(false);
  });
});

describe('webhook dispatcher delivery', () => {
  const fetchMock = vi.fn();
  const queryMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    queryMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('../memory/db.js', () => ({ pool: { query: queryMock } }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('delivers to active subscriptions and logs success', async () => {
    const subRow = {
      id: 'sub-1',
      url: 'https://example.com/hook',
      events: ['agent.turn.complete'],
      secret: 'sec',
      active: true,
      name: null,
      description: null,
      max_attempts: 5,
      created_at: new Date(),
      updated_at: new Date(),
      disabled_at: null,
    };
    const deliveryRow = {
      id: 'd1',
      subscription_id: 'sub-1',
      event: 'agent.turn.complete',
      payload: {},
      status: 'pending',
      http_status: null,
      attempt_count: 0,
      max_attempts: 5,
      error_message: null,
      next_retry_at: null,
      created_at: new Date(),
      delivered_at: null,
    };

    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('webhook_subscriptions') && sql.includes('ANY')) {
        return { rows: [subRow] };
      }
      if (sql.includes('webhook_subscriptions') && sql.includes('WHERE id')) {
        return { rows: [subRow] };
      }
      if (sql.includes('INSERT INTO webhook_deliveries')) {
        return { rows: [deliveryRow] };
      }
      if (sql.includes('UPDATE webhook_deliveries')) {
        return { rows: [{ ...deliveryRow, status: 'delivered', attempt_count: 1 }] };
      }
      return { rows: [] };
    });

    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const { dispatchWebhook } = await import('./dispatcher.js');
    const result = await dispatchWebhook('agent.turn.complete', { hello: true });
    expect(result.delivered).toBe(1);
    expect(fetchMock).toHaveBeenCalled();
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['X-Carina-Signature']).toBeTruthy();
  });

  it('skips disabled subscriptions', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { dispatchWebhook } = await import('./dispatcher.js');
    const result = await dispatchWebhook('cron.complete', {});
    expect(result.delivered).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
