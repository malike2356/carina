import { describe, expect, it } from 'vitest';
import {
  estimateTurnCostUsd,
  formatBudgetVisibility,
  preflightProviderChoice,
} from './cost-guards.js';
import type { BudgetStatus } from './cost-tracker.js';

describe('cost guards', () => {
  it('warns on premium model tiers', () => {
    const budget: BudgetStatus = { status: 'ok', totalCost: 1, budgetLimit: 100 };
    const result = preflightProviderChoice('anthropic', 'claude-opus-4-20250514', budget);
    expect(result.decision).toBe('warn');
    expect(result.tier).toBe('premium');
  });

  it('blocks when monthly budget is exhausted', () => {
    const budget: BudgetStatus = {
      status: 'blocked',
      totalCost: 50,
      budgetLimit: 50,
      message: 'Monthly LLM budget reached',
    };
    const result = preflightProviderChoice('deepseek', 'deepseek-chat', budget);
    expect(result.decision).toBe('block');
  });

  it('blocks expensive models when budget is in warn state and guard enabled', () => {
    process.env.CARINA_BLOCK_EXPENSIVE_ON_BUDGET_WARN = 'true';
    const budget: BudgetStatus = {
      status: 'warn',
      totalCost: 85,
      budgetLimit: 100,
      message: 'Monthly LLM budget warning',
    };
    const result = preflightProviderChoice('anthropic', 'claude-opus-4-20250514', budget);
    expect(result.decision).toBe('block');
    delete process.env.CARINA_BLOCK_EXPENSIVE_ON_BUDGET_WARN;
  });

  it('allows cheap models with healthy budget', () => {
    const budget: BudgetStatus = { status: 'ok', totalCost: 1, budgetLimit: 100 };
    const result = preflightProviderChoice('deepseek', 'deepseek-chat', budget);
    expect(result.decision).toBe('allow');
  });

  it('formats remaining budget visibility', () => {
    const line = formatBudgetVisibility({
      status: 'warn',
      totalCost: 82,
      budgetLimit: 100,
      message: 'warning',
    });
    expect(line).toContain('LLM budget (WARN)');
    expect(line).toContain('remaining');
  });

  it('estimates turn cost from model metadata', () => {
    const estimate = estimateTurnCostUsd('deepseek', 'deepseek-chat', 1000);
    expect(estimate).toBeGreaterThan(0);
  });
});
