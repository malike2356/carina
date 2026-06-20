import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(async () => undefined),
  getItemAsync: vi.fn(async () => null),
  deleteItemAsync: vi.fn(async () => undefined),
}));

vi.mock('expo-application', () => ({
  getAndroidId: () => 'android-test-id',
  getIosIdForVendorAsync: async () => 'ios-test-id',
}));

vi.mock('expo-device', () => ({
  deviceName: 'Test Phone',
  modelName: 'Test Phone',
}));

describe('pairing api', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        deviceId: 'device-1',
        status: 'paired',
        token: 'cdv_test_token',
      }),
    })) as unknown as typeof fetch);
  });

  it('completes pairing against /api/pair/accept', async () => {
    const { pairingApi } = await import('@/api/pairing');
    const result = await pairingApi.completePairing(
      'http://192.168.1.10:7430',
      undefined,
      'pending-token',
    );
    expect(result.paired).toBe(true);
    expect(result.deviceToken).toBe('cdv_test_token');
    expect(fetch).toHaveBeenCalledWith(
      'http://192.168.1.10:7430/api/pair/accept',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
