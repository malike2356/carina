import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { decryptConfig, getConfiguredAlertChannelSeeds } from '../alert-channels.js';
import { encryptSecret } from '../secret-crypto.js';

describe('alert-channels decryptConfig', () => {
  const prev = process.env.SCOUT_CONFIG_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.SCOUT_CONFIG_ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests';
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.SCOUT_CONFIG_ENCRYPTION_KEY;
    else process.env.SCOUT_CONFIG_ENCRYPTION_KEY = prev;
  });
  it('decrypts telegram bot_token from stored config', () => {
    const token = '123456:ABC-DEF';
    const config = decryptConfig('telegram', {
      bot_token: encryptSecret(token),
      chat_id: '-100123',
    });
    expect(config.bot_token).toBe(token);
    expect(config.chat_id).toBe('-100123');
  });

  it('decrypts email resend_api_key from stored config', () => {
    const key = 're_test_key';
    const config = decryptConfig('email', {
      resend_api_key: encryptSecret(key),
      to_address: 'ops@example.com',
    });
    expect(config.resend_api_key).toBe(key);
    expect(config.to_address).toBe('ops@example.com');
  });

  it('builds telegram alert channel seeds when env is configured', () => {
    const seeds = getConfiguredAlertChannelSeeds({
      telegram: { botToken: 'bot-token', chatId: '12345' },
      email: { resendApiKey: '', from: '', to: '' },
      slack: { webhookUrl: '' },
    });
    expect(seeds).toEqual([
      {
        channel_type: 'telegram',
        severity_threshold: 'warning',
        enabled: true,
        config: {
          bot_token: 'bot-token',
          chat_id: '12345',
        },
      },
    ]);
  });

  it('does not build seeds when telegram config is incomplete', () => {
    const seeds = getConfiguredAlertChannelSeeds({
      telegram: { botToken: 'bot-token', chatId: '' },
      email: { resendApiKey: '', from: '', to: '' },
      slack: { webhookUrl: '' },
    });
    expect(seeds).toEqual([]);
  });
});
