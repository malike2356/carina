import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mailgun-inbound.js', () => ({
  processMailgunInbound: vi.fn(async () => ({ status: 'accepted', workspaceId: 'ws-1', workerId: 'worker-1' })),
}));

import { processMailgunInbound } from './mailgun-inbound.js';
import {
  extractReadableMimeBody,
  parseCloudflareInboundPayload,
  processCloudflareInbound,
  verifyCloudflareInboundSecret,
} from './cloudflare-inbound.js';

describe('cloudflare inbound email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDFLARE_EMAIL_WORKER_SECRET = 'worker-secret';
    process.env.NODE_ENV = 'test';
  });

  it('verifies shared secret headers', () => {
    expect(
      verifyCloudflareInboundSecret({
        'x-aiva-email-secret': 'worker-secret',
      }),
    ).toBe(true);
    expect(
      verifyCloudflareInboundSecret({
        authorization: 'Bearer worker-secret',
      }),
    ).toBe(true);
    expect(
      verifyCloudflareInboundSecret({
        'x-aiva-email-secret': 'wrong',
      }),
    ).toBe(false);
  });

  it('parses worker JSON payloads', () => {
    const parsed = parseCloudflareInboundPayload({
      recipient: 'ama-9f2a1b@inbox.hireaiva.co.uk',
      sender: 'customer@example.com',
      from: 'Customer <customer@example.com>',
      subject: 'Hello',
      bodyPlain: 'Please help',
      messageId: '<msg-1@example.com>',
      attachmentCount: 2,
    });

    expect(parsed.recipient).toBe('ama-9f2a1b@inbox.hireaiva.co.uk');
    expect(parsed.bodyPlain).toBe('Please help');
    expect(parsed.attachmentCount).toBe(2);
  });

  it('extracts the plain text body from forwarded multipart MIME source', () => {
    const raw = [
      'Received: by cloudflare-email.net',
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="message-boundary"',
      '',
      '--message-boundary',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      'The readable message.',
      '--message-boundary',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      '<div>The readable message.</div>',
      '--message-boundary--',
    ].join('\r\n');

    expect(extractReadableMimeBody(raw)).toBe('The readable message.');
    expect(parseCloudflareInboundPayload({ bodyPlain: raw }).bodyPlain)
      .toBe('The readable message.');
  });

  it('rejects missing secret when required', async () => {
    const result = await processCloudflareInbound(
      { recipient: 'ama-9f2a1b@inbox.hireaiva.co.uk' },
      {},
    );

    expect(result.status).toBe('unauthorized');
    expect(processMailgunInbound).not.toHaveBeenCalled();
  });

  it('maps Cloudflare payloads into hosted email processing', async () => {
    const result = await processCloudflareInbound(
      {
        recipient: 'ama-9f2a1b@inbox.hireaiva.co.uk',
        sender: 'customer@example.com',
        from: 'Customer <customer@example.com>',
        subject: 'Need help',
        bodyPlain: 'Please help with my order',
        messageId: '<msg-cloudflare@example.com>',
      },
      { 'x-aiva-email-secret': 'worker-secret' },
    );

    expect(result.status).toBe('accepted');
    expect(processMailgunInbound).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'ama-9f2a1b@inbox.hireaiva.co.uk',
        sender: 'customer@example.com',
        from: 'Customer <customer@example.com>',
        subject: 'Need help',
        'body-plain': 'Please help with my order',
        'Message-Id': '<msg-cloudflare@example.com>',
      }),
      expect.objectContaining({
        skipSignature: true,
        source: 'hosted-cloudflare',
        messageIdPrefix: 'cloudflare',
      }),
    );
  });
});
