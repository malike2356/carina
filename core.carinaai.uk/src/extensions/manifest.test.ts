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
