import { describe, expect, it } from 'vitest';
import { cloudFeatureAccess, isApiAuthError } from './cloud-features';
import type { HostedUser, InstanceConfig } from '@/api/types';

const cloudInstance: InstanceConfig = {
  mode: 'cloud',
  baseUrl: 'https://app.carinaai.uk',
  sessionId: 'mobile-abc',
};

const selfHostedInstance: InstanceConfig = {
  mode: 'self-hosted',
  baseUrl: 'http://192.168.1.10:3000',
  sessionId: 'mobile-def',
};

const user: HostedUser = {
  id: 'user-1',
  email: 'user@example.com',
  tier: 'free',
  scoutActive: false,
};

describe('cloudFeatureAccess', () => {
  it('allows memory for signed-in cloud users', () => {
    const access = cloudFeatureAccess('memory', cloudInstance, user);
    expect(access.available).toBe(true);
    expect(access.reason).toBeNull();
  });

  it('blocks memory on self-hosted gateways', () => {
    const access = cloudFeatureAccess('memory', selfHostedInstance, user);
    expect(access.available).toBe(false);
    expect(access.reason).toMatch(/Carina Cloud/i);
  });

  it('blocks packs when cloud user is missing', () => {
    const access = cloudFeatureAccess('packs', cloudInstance, null);
    expect(access.available).toBe(false);
    expect(access.reason).toMatch(/Sign in/i);
  });
});

describe('isApiAuthError', () => {
  it('detects HTTP auth failures', () => {
    expect(isApiAuthError('Carina API 401: Not signed in')).toBe(true);
    expect(isApiAuthError('Chat stream 403: forbidden')).toBe(true);
  });

  it('ignores generic network errors', () => {
    expect(isApiAuthError('Network request failed')).toBe(false);
  });
});
