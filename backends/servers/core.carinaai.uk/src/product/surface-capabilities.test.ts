import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('surface-capabilities', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...envBackup };
    delete process.env.CARINA_LEGACY_CAPABILITY_SUMMARY;
    delete process.env.TAVILY_API_KEY;
    delete process.env.ACTIVE_SKILL_PACKS;
    delete process.env.LABYRINTH_ENABLED;
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it('resolveSurface maps telegram platform', async () => {
    const { resolveSurface } = await import('./surface-capabilities.js');
    expect(resolveSurface({ platform: 'telegram' })).toBe('telegram');
  });

  it('telegram summary excludes web-only nav items', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    const { buildCapabilitySummaryForSurface } = await import('./surface-capabilities.js');
    const summary = buildCapabilitySummaryForSurface('telegram');
    expect(summary.toLowerCase()).not.toContain('trello');
    expect(summary.toLowerCase()).not.toContain('calendar');
    expect(summary.toLowerCase()).not.toContain('documents');
  });

  it('cloud-byok summary mentions BYOK constraints', async () => {
    const { buildSurfaceContract } = await import('./surface-capabilities.js');
    const contract = buildSurfaceContract('cloud-byok');
    expect(contract.identityLine.toLowerCase()).toContain('api keys');
    expect(contract.capabilities.find((c) => c.id === 'tools')?.available).toBe(false);
  });

  it('property-uk pack adds property note without replacing identity', async () => {
    process.env.ACTIVE_SKILL_PACKS = 'property-uk';
    const { buildSurfaceContract } = await import('./surface-capabilities.js');
    const contract = buildSurfaceContract('cli');
    expect(contract.identityLine).toContain('Property-uk');
    expect(contract.identityLine).toContain('VERLOX');
  });

  it('excludes unavailable items from summaryLine', async () => {
    const { buildCapabilitySummaryForSurface } = await import('./surface-capabilities.js');
    const summary = buildCapabilitySummaryForSurface('cloud-byok');
    expect(summary.toLowerCase()).not.toContain('web search');
  });
});
