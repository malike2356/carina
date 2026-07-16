import { describe, expect, it } from 'vitest';
import {
  allWorkspaceToolsets,
  channelLimitFromCapabilities,
  getWorkspaceCapabilities,
  getWorkspaceToolsetConfig,
  isPlatformFeatureEnabled,
  isWorkspaceToolAllowed,
  isWorkspaceToolBlocked,
  isWorkspaceToolsetBlocked,
} from './workspace-capabilities.js';

describe('getWorkspaceCapabilities', () => {
  it('enables all core channels and tools at every tier', () => {
    for (const tier of ['trial', 'starter', 'growth', 'business'] as const) {
      const caps = getWorkspaceCapabilities(tier);
      expect(caps.agent).toBe(true);
      expect(caps.memory).toBe(true);
      expect(caps.skills).toBe(true);
      expect(caps.channels.telegram).toBe(true);
      expect(caps.channels.whatsapp).toBe(true);
      expect(caps.tools.webSearch).toBe(true);
      expect(caps.tools.emailSend).toBe(true);
    }
  });

  it('gates platform features by tier only', () => {
    expect(getWorkspaceCapabilities('trial').platform.api).toBe(true);
    expect(getWorkspaceCapabilities('starter').platform.api).toBe(false);
    expect(getWorkspaceCapabilities('growth').platform.api).toBe(true);
    expect(getWorkspaceCapabilities('starter').platform.customDomain).toBe(false);
    expect(getWorkspaceCapabilities('business').platform.customDomain).toBe(true);
    expect(getWorkspaceCapabilities('business').platform.whiteLabel).toBe(true);
  });

  it('does not limit channels by tier', () => {
    expect(channelLimitFromCapabilities('trial')).toBeNull();
    expect(channelLimitFromCapabilities('starter')).toBeNull();
    expect(channelLimitFromCapabilities('business')).toBeNull();
  });
});

describe('workspace tool access', () => {
  it('allows non-security tools at trial', () => {
    expect(isWorkspaceToolAllowed('web-search', 'trial')).toBe(true);
    expect(isWorkspaceToolAllowed('browser-navigate', 'trial')).toBe(true);
    expect(isWorkspaceToolAllowed('webhook', 'trial')).toBe(true);
    expect(isWorkspaceToolAllowed('delegate-task', 'trial')).toBe(true);
  });

  it('blocks security and terminal tools at every tier', () => {
    expect(isWorkspaceToolBlocked('shell-exec')).toBe(true);
    expect(isWorkspaceToolAllowed('shell-exec', 'business')).toBe(false);
    expect(isWorkspaceToolsetBlocked('security')).toBe(true);
    expect(isWorkspaceToolsetBlocked('terminal')).toBe(true);
  });

  it('exposes all non-security toolsets for any tier', () => {
    const config = getWorkspaceToolsetConfig('trial');
    expect(config.toolsets).toContain('browser');
    expect(config.toolsets).toContain('orchestration');
    expect(config.toolsets).toContain('mcp');
    expect(config.toolsets).not.toContain('security');
    expect(config.toolsets).not.toContain('terminal');
    expect(config.blockedTools).toHaveLength(0);
    expect(allWorkspaceToolsets().length).toBeGreaterThan(10);
  });
});

describe('isPlatformFeatureEnabled', () => {
  it('returns analytics for all tiers', () => {
    expect(isPlatformFeatureEnabled('trial', 'analytics')).toBe(true);
    expect(isPlatformFeatureEnabled('starter', 'audit')).toBe(true);
  });
});
