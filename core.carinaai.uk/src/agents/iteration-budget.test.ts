import { describe, expect, it } from 'vitest';
import {
  IterationBudget,
  formatIterationBudgetWarning,
  shouldRefundToolIteration,
} from '../agents/iteration-budget.js';

describe('iteration-budget', () => {
  it('consumes and refunds iterations', () => {
    const budget = new IterationBudget(3);
    expect(budget.consume()).toBe(true);
    expect(budget.consume()).toBe(true);
    expect(budget.used).toBe(2);
    budget.refund();
    expect(budget.used).toBe(1);
    expect(budget.remaining).toBe(2);
  });

  it('returns false when exhausted', () => {
    const budget = new IterationBudget(1);
    expect(budget.consume()).toBe(true);
    expect(budget.consume()).toBe(false);
    expect(budget.remaining).toBe(0);
  });

  it('flags execute-code as refundable', () => {
    expect(shouldRefundToolIteration('execute-code')).toBe(true);
    expect(shouldRefundToolIteration('web-search')).toBe(false);
  });

  it('warns when remaining budget is low', () => {
    const budget = new IterationBudget(5);
    budget.consume();
    budget.consume();
    budget.consume();
    expect(formatIterationBudgetWarning(budget, 3)).toContain('remaining');
  });
});
