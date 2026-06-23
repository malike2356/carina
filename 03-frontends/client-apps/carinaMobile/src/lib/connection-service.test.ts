import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: {
    CarinaConnectionService: {
      startService: vi.fn(async () => undefined),
      stopService: vi.fn(async () => undefined),
      addListener: vi.fn(),
      removeListeners: vi.fn(),
    },
  },
  NativeEventEmitter: vi.fn().mockImplementation(() => ({
    addListener: vi.fn(() => ({ remove: vi.fn() })),
  })),
}));

describe('connection-service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('reports native availability on device builds', async () => {
    const { isBackgroundConnectionAvailable } = await import('@/lib/connection-service');
    expect(isBackgroundConnectionAvailable()).toBe(true);
  });

  it('starts the Android foreground service with the websocket URL', async () => {
    const { ConnectionService } = await import('@/lib/connection-service');
    const { NativeModules } = await import('react-native');
    await ConnectionService.start('wss://app.carinaai.uk/api/companion/ws');
    expect(NativeModules.CarinaConnectionService.startService).toHaveBeenCalledWith(
      'wss://app.carinaai.uk/api/companion/ws',
    );
  });
});
