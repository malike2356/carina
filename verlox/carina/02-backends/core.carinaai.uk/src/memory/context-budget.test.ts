import { describe, expect, it } from 'vitest';
import { applyContextBudget } from './context-budget.js';

describe('applyContextBudget', () => {
  it('keeps all layers when under budget', () => {
    const result = applyContextBudget(
      ['system prompt'],
      [
        { id: 'history', content: 'Recent session history:\nuser: hi' },
        { id: 'skills', content: 'Relevant skills:\nSkill: lint' },
      ],
      10_000,
    );
    expect(result.layers).toHaveLength(2);
    expect(result.trimmed).toEqual([]);
    expect(result.historyCompacted).toBe(false);
  });

  it('trims expendable layers before dropping core prompt content', () => {
    const big = 'x'.repeat(5000);
    const result = applyContextBudget(
      ['system'],
      [
        { id: 'history', content: `Recent session history:\n${big}` },
        { id: 'similar', content: `Relevant past memories:\n${big}` },
        { id: 'rag', content: `Reference knowledge:\n${big}` },
        { id: 'skills', content: `Relevant skills:\n${big}` },
      ],
      6000,
    );
    expect(result.trimmed.length).toBeGreaterThan(0);
    expect(result.fixedParts).toEqual(['system']);
    expect(result.estimatedChars).toBeLessThanOrEqual(6000);
  });

  it('marks history as compacted when truncated', () => {
    const result = applyContextBudget(
      ['system'],
      [{ id: 'history', content: `Recent session history:\n${'line\n'.repeat(200)}` }],
      180,
    );
    expect(result.historyCompacted).toBe(true);
    expect(result.layers[0]?.content ?? '').toContain('[history truncated for context budget]');
  });

  it('never trims fixed parts', () => {
    const fixed = ['core prompt', 'Persistent memory:\nUser prefers tests'];
    const result = applyContextBudget(
      fixed,
      [{ id: 'history', content: 'Recent session history:\n' + 'a'.repeat(20_000) }],
      1000,
    );
    expect(result.fixedParts).toEqual(fixed);
  });

  it('caps context at 70 percent of the model window', () => {
    const result = applyContextBudget(
      ['system'],
      [
        { id: 'history', content: 'Recent session history:\n' + 'a'.repeat(1200) },
        { id: 'similar', content: 'Relevant past memories:\n' + 'b'.repeat(1200) },
      ],
      { budgetChars: 10_000, modelWindowTokens: 100 },
    );

    expect(result.budgetTokens).toBe(70);
    expect(result.estimatedTokens).toBeLessThanOrEqual(70);
    expect(result.estimatedChars).toBeLessThanOrEqual(10_000);
  });
});
