import { describe, expect, it, beforeEach } from 'vitest';
import { PACK_MANIFESTS } from './pack-manifests.js';
import { clearPackResolverCacheForTests, resolvePack } from './pack-resolver.js';
import type { PackSkillInput } from './pack-types.js';

function validateSkill(skill: PackSkillInput, packName: string): void {
  expect(skill.name, `${packName}/${skill.name} name`).toMatch(/^[a-z0-9-]+$/);
  expect(skill.description.length, `${skill.name} description`).toBeGreaterThan(10);
  expect(skill.trigger.length, `${skill.name} triggers`).toBeGreaterThan(0);
  expect(skill.steps.length, `${skill.name} steps`).toBeGreaterThan(20);
  for (const tool of skill.toolsUsed ?? []) {
    expect(tool.length, `${skill.name} tool ref`).toBeGreaterThan(0);
  }
}

describe('skill catalog', () => {
  beforeEach(() => {
    clearPackResolverCacheForTests();
  });

  it('has unique skill names across all shipped packs', async () => {
    const seen = new Map<string, string>();
    for (const packName of Object.keys(PACK_MANIFESTS)) {
      if (packName === 'property-uk' || packName === 'healthcare' || packName === 'research-analysis') continue;
      const pack = await resolvePack(packName);
      for (const skill of pack.skills) {
        const prior = seen.get(skill.name);
        expect(prior, `duplicate skill ${skill.name} in ${packName} (also in ${prior})`).toBeUndefined();
        seen.set(skill.name, packName);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(110);
  });

  it('matches manifest skillCount for each on-disk pack', async () => {
    for (const [packName, manifest] of Object.entries(PACK_MANIFESTS)) {
      if (packName === 'property-uk' || packName === 'healthcare' || packName === 'research-analysis') continue;
      const pack = await resolvePack(packName);
      expect(pack.skills.length, packName).toBe(manifest.skillCount);
    }
  });

  it('validates operator-daily skills reference workspace and ops tools', async () => {
    const pack = await resolvePack('operator-daily');
    const names = new Set(pack.skills.map((s) => s.name));
    expect(names.has('workspace-notes-tasks')).toBe(true);
    expect(names.has('secrets-hygiene')).toBe(true);
    expect(names.has('memory-consolidation')).toBe(true);

    const notes = pack.skills.find((s) => s.name === 'workspace-notes-tasks');
    expect(notes?.toolsUsed).toContain('notes-manage');
    for (const skill of pack.skills) {
      validateSkill(skill, 'operator-daily');
    }
  });

  it('lists operator-daily in available packs', async () => {
    const { listAvailablePacks } = await import('./index.js');
    const names = listAvailablePacks().map((p) => p.name);
    expect(names).toContain('operator-daily');
    expect(names).toContain('core-engineering');
  });
});
