import { describe, expect, it } from 'vitest';
import { buildSurfaceContext } from './system-prompt.js';

describe('buildSurfaceContext', () => {
  it('gives web UI guidance for configuration questions', () => {
    const ctx = buildSurfaceContext('web');
    expect(ctx).toContain('Current surface: web UI.');
    expect(ctx).toContain('For skill packs, open /packs in the web UI');
    expect(ctx).toContain('Only mention CLI commands');
  });

  it('gives CLI guidance for command-line questions', () => {
    const ctx = buildSurfaceContext('cli');
    expect(ctx).toContain('Current surface: CLI.');
    expect(ctx).toContain('prefer command-line steps');
  });
});
