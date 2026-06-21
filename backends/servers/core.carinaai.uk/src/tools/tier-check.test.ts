import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  checkToolAccess,
  enforceCyberToolTier,
  resolveWorkspaceTier,
} from './tier-check.js';
import { WorkspaceTier } from './tiers.js';

describe('tier-check', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.CARINA_TIER;
    delete process.env.LABYRINTH_ENABLED;
    delete process.env.SCOUT_SUBSCRIPTION_PLAN;
    delete process.env.CARINA_CLOUD;
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it('defaults to self-hosted tier', () => {
    expect(resolveWorkspaceTier()).toBe(WorkspaceTier.SELF_HOSTED);
  });

  it('allows self-hosted tools on self-hosted tier', () => {
    const access = checkToolAccess({ name: 'nmap', requiredTier: WorkspaceTier.SELF_HOSTED }, WorkspaceTier.SELF_HOSTED);
    expect(access.allowed).toBe(true);
  });

  it('blocks nuclei on self-hosted tier', () => {
    const block = enforceCyberToolTier('nuclei');
    expect(block).not.toBeNull();
    expect(block?.code).toBe('CYBER_TOOL_TIER_BLOCKED');
    expect(block?.error).toContain('Cloud Carina');
  });

  it('allows nuclei on cloud tier', () => {
    process.env.CARINA_CLOUD = 'true';
    expect(enforceCyberToolTier('nuclei')).toBeNull();
  });

  it('ignores non-cyber tools', () => {
    expect(enforceCyberToolTier('shell-exec')).toBeNull();
  });
});
