import { describe, expect, it } from 'vitest';
import { getBuiltinUtilityTool, resolveBuiltinToolFromJson } from './builtin-tools.js';
import { listBuiltinExtensionIds, resolveBuiltinExtensionPath } from './builtin-catalog.js';

describe('builtin utility extensions', () => {
  it('lists ten builtin utility extension ids', () => {
    const ids = listBuiltinExtensionIds();
    expect(ids.length).toBe(10);
    expect(ids).toContain('active-memory');
    expect(ids).toContain('llm-task');
  });

  it('resolves builtin extension paths on disk', () => {
    const path = resolveBuiltinExtensionPath('tokenjuice');
    expect(path).toBeTruthy();
    expect(path).toContain('builtin-extensions/tokenjuice');
  });

  it('maps builtin json tools to core implementations', () => {
    const tool = resolveBuiltinToolFromJson({
      integration: 'builtin',
      builtin: 'tokenjuice',
      name: 'tokenjuice',
      description: 'estimate tokens',
    }, 'ext_tokenjuice_');
    expect(tool?.name).toBe('ext_tokenjuice_tokenjuice');
    expect(tool?.execute).toBe(getBuiltinUtilityTool('tokenjuice')?.execute);
  });
});
