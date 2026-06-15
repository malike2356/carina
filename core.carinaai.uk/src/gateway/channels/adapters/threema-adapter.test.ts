import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  computeThreemaMac,
  parseThreemaInbound,
  ThreemaAdapter,
  verifyThreemaMac,
} from './threema-adapter.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const FORM_PAYLOAD = {
  from: 'ABCD1234',
  to: '*CARINA01',
  text: 'Hello Threema',
  nonce: 'nonce-123',
  msgid: 'msg-456',
};

describe('ThreemaAdapter', () => {
  const credentials = {
    gatewayId: '*CARINA01',
    gatewaySecret: 'gateway-secret',
  };

  function adapter(): ThreemaAdapter {
    return new ThreemaAdapter(true, credentials.gatewayId, credentials.gatewaySecret);
  }

  afterEach(() => {
    mockFetch.mockReset();
  });

  it('parseInbound extracts basic-mode text from form POST payload', () => {
    const message = adapter().parseInbound(FORM_PAYLOAD);

    expect(message?.channel).toBe('threema');
    expect(message?.id).toBe('msg-456');
    expect(message?.externalUserId).toBe('ABCD1234');
    expect(message?.conversationId).toBe('ABCD1234');
    expect(message?.text).toBe('Hello Threema');
    expect(message?.isDirect).toBe(true);
    expect(message?.isCommand).toBe(false);
  });

  it('validateWebhook verifies HMAC MAC from form fields', () => {
    const mac = computeThreemaMac(
      FORM_PAYLOAD.from,
      FORM_PAYLOAD.to,
      FORM_PAYLOAD.nonce,
      credentials.gatewaySecret,
    );

    expect(verifyThreemaMac(
      FORM_PAYLOAD.from,
      FORM_PAYLOAD.to,
      FORM_PAYLOAD.nonce,
      credentials.gatewaySecret,
      mac,
    )).toBe(true);

    expect(adapter().validateWebhook({
      headers: {},
      body: { ...FORM_PAYLOAD, mac },
    })).toBe(true);
  });

  it('validateWebhook fails with invalid MAC', () => {
    expect(adapter().validateWebhook({
      headers: {},
      body: { ...FORM_PAYLOAD, mac: 'bad-mac' },
    })).toBe(false);
  });

  it('sendMessage posts form-encoded payload to send_simple', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await adapter().sendMessage('ABCD1234', 'Reply text');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://msgapi.threema.ch/send_simple');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('from=*CARINA01&secret=gateway-secret&to=ABCD1234&text=Reply+text');
  });

  it('parseThreemaInbound returns null without text', () => {
    expect(parseThreemaInbound({ from: 'ABCD1234', text: '' })).toBeNull();
  });
});
