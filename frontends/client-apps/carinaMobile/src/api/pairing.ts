import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';
import { saveDeviceToken } from '@/store/device-token-store';

export type PairPlatform = 'ios' | 'android';

export interface PairedDeviceRow {
  id: string;
  name: string;
  platform: string;
  pairedAt?: string;
  lastSeen: string;
  scopes?: string[];
}

export interface CompletePairingResult {
  paired: boolean;
  deviceId: string;
  deviceToken: string;
  grantedScopes: string[];
}

export interface PairingDevicesResponse {
  devices: PairedDeviceRow[];
}

const DEFAULT_SCOPES = ['chat', 'control'];

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

async function resolveDeviceName(): Promise<string> {
  if (Device.deviceName) return Device.deviceName;
  if (Device.modelName) return Device.modelName;
  return Platform.OS === 'ios' ? 'Carina iPhone' : 'Carina Android';
}

export async function resolveDeviceId(): Promise<string> {
  if (Platform.OS === 'android' && Application.getAndroidId()) {
    return Application.getAndroidId()!;
  }
  const iosId = await Application.getIosIdForVendorAsync();
  if (iosId) return iosId;
  return `${Platform.OS}-unknown-device`;
}

async function pairingRequest<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
  auth?: GatewayAuthOptions,
): Promise<T> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, mergeGatewayInit(auth, init));
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Pairing request failed (${response.status})`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

function deviceAuth(deviceToken: string): GatewayAuthOptions {
  return { apiKey: deviceToken, credentials: 'omit' };
}

export const pairingApi = {
  async completePairing(
    baseUrl: string,
    auth: GatewayAuthOptions | undefined,
    token: string,
  ): Promise<CompletePairingResult> {
    const deviceName = await resolveDeviceName();
    const result = await pairingRequest<{
      deviceId: string;
      status: string;
      token: string;
    }>(baseUrl, '/api/pair/accept', {
      method: 'POST',
      body: JSON.stringify({
        token,
        deviceName,
        deviceId: await resolveDeviceId(),
        platform: Platform.OS,
      }),
    }, auth);

    if (result.token) {
      await saveDeviceToken(baseUrl, result.token);
    }

    return {
      paired: result.status === 'paired',
      deviceId: result.deviceId,
      deviceToken: result.token,
      grantedScopes: DEFAULT_SCOPES,
    };
  },

  async getDevices(baseUrl: string, deviceToken: string): Promise<PairingDevicesResponse> {
    const payload = await pairingRequest<PairedDeviceRow[] | { devices?: PairedDeviceRow[] }>(
      baseUrl,
      '/api/pair/devices',
      { method: 'GET' },
      deviceAuth(deviceToken),
    );
    if (Array.isArray(payload)) {
      return { devices: payload };
    }
    return { devices: payload.devices ?? [] };
  },

  async revokeDevice(baseUrl: string, deviceToken: string, deviceId: string): Promise<{ revoked: boolean }> {
    await pairingRequest<void>(
      baseUrl,
      `/api/pair/devices/${encodeURIComponent(deviceId)}`,
      { method: 'DELETE' },
      deviceAuth(deviceToken),
    );
    return { revoked: true };
  },
};

export const PAIRING_SCOPE_LABELS: Record<string, string> = {
  chat: 'Read and send chat messages',
  control: 'Control gateway settings',
  nodes: 'Node host access',
  approvals: 'Approve pending actions',
  phone: 'Phone relay features',
  'session.read': 'Read chat sessions',
  'session.write': 'Send messages',
  'camera.use': 'Camera access',
  'sms.relay': 'SMS relay',
  'call.relay': 'Call log relay',
  'notification.relay': 'Notification relay',
};

export function platformLabel(platform: string): string {
  switch (platform) {
    case 'ios':
      return 'iOS';
    case 'android':
      return 'Android';
    case 'desktop':
      return 'Desktop';
    case 'web':
      return 'Web';
    case 'mobile':
      return 'Mobile';
    default:
      return 'Device';
  }
}

export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  if (Number.isNaN(diff)) return 'unknown';
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
