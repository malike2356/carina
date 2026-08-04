import { describe, expect, it, vi, beforeEach } from 'vitest';

const assetRows: Array<Record<string, unknown>> = [];
const agentRows: Array<Record<string, unknown>> = [];
const sessionRows: Array<Record<string, unknown>> = [];
const memoryRows: Array<Record<string, unknown>> = [];
const usageDailyRows: Array<Record<string, unknown>> = [];
const workbenchRows: Array<Record<string, unknown>> = [];
const auditRows: Array<Record<string, unknown>> = [];

vi.mock('../skills/index.js', () => ({
  listAvailablePacks: vi.fn(() => [
    { name: 'core', version: '1.0.0', description: 'Core pack', skillCount: 3 },
  ]),
}));

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (sql: string) => {
      if (/FROM installed_packs/.test(sql)) {
        return { rows: [{ pack_name: 'core', version: '1.0.0', status: 'active' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  },
}));

vi.mock('./scoped-query.js', () => ({
  queryForOrg: vi.fn(async (orgId: string, sql: string, params?: unknown[]) => {
    if (/INSERT INTO ai_platform_assets/.test(sql) && /'file'/.test(sql)) {
      assetRows.push({
        id: params?.[0],
        org_id: orgId,
        kind: 'file',
        name: params?.[1],
        status: 'ready',
        mime_type: params?.[2] ?? null,
        size_bytes: params?.[3] ?? null,
        storage_uri: params?.[4] ?? null,
        batch_input_count: null,
        batch_output_count: null,
        metadata_json: JSON.parse(String(params?.[5] ?? '{}')),
        created_at: new Date(),
        updated_at: new Date(),
      });
      return { rows: [], rowCount: 1 };
    }
    if (/INSERT INTO ai_platform_assets/.test(sql) && /'batch'/.test(sql)) {
      assetRows.push({
        id: params?.[0],
        org_id: orgId,
        kind: 'batch',
        name: params?.[1],
        status: 'queued',
        mime_type: null,
        size_bytes: null,
        storage_uri: null,
        batch_input_count: params?.[2] ?? 0,
        batch_output_count: 0,
        metadata_json: JSON.parse(String(params?.[3] ?? '{}')),
        created_at: new Date(),
        updated_at: new Date(),
      });
      return { rows: [], rowCount: 1 };
    }
    if (/INSERT INTO ai_platform_agents/.test(sql)) {
      agentRows.push({
        id: params?.[0],
        org_id: orgId,
        name: params?.[1],
        slug: params?.[2],
        status: params?.[3],
        model: params?.[4],
        provider: params?.[5],
        instructions: params?.[6] ?? null,
        metadata_json: {},
        created_at: new Date(),
        updated_at: new Date(),
      });
      return { rows: [], rowCount: 1 };
    }
    if (/INSERT INTO ai_platform_sessions/.test(sql)) {
      sessionRows.push({
        id: params?.[0],
        org_id: orgId,
        agent_id: params?.[1] ?? null,
        title: params?.[2],
        channel: params?.[3],
        status: 'open',
        message_count: 0,
        last_activity_at: new Date(),
        metadata_json: {},
        created_at: new Date(),
      });
      return { rows: [], rowCount: 1 };
    }
    if (/INSERT INTO ai_platform_memory_stores/.test(sql)) {
      memoryRows.push({
        id: params?.[0],
        org_id: orgId,
        name: params?.[1],
        slug: params?.[2],
        store_type: params?.[3],
        status: 'active',
        record_count: 0,
        notes: params?.[4] ?? null,
        created_at: new Date(),
        updated_at: new Date(),
      });
      return { rows: [], rowCount: 1 };
    }
    if (/FROM ai_platform_assets/.test(sql) && /kind = 'file'/.test(sql)) {
      return { rows: assetRows.filter((row) => row.org_id === orgId && row.kind === 'file'), rowCount: 1 };
    }
    if (/FROM ai_platform_assets/.test(sql) && /kind = 'batch'/.test(sql)) {
      return { rows: assetRows.filter((row) => row.org_id === orgId && row.kind === 'batch'), rowCount: 1 };
    }
    if (/FROM ai_platform_agents/.test(sql)) {
      return { rows: agentRows.filter((row) => row.org_id === orgId), rowCount: 1 };
    }
    if (/FROM ai_platform_sessions/.test(sql)) {
      return { rows: sessionRows.filter((row) => row.org_id === orgId), rowCount: 1 };
    }
    if (/FROM ai_platform_memory_stores/.test(sql)) {
      return { rows: memoryRows.filter((row) => row.org_id === orgId), rowCount: 1 };
    }
    if (/FROM ai_platform_usage_daily/.test(sql)) {
      return { rows: usageDailyRows.filter((row) => row.org_id === orgId), rowCount: 1 };
    }
    if (/INSERT INTO ai_platform_usage_daily/.test(sql)) {
      return { rows: [], rowCount: 1 };
    }
    if (/COUNT\(\*\)/.test(sql)) {
      if (/ai_platform_assets/.test(sql)) {
        const kind = sql.includes("'batch'") ? 'batch' : 'file';
        const count = assetRows.filter((row) => row.org_id === orgId && row.kind === kind).length;
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }
      if (/ai_platform_agents/.test(sql)) {
        const count = agentRows.filter((row) => row.org_id === orgId).length;
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }
      if (/ai_platform_sessions/.test(sql)) {
        const count = sessionRows.filter((row) => row.org_id === orgId).length;
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }
      if (/ai_platform_memory_stores/.test(sql)) {
        const count = memoryRows.filter((row) => row.org_id === orgId).length;
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }
      if (/ai_platform_workbench_runs/.test(sql)) {
        const count = workbenchRows.filter((row) => row.org_id === orgId).length;
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }
      return { rows: [{ count: '0' }], rowCount: 1 };
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
  ControlPlaneValidationError,
  createAgentForOrg,
  createBatchForOrg,
  createFileForOrg,
  createMemoryStoreForOrg,
  createSessionForOrg,
  getControlPlaneSummary,
  listFilesForOrg,
  listSkillPacksForTenant,
} from './control-plane-service.js';

describe('control-plane-service', () => {
  beforeEach(() => {
    assetRows.length = 0;
    agentRows.length = 0;
    sessionRows.length = 0;
    memoryRows.length = 0;
    usageDailyRows.length = 0;
    workbenchRows.length = 0;
    auditRows.length = 0;
  });

  it('createFileForOrg scopes rows and audits', async () => {
    const file = await createFileForOrg('org-a', { name: 'brief.pdf', mimeType: 'application/pdf' }, 'user-1');
    expect(file.name).toBe('brief.pdf');
    expect(auditRows.some((row) => row.action === 'platform.file.created')).toBe(true);
    await createFileForOrg('org-b', { name: 'other.txt' }, 'user-2');
    const filesA = await listFilesForOrg('org-a');
    expect(filesA).toHaveLength(1);
    const summary = await getControlPlaneSummary('org-a', 'tenant-a');
    expect(summary.agents).toBe(0);
  });

  it('createBatchForOrg queues batch assets', async () => {
    const batch = await createBatchForOrg('org-a', { name: 'June eval', inputCount: 12 }, 'user-1');
    expect(batch.status).toBe('queued');
    expect(batch.batchInputCount).toBe(12);
  });

  it('createAgentForOrg requires name', async () => {
    await expect(createAgentForOrg('org-a', { name: '  ' }, 'user-1')).rejects.toBeInstanceOf(ControlPlaneValidationError);
  });

  it('createSessionForOrg stores channel', async () => {
    const session = await createSessionForOrg('org-a', { title: 'API chat', channel: 'api' }, 'user-1');
    expect(session.channel).toBe('api');
    expect(session.title).toBe('API chat');
  });

  it('createMemoryStoreForOrg persists store metadata', async () => {
    const store = await createMemoryStoreForOrg('org-a', { name: 'Episodic', storeType: 'episodic' }, 'user-1');
    expect(store.slug).toBe('episodic');
    expect(store.storeType).toBe('episodic');
  });

  it('listSkillPacksForTenant merges installed state', async () => {
    const packs = await listSkillPacksForTenant('tenant-1');
    expect(packs[0]).toMatchObject({ name: 'core', installed: true, status: 'active' });
  });
});
