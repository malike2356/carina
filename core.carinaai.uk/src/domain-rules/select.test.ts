import { describe, expect, it } from 'vitest';
import { buildDomainRulesContext } from './build-context.js';
import { selectDomainRulePacks } from './select.js';
import { listAllDomainRulePacks } from './registry.js';

describe('domain rule pack selection', () => {
  it('includes web rules only when web tools are enabled', () => {
    const all = listAllDomainRulePacks();
    const withWeb = selectDomainRulePacks(all, {
      toolNames: ['web-search'],
      toolsets: ['search'],
    });
    expect(withWeb.some((p) => p.id === 'web')).toBe(true);
    expect(withWeb.some((p) => p.id === 'email')).toBe(false);

    const withoutWeb = selectDomainRulePacks(all, {
      toolNames: ['file-read'],
      toolsets: ['file'],
    });
    expect(withoutWeb.some((p) => p.id === 'web')).toBe(false);
  });

  it('includes memory rules when memory tool is active', () => {
    const selected = selectDomainRulePacks(listAllDomainRulePacks(), {
      toolNames: ['memory', 'todo'],
      toolsets: [],
    });
    expect(selected.some((p) => p.id === 'memory')).toBe(true);
  });

  it('builds a compact context block for selected packs', () => {
    const selected = selectDomainRulePacks(listAllDomainRulePacks(), {
      toolNames: ['memory'],
      toolsets: [],
    });
    const block = buildDomainRulesContext(selected);
    expect(block).toContain('Domain rules');
    expect(block).toContain('Durable memory');
    expect(block).toContain('session-search');
  });
});
