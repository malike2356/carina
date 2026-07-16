import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

vi.mock('../config/index.js', () => ({
  config: {
    resend: { apiKey: 're_test', from: 'Carina <hello@carinaai.uk>' },
    carina: { defaultProvider: 'openai' },
  },
}));

vi.mock('./workspace-contact.js', () => ({
  isMarketingOptedOut: vi.fn().mockResolvedValue(false),
}));

describe('sendEmail preview mode', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_PREVIEW_MODE = 'true';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('logs rendered email instead of calling Resend when preview mode is on', async () => {
    const { WelcomeEmail } = await import('./templates/welcome.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendEmail } = await import('./email-service.js');
    await sendEmail({
      to: 'owner@example.com',
      subject: 'Welcome to VERLOX - your account is ready',
      template: <WelcomeEmail firstName="Alex" loginUrl="https://admin.hireaiva.co.uk/login" />,
      transactional: true,
    });
    expect(logSpy).toHaveBeenCalled();
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('[EMAIL DEV]');
    expect(output).toContain('owner@example.com');
    expect(output.toLowerCase()).toContain('welcome, alex');
    expect(output).toContain('Hire an Aiva. Powered by Carina. Governed by Scout. Optional human assist on request.');
  });
});
