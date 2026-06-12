import { describe, expect, it } from 'vitest';

describe('word overlap helper via near duplicates', () => {
  it('exports budget helpers', async () => {
    const mod = await import('./persistent-memory.js');
    expect(typeof mod.getMemoryBudgetStatus).toBe('function');
    expect(typeof mod.trimPersistentFactsToBudget).toBe('function');
    expect(typeof mod.findNearDuplicateFacts).toBe('function');
    expect(mod.MEMORY_BUDGETS.user).toBeGreaterThan(0);
  });
});
