import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
}));

vi.mock('@/config/defaults', () => ({
  DEFAULT_CLOUD_URL: 'https://app.carinaai.uk',
}));

vi.mock('@/lib/id', () => ({
  generateSessionId: vi.fn(() => 'mobile-test-session'),
}));

describe('instance-store session persistence', () => {
  beforeEach(() => {
    store.clear();
    vi.resetModules();
  });

  it('persists sessionId across load/save cycles', async () => {
    const { ensureSessionId, loadInstanceConfig } = await import('./instance-store');

    const created = await ensureSessionId();
    expect(created.sessionId).toBe('mobile-test-session');

    const reloaded = await loadInstanceConfig();
    expect(reloaded.sessionId).toBe('mobile-test-session');
  });

  it('clears sessionId when gateway mode changes', async () => {
    const { ensureSessionId, setInstanceMode, loadInstanceConfig } = await import(
      './instance-store'
    );

    await ensureSessionId();
    await setInstanceMode('self-hosted', 'http://192.168.1.10:3000');

    const config = await loadInstanceConfig();
    expect(config.mode).toBe('self-hosted');
    expect(config.sessionId).toBe('');
  });
});
