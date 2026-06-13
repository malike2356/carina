import { describe, expect, it } from 'vitest';
import { resolveToolset, filterLeafTools, LEAF_EXCLUDED_TOOLS, ALWAYS_ON_TOOLS } from './toolset.js';

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

describe('ALWAYS_ON_TOOLS', () => {
  it('includes memory, todo, clarify, session-search', () => {
    expect(ALWAYS_ON_TOOLS).toContain('memory');
    expect(ALWAYS_ON_TOOLS).toContain('todo');
    expect(ALWAYS_ON_TOOLS).toContain('clarify');
    expect(ALWAYS_ON_TOOLS).toContain('session-search');
  });

  it('does not overlap with non-leaf toolset tools', () => {
    const terminalTools = resolveToolset(['terminal', 'file']);
    for (const tool of ALWAYS_ON_TOOLS) {
      expect(terminalTools).not.toContain(tool);
    }
  });

  it('all always-on tools are in LEAF_EXCLUDED so subagents cannot request them', () => {
    const excluded = new Set(LEAF_EXCLUDED_TOOLS as readonly string[]);
    for (const tool of ALWAYS_ON_TOOLS) {
      expect(excluded.has(tool), `${tool} should be in LEAF_EXCLUDED_TOOLS`).toBe(true);
    }
  });
});
