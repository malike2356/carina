import { describe, expect, it } from 'vitest';
import { resolveToolset, filterLeafTools, LEAF_EXCLUDED_TOOLS } from './toolset.js';

describe('resolveToolset', () => {
  it('maps terminal to shell-exec', () => {
    expect(resolveToolset(['terminal'])).toContain('shell-exec');
  });

  it('maps browser toolset to all browser tools', () => {
    const tools = resolveToolset(['browser']);
    expect(tools).toContain('browser-navigate');
    expect(tools).toContain('browser-click');
  });

  it('excludes leaf tools', () => {
    const tools = resolveToolset(['terminal', 'delegate-task']);
    expect(tools).not.toContain('delegate-task');
  });
});

describe('filterLeafTools', () => {
  it('removes all leaf excluded tools', () => {
    const input = ['shell-exec', ...LEAF_EXCLUDED_TOOLS];
    const filtered = filterLeafTools(input);
    expect(filtered).toEqual(['shell-exec']);
  });
});
