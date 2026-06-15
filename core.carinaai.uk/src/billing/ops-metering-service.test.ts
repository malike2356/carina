import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));

vi.mock('../hosted/ai-platform-models.js', () => ({
  estimateTokensFromText: (text: string) => Math.ceil(text.length / 4),
}));

describe('estimateWorkbenchUsage', () => {
  beforeEach(() => {
    query.mockReset();
    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('ops_plan_model_classes') && params?.[1] === 'frontier') {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('ops_plan_model_classes')) {
        return { rows: [{ model_class: params?.[1] ?? 'balanced' }], rowCount: 1 };
      }
      if (sql.includes('ops_model_rate_cards')) {
        return {
          rows: [{
            id: 1,
            model_class: params?.[0] ?? 'balanced',
            input_weight: '0.000006',
            output_weight: '0.000024',
            cache_weight: '0.0000015',
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('GROUP BY event_type')) {
        return { rows: [{ event_type: 'usage', total: '-1000' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
  });

  it('returns allowed estimate with credits and balance for BYOK', async () => {
    const { estimateWorkbenchUsage } = await import('./ops-metering-service.js');
    const result = await estimateWorkbenchUsage({
      orgId: 'org-1',
      planId: 'carina_ops_starter',
      provider: 'anthropic',
      model: 'claude-sonnet',
      prompt: 'Hello world test prompt',
      byok: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.modelClass).toBe('balanced');
    expect(result.estimatedCredits).toBeGreaterThan(0);
    expect(result.estimatedProviderCostUsd).toBeGreaterThan(0);
    expect(result.remainingCredits).toBeGreaterThan(0);
    expect(result.byok).toBe(true);
  });

  it('blocks frontier model class on starter plan', async () => {
    const { estimateWorkbenchUsage } = await import('./ops-metering-service.js');
    const result = await estimateWorkbenchUsage({
      orgId: 'org-1',
      planId: 'carina_ops_starter',
      provider: 'openai',
      model: 'gpt-5-preview',
      prompt: 'test',
      byok: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.modelClass).toBe('frontier');
    expect(result.gateReason).toContain('not available');
  });

  it('blocks managed inference when credits exhausted', async () => {
    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('GROUP BY event_type')) {
        return { rows: [{ event_type: 'usage', total: '-500000' }], rowCount: 1 };
      }
      if (sql.includes('ops_plan_model_classes')) {
        return { rows: [{ model_class: params?.[1] ?? 'mini' }], rowCount: 1 };
      }
      if (sql.includes('ops_model_rate_cards')) {
        return {
          rows: [{
            id: 1,
            model_class: 'mini',
            input_weight: '0.000001',
            output_weight: '0.000004',
            cache_weight: '0.0000005',
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const { estimateWorkbenchUsage } = await import('./ops-metering-service.js');
    const result = await estimateWorkbenchUsage({
      orgId: 'org-1',
      planId: 'carina_ops_starter',
      provider: 'openai',
      model: 'gpt-4o-mini',
      prompt: 'test',
      byok: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.byok).toBe(false);
    expect(result.gateReason).toBeTruthy();
  });
});

describe('billingPlanIdFromOrgPlan', () => {
  it('maps ops and enterprise plans', async () => {
    const { billingPlanIdFromOrgPlan } = await import('./ops-metering-service.js');
    expect(billingPlanIdFromOrgPlan('carina_ops_starter')).toBe('carina_ops_starter');
    expect(billingPlanIdFromOrgPlan('carina_ops_team')).toBe('carina_ops_team');
    expect(billingPlanIdFromOrgPlan('enterprise')).toBe('enterprise');
    expect(billingPlanIdFromOrgPlan('unknown')).toBe('free');
  });
});
