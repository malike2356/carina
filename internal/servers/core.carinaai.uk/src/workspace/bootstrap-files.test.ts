import { describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_FILE_SPECS,
  BOOTSTRAP_ONE_SHOT_FILE,
  bootstrapSpecsForMode,
} from './bootstrap-files.js';

describe('bootstrap file catalog', () => {
  it('documents the full bootstrap set in load order', () => {
    const names = BOOTSTRAP_FILE_SPECS.map((spec) => spec.name);
    expect(names).toEqual([
      'SOUL.md',
      'IDENTITY.md',
      'AGENTS.md',
      'TOOLS.md',
      'USER.md',
      'MEMORY.md',
      'HEARTBEAT.md',
      'DREAMS.md',
      'SHARED_MEMORY.md',
    ]);
    expect(BOOTSTRAP_ONE_SHOT_FILE).toBe('BOOTSTRAP.md');
    expect(names).not.toContain('BOOTSTRAP.md');
  });

  it('loads only AGENTS and TOOLS in minimal subagent mode', () => {
    const minimal = bootstrapSpecsForMode('minimal').map((spec) => spec.name);
    expect(minimal).toEqual(['AGENTS.md', 'TOOLS.md']);
  });

  it('layers identity before context before volatile', () => {
    const tiers = BOOTSTRAP_FILE_SPECS.map((spec) => spec.tier);
    const identityEnd = tiers.lastIndexOf('identity');
    const contextStart = tiers.indexOf('context');
    const volatileStart = tiers.indexOf('volatile');
    expect(identityEnd).toBeLessThan(contextStart);
    expect(contextStart).toBeLessThan(volatileStart);
  });
});
