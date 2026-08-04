import { describe, expect, it } from 'vitest';
import {
  DEVICE_SCOPES,
  controlScopesForRoute,
  deviceHasAnyScope,
  deviceHasScope,
  parseDeviceScopes,
} from './device-scopes.js';

describe('device-scopes', () => {
  it('defaults to chat and control', () => {
    expect(parseDeviceScopes()).toEqual(['chat', 'control']);
  });

  it('filters unknown scopes', () => {
    expect(parseDeviceScopes(['nodes', 'bogus', 'phone'])).toEqual(['nodes', 'phone']);
  });

  it('falls back when all scopes invalid', () => {
    expect(parseDeviceScopes(['bogus'])).toEqual(['chat', 'control']);
  });

  it('checks route requirements', () => {
    const device = { scopes: ['nodes'] };
    expect(deviceHasAnyScope(device, controlScopesForRoute('nodes'))).toBe(true);
    expect(deviceHasScope(device, 'control')).toBe(false);
    expect(DEVICE_SCOPES).toContain('approvals');
  });
});
