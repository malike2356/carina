import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn(async () => ({ id: 'email_1' }));

vi.mock('resend', () => ({
  Resend: vi.fn(function ResendMock() {
    return { emails: { send: sendMock } };
  }),
}));

vi.mock('../config/index.js', () => ({
  config: {
    resend: { apiKey: 're_test' },
    hosted: { appHost: 'app.carinaai.uk' },
  },
}));

const { buildSubscribeConfirmEmailText, buildSubscribeConfirmUrl, sendSubscribeConfirmationEmail } =
  await import('./subscribe-email.js');

describe('subscribe-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds confirm URL on app host', () => {
    expect(buildSubscribeConfirmUrl('token-abc')).toBe(
      'https://app.carinaai.uk/api/incident-blog/confirm?token=token-abc',
    );
  });

  it('builds plain-text confirmation body with confirm link', () => {
    const text = buildSubscribeConfirmEmailText('token-abc');
    expect(text).toContain('Confirm your subscription:');
    expect(text).toContain('token=token-abc');
    expect(text).toContain('Scout Incident Report. A VERLOX product.');
    expect(text).not.toContain('<html');
  });

  it('sends confirmation email from contact@verlox.uk', async () => {
    sendMock.mockClear();
    await sendSubscribeConfirmationEmail('reader@example.com', 'token-abc');
    expect(sendMock).toHaveBeenCalledWith({
      from: 'Scout Incident Report <contact@verlox.uk>',
      to: 'reader@example.com',
      subject: 'Confirm your subscription -- Scout Incident Report',
      text: expect.stringContaining('token=token-abc'),
    });
  });
});
