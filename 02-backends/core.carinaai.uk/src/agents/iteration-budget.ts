/** Per-agent iteration budget with refund support. */

export const REFUNDABLE_TOOL_NAMES = new Set(['execute-code']);

export class IterationBudget {
  readonly maxTotal: number;
  private usedCount = 0;

  constructor(maxTotal: number) {
    this.maxTotal = Math.max(1, maxTotal);
  }

  consume(): boolean {
    if (this.usedCount >= this.maxTotal) return false;
    this.usedCount += 1;
    return true;
  }

  refund(): void {
    if (this.usedCount > 0) this.usedCount -= 1;
  }

  get used(): number {
    return this.usedCount;
  }

  get remaining(): number {
    return Math.max(0, this.maxTotal - this.usedCount);
  }
}

export function shouldRefundToolIteration(toolName: string): boolean {
  return REFUNDABLE_TOOL_NAMES.has(toolName);
}

export function formatIterationBudgetLine(budget: IterationBudget): string {
  return `Iteration budget: ${budget.used}/${budget.maxTotal} used (${budget.remaining} remaining).`;
}

export function formatIterationBudgetWarning(budget: IterationBudget, threshold = 3): string | null {
  if (budget.remaining > threshold) return null;
  if (budget.remaining === 0) {
    return `Iteration budget nearly exhausted (${budget.used}/${budget.maxTotal}).`;
  }
  return `Iteration budget low: ${budget.remaining} of ${budget.maxTotal} remaining.`;
}
