import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryProviderMock = vi.fn();
const isProviderConfiguredMock = vi.fn();

vi.mock('../agents/compare.js', () => ({
  queryProvider: (...args: unknown[]) => queryProviderMock(...args),
}));

vi.mock('../brain/llm.js', () => ({
  llm: {
    isProviderConfigured: (...args: unknown[]) => isProviderConfiguredMock(...args),
  },
}));

import { runProviderBenchmark } from './provider-runner.js';

describe('provider benchmark runner', () => {
  beforeEach(() => {
    queryProviderMock.mockReset();
    isProviderConfiguredMock.mockReset();
    isProviderConfiguredMock.mockReturnValue(true);
    queryProviderMock.mockImplementation(async (_providerId: string, prompt: string) => {
      if (prompt.includes('Return JSON with keys owner')) {
        return {
          providerId: 'gemini',
          model: 'test-model',
          response: '{"owner":"Carina Admin","paths":["keep_current","own_api","upgrade_later"],"primaryRecommendation":"keep_current"}',
          latencyMs: 12,
          tokenCount: 14,
        };
      }
      if (prompt.includes('Reply with exactly two lines')) {
        return {
          providerId: 'gemini',
          model: 'test-model',
          response: 'verdict\nreason keep compare recover',
          latencyMs: 11,
          tokenCount: 9,
        };
      }
      if (prompt.includes('numbered plan with exactly 3 steps')) {
        return {
          providerId: 'gemini',
          model: 'test-model',
          response: '1. provider runs\n2. billing copy\n3. contacts',
          latencyMs: 10,
          tokenCount: 11,
        };
      }
      if (prompt.includes('Gemini is the Google provider')) {
        return {
          providerId: 'gemini',
          model: 'test-model',
          response: 'Gemini DeepSeek Claude live benchmark mode',
          latencyMs: 13,
          tokenCount: 8,
        };
      }
      if (prompt.includes('Return JSON with keys action')) {
        return {
          providerId: 'gemini',
          model: 'test-model',
          response: '{"action":"run_benchmark","target":"providers","confidence":0.9,"notes":"ok"}',
          latencyMs: 9,
          tokenCount: 10,
        };
      }
      return {
        providerId: 'gemini',
        model: 'test-model',
        response: 'fallback response',
        latencyMs: 8,
        tokenCount: 5,
      };
    });
  });

  it('runs a live benchmark report for the requested providers', async () => {
    const report = await runProviderBenchmark(['gemini', 'deepseek', 'anthropic']);

    expect(report.summary.providerCount).toBe(3);
    expect(report.summary.fixtureCount).toBeGreaterThan(0);
    expect(report.providers).toHaveLength(3);
    expect(report.providers.every((provider) => provider.status === 'configured')).toBe(true);
    expect(report.providers.every((provider) => provider.weightedScore > 0)).toBe(true);
    expect(report.comparison).toHaveLength(report.fixtures.length);
  });
});
