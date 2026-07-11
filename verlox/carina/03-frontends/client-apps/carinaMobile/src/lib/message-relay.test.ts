import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: {
    SmsRelayModule: {
      configure: vi.fn(async () => undefined),
      setSmsRelayEnabled: vi.fn(async () => undefined),
      setCallRelayEnabled: vi.fn(async () => undefined),
      setAllowedSenders: vi.fn(async () => undefined),
      setPrivacyHours: vi.fn(async () => undefined),
      getSettings: vi.fn(async () => ({ smsEnabled: false, callEnabled: false })),
      checkMissedCalls: vi.fn(async () => undefined),
    },
  },
}));

describe('message-relay', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('detects Android SMS relay availability', async () => {
    const { isSmsRelayAvailable } = await import('@/lib/message-relay');
    expect(isSmsRelayAvailable()).toBe(true);
  });

  it('configures the native relay client', async () => {
    const { MessageRelay } = await import('@/lib/message-relay');
    const { NativeModules } = await import('react-native');
    await MessageRelay.configure('https://app.carinaai.uk', null, 'test-key');
    expect(NativeModules.SmsRelayModule.configure).toHaveBeenCalledWith(
      'https://app.carinaai.uk',
      null,
      'test-key',
    );
  });
});
