import { describe, expect, it, vi, beforeEach } from 'vitest';

const runRows: Array<Record<string, unknown>> = [];
const usageRows: Array<Record<string, unknown>> = [];
const auditRows: Array<Record<string, unknown>> = [];

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
          status: params?.[6] ?? 'running',
          tokens_in: 0,
          tokens_out: 0,
          cost_estimate: 0,
          response_text: null,
          created_at: new Date(),
        });
        return { rows: [], rowCount: 1 };
      }
      if (/UPDATE ai_platform_workbench_runs/.test(sql)) {
        const id = params?.[0];
        const row = runRows.find((r) => r.id === id);
        if (row) {
          row.status = 'completed';
          row.tokens_in = params?.[1];
          row.tokens_out = params?.[2];
          row.cost_estimate = params?.[3];
          row.response_text = params?.[4];
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

vi.mock('../api/hosted-billing.js', () => ({
  checkOrgUsageQuota: vi.fn(async () => ({ allowed: true, warning: false, used: 0, limit: 500_000 })),
}));

vi.mock('./product-audit.js', () => ({
  writeProductAudit: vi.fn(async (event: { action: string }) => {
    auditRows.push({ action: event.action });
  }),
}));

import {
  executeWorkbenchRun,
  listWorkbenchRuns,
  WorkbenchMissingKeyError,
  WorkbenchQuotaError,
  WorkbenchValidationError,
} from './workbench-service.js';
import { checkOrgUsageQuota } from '../api/hosted-billing.js';

describe('workbench-service', () => {
  beforeEach(() => {
    runRows.length = 0;
    usageRows.length = 0;
    auditRows.length = 0;
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

  it('requires BYOK key for provider', async () => {
    const { getTenantProvider } = await import('../brain/tenant-provider-keys.js');
    vi.mocked(getTenantProvider).mockResolvedValueOnce(null);
    await expect(
      executeWorkbenchRun({
        orgId: 'org-1',
        tenantId: 'user-1',
        actorUserId: 'user-1',
        prompt: 'hello',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      }),
    ).rejects.toBeInstanceOf(WorkbenchMissingKeyError);
  });

  it('completes run, records usage, and writes audit events', async () => {
    const result = await executeWorkbenchRun({
      orgId: 'org-1',
      tenantId: 'user-1',
      actorUserId: 'user-1',
      prompt: 'Say hi',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      llmRunner: async () => ({ content: 'Hi there', tokensUsed: 20 }),
    });

    expect(result.responseText).toBe('Hi there');
    expect(usageRows).toHaveLength(1);
    expect(usageRows[0].org_id).toBe('org-1');
    expect(auditRows.map((row) => row.action)).toEqual([
      'workbench.run_started',
      'workbench.run_completed',
    ]);
  });

  it('blocks run when monthly quota exceeded', async () => {
    vi.mocked(checkOrgUsageQuota).mockResolvedValueOnce({
      allowed: false,
      warning: false,
      used: 500_000,
      limit: 500_000,
    });
    await expect(
      executeWorkbenchRun({
        orgId: 'org-1',
        tenantId: 'user-1',
        actorUserId: 'user-1',
        prompt: 'hello',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      }),
    ).rejects.toBeInstanceOf(WorkbenchQuotaError);
  });

  it('listWorkbenchRuns scopes by org', async () => {
    runRows.push({ org_id: 'org-a', id: 'r1', title: 'A', created_at: new Date() });
    runRows.push({ org_id: 'org-b', id: 'r2', title: 'B', created_at: new Date() });
    const runs = await listWorkbenchRuns('org-a');
    expect(runs).toHaveLength(1);
    expect(runs[0].orgId).toBe('org-a');
  });
});
