import { describe, expect, it, vi, beforeEach } from 'vitest';

const runRows: Array<Record<string, unknown>> = [];
const usageRows: Array<Record<string, unknown>> = [];
const auditRows: Array<Record<string, unknown>> = [];
const ledgerRows: Array<Record<string, unknown>> = [];

const resolveInferenceModeMock = vi.fn(async () => 'byok' as 'byok' | 'managed' | null);

vi.mock('./workbench-inference.js', () => ({
  resolveWorkbenchInferenceMode: (...args: unknown[]) => resolveInferenceModeMock(...args),
  getWorkbenchInferenceCapabilities: vi.fn(async () => ({
    byok: false,
    managed: false,
    inferenceMode: null,
  })),
}));

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (/INSERT INTO ai_platform_workbench_runs/.test(sql)) {
        runRows.push({
          id: params?.[0],
          org_id: params?.[1],
          title: params?.[2],
          prompt: params?.[3],
          provider: params?.[4],
          model: params?.[5],
          status: 'running',
          model_class: params?.[6] ?? null,
          tokens_in: 0,
          tokens_out: 0,
          tokens_cached: 0,
          credits_billed: 0,
          cost_estimate: 0,
          response_text: null,
          created_at: new Date(),
        });
        return { rows: [], rowCount: 1 };
      }
      if (/UPDATE ai_platform_workbench_runs/.test(sql) && /status = 'failed'/.test(sql)) {
        const id = params?.[0];
        const row = runRows.find((r) => r.id === id);
        if (row) {
          row.status = 'failed';
        }
        return { rows: [], rowCount: 1 };
      }
      if (/UPDATE ai_platform_workbench_runs/.test(sql) && /status = 'completed'/.test(sql)) {
        const id = params?.[0];
        const row = runRows.find((r) => r.id === id);
        if (row) {
          row.status = 'completed';
          row.tokens_in = params?.[1];
          row.tokens_out = params?.[2];
          row.tokens_cached = params?.[3];
          row.model_class = params?.[4];
          row.credits_billed = params?.[5];
          row.cost_estimate = params?.[6];
          row.response_text = params?.[7];
        }
        return { rows: [], rowCount: 1 };
      }
      if (/INSERT INTO usage_records/.test(sql)) {
        usageRows.push({
          tenant_id: params?.[0],
          org_id: params?.[1],
          tokens_used: params?.[3],
          model: params?.[4],
          cost_estimate: params?.[5],
        });
        return { rows: [], rowCount: 1 };
      }
      if (/INSERT INTO ops_credit_ledger/.test(sql)) {
        ledgerRows.push({
          org_id: params?.[0],
          event_type: params?.[1],
          credits: params?.[2],
          provider_cost_usd: params?.[3],
          model: params?.[4],
          model_class: params?.[5],
          session_id: params?.[6],
        });
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  },
}));

vi.mock('./scoped-query.js', () => ({
  queryForOrg: vi.fn(async (orgId: string, sql: string, params?: unknown[]) => {
    if (/FROM ai_platform_workbench_runs/.test(sql) && /ORDER BY/.test(sql)) {
      const rows = runRows.filter((row) => row.org_id === orgId);
      return { rows, rowCount: rows.length };
    }
    if (/COUNT\(\*\)/.test(sql)) {
      const count = runRows.filter((row) => row.org_id === orgId && row.status === 'completed').length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }
    if (/input_price/.test(sql)) {
      return { rows: [{ input_price: 3, output_price: 15 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }),
}));

vi.mock('../brain/tenant-provider-keys.js', () => ({
  getTenantProvider: vi.fn(async () => ({ provider: 'anthropic', apiKey: 'sk-test' })),
}));

vi.mock('./plan-gates.js', () => ({
  getOrgPlan: vi.fn(async (orgId: string) =>
    orgId === 'org-team' ? 'carina_ops_team' : 'carina_ops_starter',
  ),
}));

const isModelClassAllowedOnPlanMock = vi.fn(async (_planId: string, modelClass: string) =>
  modelClass !== 'frontier',
);

const checkCreditGateMock = vi.fn(async () => ({
  allowed: true,
  remainingCredits: 100,
  modelClassAllowed: true,
}));

vi.mock('../billing/credit-gate.js', () => ({
  isModelClassAllowedOnPlan: (...args: unknown[]) => isModelClassAllowedOnPlanMock(...args),
  checkCreditGate: (...args: unknown[]) => checkCreditGateMock(...args),
}));

vi.mock('../billing/credit-ledger.js', () => ({
  recordByokUsage: vi.fn(async (input: Record<string, unknown>) => {
    ledgerRows.push({
      org_id: input.orgId,
      event_type: 'byok_usage',
      credits: 0,
      provider_cost_usd: input.providerCostUsd,
      model: input.model,
      model_class: input.modelClass,
      session_id: input.sessionId,
    });
  }),
  debitCredits: vi.fn(async (input: Record<string, unknown>) => {
    ledgerRows.push({
      org_id: input.orgId,
      event_type: 'usage',
      credits: -(input.credits as number),
      provider_cost_usd: input.providerCostUsd,
      model: input.model,
      model_class: input.modelClass,
      session_id: input.sessionId,
    });
  }),
  getMonthlyBalance: vi.fn(async () => ({
    used: 10,
    remaining: 90,
    topups: 0,
  })),
}));

vi.mock('../billing/rate-card.js', () => ({
  classifyModel: vi.fn((model: string) => {
    if (model.includes('opus') || model.includes('gpt-5')) return 'frontier';
    if (model.includes('haiku')) return 'mini';
    return 'balanced';
  }),
  computeBillableCredits: vi.fn(() => 42),
  estimateCreditsForCall: vi.fn(() => 40),
  getCurrentRateCard: vi.fn(async (modelClass: string) => ({
    id: 1,
    modelClass,
    inputWeight: 0.000006,
    outputWeight: 0.000024,
    cacheWeight: 0.0000015,
  })),
}));

vi.mock('../brain/cost-tracker.js', () => ({
  estimateCost: vi.fn(() => 0.0025),
}));

vi.mock('./usage-service.js', () => ({
  maybeNotifyUsageWarning: vi.fn(async () => undefined),
}));

vi.mock('./product-audit.js', () => ({
  writeProductAudit: vi.fn(async (event: { action: string }) => {
    auditRows.push({ action: event.action });
  }),
}));

import {
  executeWorkbenchRun,
  listWorkbenchRuns,
  WorkbenchCreditsError,
  WorkbenchInferenceUnavailableError,
  WorkbenchValidationError,
} from './workbench-service.js';
import { recordByokUsage, debitCredits } from '../billing/credit-ledger.js';
import { getOrgPlan } from './plan-gates.js';

describe('workbench-service', () => {
  beforeEach(() => {
    runRows.length = 0;
    usageRows.length = 0;
    auditRows.length = 0;
    ledgerRows.length = 0;
    vi.clearAllMocks();
    resolveInferenceModeMock.mockResolvedValue('byok');
    isModelClassAllowedOnPlanMock.mockImplementation(async (_planId, modelClass) =>
      modelClass !== 'frontier',
    );
    checkCreditGateMock.mockResolvedValue({
      allowed: true,
      remainingCredits: 100,
      modelClassAllowed: true,
    });
    vi.mocked(getOrgPlan).mockImplementation(async (orgId: string) =>
      orgId === 'org-team' ? 'carina_ops_team' : 'carina_ops_starter',
    );
  });

  it('rejects empty prompt', async () => {
    await expect(
      executeWorkbenchRun({
        orgId: 'org-1',
        tenantId: 'user-1',
        actorUserId: 'user-1',
        prompt: '   ',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      }),
    ).rejects.toBeInstanceOf(WorkbenchValidationError);
  });

  it('rejects when no inference path is available', async () => {
    resolveInferenceModeMock.mockResolvedValueOnce(null);
    await expect(
      executeWorkbenchRun({
        orgId: 'org-1',
        tenantId: 'user-1',
        actorUserId: 'user-1',
        prompt: 'hello',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      }),
    ).rejects.toBeInstanceOf(WorkbenchInferenceUnavailableError);
  });

  it('blocks frontier model class on starter plan', async () => {
    await expect(
      executeWorkbenchRun({
        orgId: 'org-1',
        tenantId: 'user-1',
        actorUserId: 'user-1',
        prompt: 'hello',
        provider: 'anthropic',
        model: 'claude-opus-4-20250514',
      }),
    ).rejects.toMatchObject({
      name: 'WorkbenchCreditsError',
      code: 'model_class_blocked',
    });
    expect(runRows).toHaveLength(0);
  });

  it('completes BYOK run, records ledger with zero credits, and uses directional tokens', async () => {
    const result = await executeWorkbenchRun({
      orgId: 'org-1',
      tenantId: 'user-1',
      actorUserId: 'user-1',
      prompt: 'Say hi',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      llmRunner: async () => ({
        content: 'Hi there',
        tokensIn: 12,
        tokensOut: 8,
        tokensCached: 2,
        tokensUsed: 20,
      }),
    });

    expect(result.responseText).toBe('Hi there');
    expect(result.tokensIn).toBe(12);
    expect(result.tokensOut).toBe(8);
    expect(result.tokensCached).toBe(2);
    expect(result.modelClass).toBe('balanced');
    expect(result.creditsBilled).toBe(0);
    expect(result.inferenceMode).toBe('byok');
    expect(recordByokUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        modelClass: 'balanced',
        providerCostUsd: 0.0025,
      }),
    );
    expect(debitCredits).not.toHaveBeenCalled();
    expect(ledgerRows.some((row) => row.event_type === 'byok_usage' && row.credits === 0)).toBe(true);
    expect(usageRows).toHaveLength(1);
    expect(runRows[0].status).toBe('completed');
    expect(auditRows.map((row) => row.action)).toEqual([
      'workbench.run_started',
      'workbench.run_completed',
    ]);
  });

  it('completes managed run and debits billable credits', async () => {
    resolveInferenceModeMock.mockResolvedValue('managed');

    const result = await executeWorkbenchRun({
      orgId: 'org-1',
      tenantId: 'user-1',
      actorUserId: 'user-1',
      prompt: 'Say hi',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      llmRunner: async () => ({
        content: 'Managed reply',
        tokensIn: 20,
        tokensOut: 10,
        tokensCached: 0,
        tokensUsed: 30,
      }),
    });

    expect(result.inferenceMode).toBe('managed');
    expect(result.creditsBilled).toBe(42);
    expect(debitCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        credits: 42,
        modelClass: 'balanced',
      }),
    );
    expect(recordByokUsage).not.toHaveBeenCalled();
    expect(runRows[0].credits_billed).toBe(42);
  });

  it('blocks managed run when credit gate rejects pre-run estimate', async () => {
    resolveInferenceModeMock.mockResolvedValue('managed');
    checkCreditGateMock.mockResolvedValue({
      allowed: false,
      reason: 'monthly credit allowance exhausted. Top up or upgrade.',
      remainingCredits: 0,
      modelClassAllowed: true,
    });

    await expect(
      executeWorkbenchRun({
        orgId: 'org-1',
        tenantId: 'user-1',
        actorUserId: 'user-1',
        prompt: 'hello',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        llmRunner: async () => ({
          content: 'should not run',
          tokensIn: 1,
          tokensOut: 1,
          tokensCached: 0,
          tokensUsed: 2,
        }),
      }),
    ).rejects.toMatchObject({
      name: 'WorkbenchCreditsError',
      code: 'credits_exhausted',
    });

    expect(runRows).toHaveLength(0);
    expect(debitCredits).not.toHaveBeenCalled();
  });

  it('marks run failed when LLM runner throws', async () => {
    await expect(
      executeWorkbenchRun({
        orgId: 'org-1',
        tenantId: 'user-1',
        actorUserId: 'user-1',
        prompt: 'hello',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        llmRunner: async () => {
          throw new Error('provider timeout');
        },
      }),
    ).rejects.toThrow('provider timeout');

    expect(runRows).toHaveLength(1);
    expect(runRows[0].status).toBe('failed');
    expect(ledgerRows).toHaveLength(0);
  });

  it('listWorkbenchRuns scopes by org', async () => {
    runRows.push({ org_id: 'org-a', id: 'r1', title: 'A', created_at: new Date() });
    runRows.push({ org_id: 'org-b', id: 'r2', title: 'B', created_at: new Date() });
    const runs = await listWorkbenchRuns('org-a');
    expect(runs).toHaveLength(1);
    expect(runs[0].orgId).toBe('org-a');
  });
});
