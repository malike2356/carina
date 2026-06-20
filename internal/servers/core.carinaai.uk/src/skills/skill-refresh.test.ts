import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./store.js', () => ({
  listSkills: vi.fn(async () => []),
}));

vi.mock('./skill-md-loader.js', () => ({
  loadSkillMdDocuments: vi.fn(async () => []),
}));

vi.mock('./workshop-store.js', () => ({
  listWorkshopDrafts: vi.fn(() => []),
}));

vi.mock('./skill-versions.js', () => ({
  getLatestSkillVersion: vi.fn(async () => 0),
}));

vi.mock('./operator-pack-store.js', () => ({
  getOperatorActivePacks: vi.fn(() => ['operator-daily']),
}));

describe('skill refresh', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('clears caches and reloads pack skills', async () => {
    const loadPackSkills = vi.fn(async () => 2);
    const primeActivePackSkillCache = vi.fn(async () => undefined);
    const clearActivePackCaches = vi.fn();
    const loadSkillMdRuntime = vi.fn(async () => 1);
    const loadAllUserResources = vi.fn(async () => ({ skillsLoaded: 0, chunksIngested: 0 }));

    vi.doMock('./index.js', () => ({
      loadPackSkills,
      primeActivePackSkillCache,
      clearActivePackCaches,
      loadSkillMdRuntime,
    }));
    vi.doMock('./user-resources.js', () => ({
      loadAllUserResources,
    }));
    vi.doMock('./operator-pack-store.js', () => ({
      getOperatorActivePacks: vi.fn(() => ['operator-daily']),
    }));

    const { refreshSkillRuntime } = await import('./skill-refresh.js');
    const report = await refreshSkillRuntime();
    expect(loadPackSkills).toHaveBeenCalled();
    expect(clearActivePackCaches).toHaveBeenCalled();
    expect(report.packsLoaded).toBe(2);
    expect(report.skillMdLoaded).toBe(1);
  });
});

describe('skill index discovery', () => {
  it('indexes pack skills from active packs', async () => {
    const { clearSkillIndexCache, buildSkillIndex } = await import('./skill-index.js');
    clearSkillIndexCache();
    const index = await buildSkillIndex({ activePacks: ['operator-daily'], platform: 'cli' });
    expect(index.some((e) => e.source === 'pack' && e.name === 'secrets-hygiene')).toBe(true);
  });
});
