import { describe, it, expect } from 'vitest';
import {
  toolsetsForAivaTier,
  filterToolsByTier,
  isToolAllowedForTier,
  isToolsetAllowedForTier,
} from './aiva-tier-toolsets.js';

describe('toolsetsForAivaTier', () => {
  it('includes full non-security toolsets at every tier', () => {
    for (const tier of ['trial', 'starter', 'professional', 'growth', 'business'] as const) {
      const { toolsets } = toolsetsForAivaTier(tier);
      expect(toolsets).toContain('web');
      expect(toolsets).toContain('search');
      expect(toolsets).toContain('browser');
      expect(toolsets).toContain('orchestration');
      expect(toolsets).toContain('mcp');
      expect(toolsets).not.toContain('security');
      expect(toolsets).not.toContain('terminal');
    }
  });

  it('does not block tools by tier', () => {
    expect(toolsetsForAivaTier('trial').blockedTools).toHaveLength(0);
    expect(toolsetsForAivaTier('starter').blockedTools).toHaveLength(0);
  });

  it('unknown tier still gets full workspace toolsets', () => {
    const { toolsets } = toolsetsForAivaTier('unknown-tier');
    expect(toolsets).toContain('messaging');
    expect(toolsets).toContain('dynamic');
  });
});

describe('isToolAllowedForTier', () => {
  it('shell-exec is never allowed at any tier', () => {
    expect(isToolAllowedForTier('shell-exec', 'trial')).toBe(false);
    expect(isToolAllowedForTier('shell-exec', 'business')).toBe(false);
  });

  it('allows business tools at trial', () => {
    expect(isToolAllowedForTier('web-search', 'trial')).toBe(true);
    expect(isToolAllowedForTier('contacts', 'trial')).toBe(true);
    expect(isToolAllowedForTier('webhook', 'trial')).toBe(true);
    expect(isToolAllowedForTier('browser-navigate', 'trial')).toBe(true);
    expect(isToolAllowedForTier('delegate-task', 'trial')).toBe(true);
  });
});

describe('filterToolsByTier', () => {
  it('removes only security tools', () => {
    const input = ['send-message', 'webhook', 'email-send', 'shell-exec', 'nmap'];
    const result = filterToolsByTier(input, 'starter');
    expect(result).not.toContain('shell-exec');
    expect(result).not.toContain('nmap');
    expect(result).toContain('webhook');
    expect(result).toContain('email-send');
  });
});

describe('isToolsetAllowedForTier', () => {
  it('security toolset is never allowed for any tier', () => {
    expect(isToolsetAllowedForTier('security', 'trial')).toBe(false);
    expect(isToolsetAllowedForTier('security', 'business')).toBe(false);
  });

  it('orchestration is allowed at trial', () => {
    expect(isToolsetAllowedForTier('orchestration', 'trial')).toBe(true);
    expect(isToolsetAllowedForTier('orchestration', 'business')).toBe(true);
  });
});
