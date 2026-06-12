import { describe, expect, it } from 'vitest';
import { validateExtensionManifest } from './manifest.js';

describe('extension manifest', () => {
  it('accepts a valid v1 manifest', () => {
    const manifest = validateExtensionManifest({
      manifestVersion: 1,
      id: 'demo-pack',
      version: '1.0.0',
      name: 'Demo',
      author: 'Test',
      description: 'Demo extension',
      capabilities: ['skills'],
      entryPoints: { skills: 'skills/' },
      risk: 'low',
    });
    expect(manifest.id).toBe('demo-pack');
    expect(manifest.capabilities).toEqual(['skills']);
  });

  it('rejects missing capability entry point', () => {
    expect(() => validateExtensionManifest({
      manifestVersion: 1,
      id: 'demo-pack',
      version: '1.0.0',
      name: 'Demo',
      author: 'Test',
      description: 'Demo extension',
      capabilities: ['skills'],
      entryPoints: {},
    })).toThrow(/entryPoints\.skills/);
  });

  it('accepts optional safety metadata', () => {
    const manifest = validateExtensionManifest({
      manifestVersion: 1,
      id: 'safe-demo',
      version: '1.0.0',
      name: 'Safe',
      author: 'Test',
      description: 'Demo extension',
      capabilities: ['skills'],
      entryPoints: { skills: 'skills/' },
      safety: { network: true, shell: false },
    });
    expect(manifest.safety?.network).toBe(true);
    expect(manifest.safety?.shell).toBe(false);
  });

  it('accepts minCarinaVersion semver', () => {
    const manifest = validateExtensionManifest({
      manifestVersion: 1,
      id: 'versioned',
      version: '1.0.0',
      name: 'Versioned',
      author: 'Test',
      description: 'Demo extension',
      capabilities: ['skills'],
      entryPoints: { skills: 'skills/' },
      minCarinaVersion: '0.1.0',
    });
    expect(manifest.minCarinaVersion).toBe('0.1.0');
  });

  it('rejects invalid minCarinaVersion', () => {
    expect(() => validateExtensionManifest({
      manifestVersion: 1,
      id: 'bad-ver',
      version: '1.0.0',
      name: 'Bad',
      author: 'Test',
      description: 'Demo extension',
      capabilities: ['skills'],
      entryPoints: { skills: 'skills/' },
      minCarinaVersion: 'not-semver',
    })).toThrow(/minCarinaVersion/);
  });

  it('rejects invalid manifest version', () => {
    expect(() => validateExtensionManifest({
      manifestVersion: 2,
      id: 'demo-pack',
      version: '1.0.0',
      name: 'Demo',
      author: 'Test',
      description: 'Demo extension',
      capabilities: ['skills'],
      entryPoints: { skills: 'skills/' },
    })).toThrow(/manifestVersion/);
  });
});
