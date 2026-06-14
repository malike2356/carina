import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/index.js', () => ({
  config: {
    hosted: { appHost: 'app.carinaai.uk' },
    resend: { apiKey: 're_test', from: 'hello@carinaai.uk' },
  },
}));

const sendMock = vi.fn(async () => ({ id: 'email-1' }));

vi.mock('resend', () => ({
  Resend: vi.fn(function ResendMock() {
    return { emails: { send: sendMock } };
  }),
}));

import {
  buildInviteUrl,
  renderInviteEmailHtml,
  renderInviteEmailText,
  sendInviteEmail,
} from './invite-email.js';

describe('invite-email', () => {
  it('buildInviteUrl uses hosted app host', () => {
    const url = buildInviteUrl('abc123');
    expect(url).toBe('https://app.carinaai.uk/hosted-register?invite=abc123');
  });

  it('renderInviteEmailText includes org name and invite URL', () => {
    const text = renderInviteEmailText({
      to: 'jane@example.com',
      orgName: 'Acme Ops',
      role: 'operator',
      inviteUrl: 'https://app.carinaai.uk/hosted-register?invite=token',
      inviterEmail: 'owner@example.com',
    });
    expect(text).toContain('Acme Ops');
    expect(text).toContain('https://app.carinaai.uk/hosted-register?invite=token');
    expect(text).toContain('operator');
  });

  it('renderInviteEmailHtml escapes HTML in org name', () => {
    const html = renderInviteEmailHtml({
      to: 'jane@example.com',
      orgName: 'Acme <script>',
      role: 'admin',
      inviteUrl: 'https://app.carinaai.uk/hosted-register?invite=token',
    });
    expect(html).toContain('Acme &lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('sendInviteEmail calls Resend with subject and body', async () => {
    sendMock.mockClear();
    const sent = await sendInviteEmail({
      to: 'jane@example.com',
      orgName: 'Acme Ops',
      role: 'viewer',
      inviteUrl: 'https://app.carinaai.uk/hosted-register?invite=token',
    });
    expect(sent).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'jane@example.com',
      subject: 'You are invited to Acme Ops on Carina Ops',
    }));
  });
});
