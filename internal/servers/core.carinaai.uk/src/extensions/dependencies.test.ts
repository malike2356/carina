import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { ExtensionManifest } from './manifest.js';

const manifest: ExtensionManifest = {
  manifestVersion: 1,
  id: 'needs-pack',
  version: '1.0.0',
  name: 'Needs Pack',
  author: 'Test',
  description: 'test',
  capabilities: ['skills'],
  entryPoints: { skills: 'skills/' },
  dependencies: { packs: ['property-uk'], extensions: ['base-ext'] },
};

vi.mock('./store.js', () => ({
  getExtensionRecord: vi.fn(async (id: string) => {
    if (id === 'base-ext') return { id: 'base-ext', status: 'enabled' };
    return undefined;
  }),
}));

vi.mock('../skills/index.js', () => ({
  getActivePackNames: vi.fn(() => ['property-uk']),
}));

describe('extension dependencies', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes when pack and extension dependencies are satisfied', async () => {
    const { validateExtensionDependencies } = await import('./dependencies.js');
    const errors = await validateExtensionDependencies(manifest);
    expect(errors).toEqual([]);
  });

  it('fails when required extension is missing', async () => {
    const { validateExtensionDependencies } = await import('./dependencies.js');
    const errors = await validateExtensionDependencies({
      ...manifest,
      dependencies: { extensions: ['missing-ext'] },
    });
    expect(errors.some((e) => e.includes('missing-ext'))).toBe(true);
  });

  it('fails when required pack is not active', async () => {
    const skills = await import('../skills/index.js');
    vi.mocked(skills.getActivePackNames).mockReturnValueOnce([]);
    const { validateExtensionDependencies } = await import('./dependencies.js');
    const errors = await validateExtensionDependencies(manifest);
    expect(errors.some((e) => e.includes('property-uk'))).toBe(true);
  });
});
