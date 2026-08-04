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

describe('sendEmail transactional failures', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_PREVIEW_MODE = 'false';
    process.env.NODE_ENV = 'production';
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws when transactional send has no Resend key', async () => {
    const { sendEmail } = await import('./email-service.js');
    await expect(
      sendEmail({
        to: 'client@example.com',
        subject: 'Approved reply',
        template: React.createElement('span', null, 'Hello'),
        transactional: true,
      }),
    ).rejects.toThrow(/RESEND_API_KEY/);
  });
});
