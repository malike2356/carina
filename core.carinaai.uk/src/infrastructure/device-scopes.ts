import type { PairedDevice } from './device-pairing.js';

export const DEVICE_SCOPES = ['chat', 'control', 'nodes', 'approvals', 'phone'] as const;
export type DeviceScope = (typeof DEVICE_SCOPES)[number];

const DEFAULT_SCOPES: DeviceScope[] = ['chat', 'control'];

export function parseDeviceScopes(input?: string[]): DeviceScope[] {
  if (!input?.length) return [...DEFAULT_SCOPES];
  const allowed = new Set<DeviceScope>(DEVICE_SCOPES);
  const scopes = input
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is DeviceScope => allowed.has(s as DeviceScope));
  return scopes.length ? scopes : [...DEFAULT_SCOPES];
}

export function deviceHasScope(device: Pick<PairedDevice, 'scopes'>, scope: DeviceScope): boolean {
  return device.scopes.includes(scope);
}

export function deviceHasAnyScope(device: Pick<PairedDevice, 'scopes'>, scopes: DeviceScope[]): boolean {
  return scopes.some((scope) => deviceHasScope(device, scope));
}

export function controlScopesForRoute(route: 'nodes' | 'approvals' | 'phone' | 'general'): DeviceScope[] {
  switch (route) {
    case 'nodes':
      return ['control', 'nodes'];
    case 'approvals':
      return ['control', 'approvals'];
    case 'phone':
      return ['control', 'phone'];
    default:
      return ['control'];
  }
}
