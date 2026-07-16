import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmsAdapter } from '../sms.js';

describe('SmsAdapter', () => {
  const adapter = new SmsAdapter();

  const baseEvent = {
    id: 'evt-1',
    instance_id: 'inst-1',
    session_id: 'sess-1',
    event_type: 'injection_blocked',
    severity: 'critical' as const,
    description: 'Injection attempt blocked',
    created_at: new Date(),
    acknowledged: false,
    acknowledged_by: null,
    acknowledged_at: null,
  };

  const baseChannel = {
    id: 'ch-1',
    channel_type: 'sms' as const,
    severity_threshold: 'critical' as const,
    enabled: true,
    config: {
      account_sid: 'AC123',
      auth_token: 'tok123',
      from_number: '+1234567890',
      to_number: '+0987654321',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if Twilio credentials are missing', async () => {
    await expect(
      adapter.send(baseEvent, { ...baseChannel, config: {} }),
    ).rejects.toThrow('missing Twilio credentials');
  });

  it('formats message using templates when available', async () => {
    // Template should be available for sms:critical
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ sid: 'SM123' }), { status: 201 }),
    );

    await adapter.send(baseEvent, baseChannel);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = (fetchSpy.mock.calls[0]![1] as RequestInit).body as URLSearchParams;
    expect(body.get('Body')).toContain('[LABYRINTH CRITICAL]');
    expect(body.get('To')).toBe('+0987654321');
  });

  it('logs and rethrows on API error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Bad Request', { status: 400 }),
    );

    await expect(adapter.send(baseEvent, baseChannel)).rejects.toThrow('Twilio API error 400');
  });
});
