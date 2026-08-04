import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
let sessionCounter = 0;

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
  isUuid: vi.fn((value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  ),
  generateSessionId: vi.fn(() => {
    sessionCounter += 1;
    return `550e8400-e29b-41d4-a716-44665544000${sessionCounter}`;
  }),
}));

describe('instance-store session persistence', () => {
  beforeEach(() => {
    store.clear();
    sessionCounter = 0;
    vi.resetModules();
  });

  it('persists sessionId across load/save cycles', async () => {
    const { ensureSessionId, loadInstanceConfig } = await import('./instance-store');

    const created = await ensureSessionId();
    expect(created.sessionId).toBe('550e8400-e29b-41d4-a716-446655440001');

    const reloaded = await loadInstanceConfig();
    expect(reloaded.sessionId).toBe('550e8400-e29b-41d4-a716-446655440001');
  });

  it('creates a new session id on rotate without reusing the previous id', async () => {
    const { ensureSessionId, rotateSessionId, loadInstanceConfig } = await import(
      './instance-store'
    );

    await ensureSessionId();
    const rotated = await rotateSessionId();
    expect(rotated.sessionId).toBe('550e8400-e29b-41d4-a716-446655440002');

    const reloaded = await loadInstanceConfig();
    expect(reloaded.sessionId).toBe('550e8400-e29b-41d4-a716-446655440002');
  });

  it('switches to an existing session id without generating a new one', async () => {
    const { setSessionId, loadInstanceConfig } = await import('./instance-store');

    const switched = await setSessionId('550e8400-e29b-41d4-a716-446655440099');
    expect(switched.sessionId).toBe('550e8400-e29b-41d4-a716-446655440099');

    const reloaded = await loadInstanceConfig();
    expect(reloaded.sessionId).toBe('550e8400-e29b-41d4-a716-446655440099');
  });

  it('rotates legacy mobile-* cloud session ids to uuid', async () => {
    const { saveInstanceConfig, ensureSessionId } = await import('./instance-store');
    await saveInstanceConfig({
      mode: 'cloud',
      baseUrl: 'https://app.carinaai.uk',
      sessionId: 'mobile-legacy-thread',
    });
    const next = await ensureSessionId();
    expect(next.sessionId).toBe('550e8400-e29b-41d4-a716-446655440001');
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
