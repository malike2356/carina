import { describe, expect, it, vi, beforeEach } from 'vitest';

const envRows: Array<Record<string, unknown>> = [];
const depRows: Array<Record<string, unknown>> = [];
const auditRows: Array<Record<string, unknown>> = [];

vi.mock('./scoped-query.js', () => ({
  queryForOrg: vi.fn(async (orgId: string, sql: string, params?: unknown[]) => {
    if (/INSERT INTO ai_platform_environments/.test(sql)) {
      envRows.push({
        id: params?.[0],
        org_id: orgId,
        name: params?.[1],
        slug: params?.[2],
        status: 'active',
        api_base_url: params?.[3],
        notes: params?.[4],
        created_at: new Date(),
        updated_at: new Date(),
      });
      return { rows: [], rowCount: 1 };
    }
    if (/INSERT INTO ai_platform_deployments/.test(sql)) {
      depRows.push({
        id: params?.[0],
        org_id: orgId,
        name: params?.[1],
        environment_id: params?.[2],
        model: params?.[3],
        provider: params?.[4],
        version: params?.[5],
        status: 'pending',
        metadata_json: JSON.parse(String(params?.[6] ?? '{}')),
        created_at: new Date(),
        deployed_at: null,
      });
      return { rows: [], rowCount: 1 };
    }
    if (/FROM ai_platform_environments/.test(sql)) {
      return { rows: envRows.filter((row) => row.org_id === orgId), rowCount: envRows.length };
    }
    if (/FROM ai_platform_deployments/.test(sql)) {
      return { rows: depRows.filter((row) => row.org_id === orgId), rowCount: depRows.length };
    }
    return { rows: [], rowCount: 0 };
  }),
}));

vi.mock('./product-audit.js', () => ({
  writeProductAudit: vi.fn(async (event: { action: string; orgId: string }) => {
    auditRows.push({ action: event.action, org_id: event.orgId });
  }),
}));

import {
  createDeploymentForOrg,
  createEnvironmentForOrg,
  listDeploymentsForOrg,
  listEnvironmentsForOrg,
} from './deployments-service.js';

describe('deployments-service', () => {
  beforeEach(() => {
    envRows.length = 0;
    depRows.length = 0;
    auditRows.length = 0;
  });

  it('createEnvironmentForOrg scopes rows by org', async () => {
    await createEnvironmentForOrg('org-a', { name: 'Production' }, 'user-1');
    await createEnvironmentForOrg('org-b', { name: 'Staging' }, 'user-2');
    const envsA = await listEnvironmentsForOrg('org-a');
    expect(envsA).toHaveLength(1);
    expect(envsA[0].name).toBe('Production');
  });

  it('createDeploymentForOrg links environment and audits', async () => {
    const env = await createEnvironmentForOrg('org-a', { name: 'Prod' }, 'user-1');
    const dep = await createDeploymentForOrg(
      'org-a',
      { name: 'carina-agent', environmentId: env.id, provider: 'anthropic', model: 'claude-sonnet' },
      'user-1',
    );
    expect(dep.environmentId).toBe(env.id);
    expect(auditRows.some((row) => row.action === 'deployment.created')).toBe(true);
  });

  it('listDeploymentsForOrg returns only org rows', async () => {
    depRows.push({ org_id: 'org-a', id: 'd1', name: 'A', status: 'pending', model: '', provider: '', version: '1', metadata_json: {}, created_at: new Date(), deployed_at: null });
    depRows.push({ org_id: 'org-b', id: 'd2', name: 'B', status: 'pending', model: '', provider: '', version: '1', metadata_json: {}, created_at: new Date(), deployed_at: null });
    const deps = await listDeploymentsForOrg('org-a');
    expect(deps).toHaveLength(1);
    expect(deps[0].name).toBe('A');
  });
});
