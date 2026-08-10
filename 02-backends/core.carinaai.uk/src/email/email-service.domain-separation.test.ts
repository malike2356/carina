import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

vi.mock('../config/index.js', () => ({
  config: {
    resend: { apiKey: '', from: 'Carina <hello@carinaai.uk>' },
    carina: { defaultProvider: 'openai' },
  },
}));

vi.mock('./workspace-contact.js', () => ({
  isMarketingOptedOut: vi.fn().mockResolvedValue(false),
}));

vi.mock('./resend-client.js', () => ({
  getResendClient: () => null,
  resolveResendApiKey: () => '',
}));

describe('sendEmail domain separation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.RESEND_PREVIEW_MODE = 'true';
    process.env.EMAIL_APP_DOMAIN = 'example.com';
    process.env.EMAIL_FROM = 'noreply@mail.example.com';
    process.env.EMAIL_MARKETING_FROM = 'hello@updates.example.com';
    delete process.env.EMAIL_DELIVERABILITY_ENFORCE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('blocks marketing from the transactional domain', async () => {
    process.env.EMAIL_MARKETING_FROM = 'news@mail.example.com';
    process.env.RESEND_PREVIEW_MODE = 'false';
    process.env.NODE_ENV = 'production';
    const { sendEmail } = await import('./email-service.js');
    await expect(
      sendEmail({
        to: 'a@b.c',
        subject: 'promo',
        template: React.createElement('span', null, 'Hi'),
        transactional: false,
      }),
    ).rejects.toThrow(/must not use the transactional/);
  });

  it('allows marketing from updates subdomain in preview', async () => {
    const { sendEmail } = await import('./email-service.js');
    const result = await sendEmail({
      to: 'a@b.c',
      subject: 'promo',
      template: React.createElement('span', null, 'Hi'),
      transactional: false,
    });
    expect(result?.id).toMatch(/^preview-/);
  });
});
