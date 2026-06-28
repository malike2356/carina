import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildEmailReplyHeaders,
  emailAdapter,
  extractEmailRecipient,
  stripQuotedReply,
} from './email-adapter.js';

vi.mock('../../email/email-service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('email-adapter', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it('strips quoted reply text and returns null for empty bodies', () => {
    const text = stripQuotedReply(`Hello there

On Mon, 1 Jan 2026 Alice wrote:
> quoted line`);
    expect(text).toBe('Hello there');

    const parsed = emailAdapter.parse({
      FromFull: { Email: 'Client@Example.com', Name: 'Client' },
      TextBody: '   ',
      MessageID: 'msg-1',
    }, 'worker-1', 'ws-1');
    expect(parsed).toBeNull();
  });

  it('parses inbound messages with lowercase contact id and thread headers', () => {
    const parsed = emailAdapter.parse({
      FromFull: { Email: 'Client@Example.com', Name: 'Client' },
      TextBody: 'Need help with my tenancy',
      Subject: 'Tenancy question',
      MessageID: 'msg-current',
      Headers: [{ Name: 'In-Reply-To', Value: 'msg-parent' }],
    }, 'worker-1', 'ws-1');

    expect(parsed).toMatchObject({
      contactId: 'client@example.com',
      content: 'Need help with my tenancy',
      threadId: 'msg-parent',
    });
  });

  it('builds References chain from inbound MessageID', () => {
    expect(buildEmailReplyHeaders({
      MessageID: 'msg-2',
      Headers: [{ Name: 'References', Value: '<msg-0> <msg-1>' }],
    })).toEqual({
      inReplyTo: 'msg-2',
      references: '<msg-0> <msg-1> msg-2',
    });
  });

  it('verifies Postmark inbound token header', () => {
    process.env.POSTMARK_INBOUND_WEBHOOK_TOKEN = 'secret-token';
    expect(emailAdapter.verify({ 'x-postmark-inbound-token': 'secret-token' }, Buffer.alloc(0))).toBe(true);
    expect(emailAdapter.verify({ 'x-postmark-token': 'secret-token' }, Buffer.alloc(0))).toBe(true);
    expect(emailAdapter.verify({ 'x-postmark-inbound-token': 'wrong' }, Buffer.alloc(0))).toBe(false);
  });

  it('extracts recipient address from inbound payload', () => {
    expect(extractEmailRecipient({
      ToFull: [{ Email: 'Aria-abc123@mail.carinaai.uk' }],
    })).toBe('aria-abc123@mail.carinaai.uk');
  });

  it('send() passes In-Reply-To and References headers', async () => {
    const { sendEmail } = await import('../../email/email-service.js');
    await emailAdapter.send(
      {
        channel: 'email',
        contactId: 'client@example.com',
        content: 'Thanks for your message.',
        replyToThreadId: 'msg-current',
        metadata: { subject: 'Re: Tenancy question', references: '<msg-0> msg-current' },
      },
      { from_address: 'aria@mail.carinaai.uk', worker_name: 'Aria' },
    );

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      replyTo: 'aria@mail.carinaai.uk',
      subject: 'Re: Tenancy question',
      headers: {
        'In-Reply-To': 'msg-current',
        References: '<msg-0> msg-current',
      },
    }));
  });
});
