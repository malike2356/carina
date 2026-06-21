export interface TokenUsage {
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  estimatedCost: number;
  requestCount: number;
  lastRequestAt: number;
}

const COST_PER_1M: Record<string, { input: number; output: number }> = {
  'claude-opus-4': { input: 15, output: 75 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'gpt-5.5': { input: 2.5, output: 10 },
  'gemini-3-pro': { input: 1.25, output: 5 },
  'llama-3.3': { input: 0, output: 0 },
};

function resolveCostKey(model: string): string {
  const lower = model.toLowerCase();
  if (lower.includes('opus')) return 'claude-opus-4';
  if (lower.includes('sonnet')) return 'claude-sonnet-4';
  if (lower.includes('gpt-5')) return 'gpt-5.5';
  if (lower.includes('gemini')) return 'gemini-3-pro';
  if (lower.includes('llama')) return 'llama-3.3';
  return 'gpt-5.5';
}

export class TokenTracker {
  private usage = new Map<string, TokenUsage>();

  record(
    sessionId: string,
    model: string,
    usage: { inputTokens: number; outputTokens: number; thinkingTokens?: number },
  ): TokenUsage {
    let entry = this.usage.get(sessionId);
    if (!entry) {
      entry = {
        sessionId,
        model,
        inputTokens: 0,
        outputTokens: 0,
        thinkingTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        requestCount: 0,
        lastRequestAt: Date.now(),
      };
      this.usage.set(sessionId, entry);
    }

    entry.model = model;
    entry.inputTokens += usage.inputTokens;
    entry.outputTokens += usage.outputTokens;
    entry.thinkingTokens += usage.thinkingTokens ?? 0;
    entry.totalTokens +=
      usage.inputTokens + usage.outputTokens + (usage.thinkingTokens ?? 0);
    entry.requestCount += 1;
    entry.lastRequestAt = Date.now();
    entry.estimatedCost = this.calculateCost(
      model,
      entry.inputTokens,
      entry.outputTokens,
    );
    return entry;
  }

  get(sessionId: string): TokenUsage | undefined {
    return this.usage.get(sessionId);
  }

  getAll(): TokenUsage[] {
    return [...this.usage.values()].sort((a, b) => b.totalTokens - a.totalTokens);
  }

  reset(sessionId: string): void {
    this.usage.delete(sessionId);
  }

  formatSessionSummary(sessionId: string): string {
    const usage = this.get(sessionId);
    if (!usage) {
      return 'Session tokens: 0\nEstimated cost: ~$0.00\nRequests: 0';
    }
    return [
      `Session tokens: ${usage.totalTokens.toLocaleString()} (in: ${usage.inputTokens.toLocaleString()} | out: ${usage.outputTokens.toLocaleString()}${usage.thinkingTokens ? ` | think: ${usage.thinkingTokens.toLocaleString()}` : ''})`,
      `Estimated cost: ~$${usage.estimatedCost.toFixed(2)}`,
      `Requests: ${usage.requestCount}`,
      `Model: ${usage.model}`,
    ].join('\n');
  }

  private calculateCost(model: string, input: number, output: number): number {
    const costs = COST_PER_1M[resolveCostKey(model)] ?? COST_PER_1M['gpt-5.5']!;
    return (input / 1_000_000) * costs.input + (output / 1_000_000) * costs.output;
  }
}

let tracker: TokenTracker | null = null;

export function getTokenTracker(): TokenTracker {
  tracker ??= new TokenTracker();
  return tracker;
}

export function tokenAlertThresholdUsd(): number {
  const raw = process.env.CARINA_TOKEN_ALERT_THRESHOLD_USD;
  if (!raw) return 5;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

export function maybeTokenSpendAlert(sessionId: string): string | null {
  const usage = getTokenTracker().get(sessionId);
  if (!usage) return null;
  const threshold = tokenAlertThresholdUsd();
  if (usage.estimatedCost < threshold) return null;
  return `Token spend alert: ~$${usage.estimatedCost.toFixed(2)} this session (${usage.totalTokens.toLocaleString()} tokens)`;
}
