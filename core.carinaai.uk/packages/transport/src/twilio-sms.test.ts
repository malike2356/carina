import { describe, expect, it, vi } from 'vitest';
import { buildTwilioBasicAuth, sendTwilioSms } from './twilio-sms.js';

describe('sendTwilioSms', () => {
  it('throws when credentials are incomplete', async () => {
    await expect(sendTwilioSms({
      accountSid: '',
      authToken: 'tok',
      from: '+1',
      to: '+2',
      body: 'hi',
    })).rejects.toThrow('accountSid, authToken, from, and to are required');
  });

  it('posts form-encoded body to Twilio', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ sid: 'SM123' }), { status: 201 }),
    );

    await sendTwilioSms({
      accountSid: 'AC123',
      authToken: 'tok123',
      from: '+1111',
      to: '+2222',
      body: '[LABYRINTH] alert',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(String(url)).toContain('/Accounts/AC123/Messages.json');
    const params = init?.body as URLSearchParams;
    expect(params.get('To')).toBe('+2222');
    expect(params.get('Body')).toBe('[LABYRINTH] alert');
  });

  it('builds basic auth header', () => {
    expect(buildTwilioBasicAuth('AC', 'secret')).toBe(
      `Basic ${Buffer.from('AC:secret').toString('base64')}`,
    );
  });
});
