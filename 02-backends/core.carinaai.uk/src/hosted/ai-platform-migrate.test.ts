import { describe, expect, it, vi, beforeEach } from 'vitest';

const modelRows: Array<Record<string, unknown>> = [];

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (/INSERT INTO ai_platform_models/.test(sql)) {
        modelRows.push({
          id: params?.[0],
          org_id: params?.[1],
          provider: params?.[2],
          model: params?.[3],
        });
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  },
}));

vi.mock('./scoped-query.js', () => ({
  queryForOrg: vi.fn(async (orgId: string, sql: string) => {
    if (/COUNT\(\*\)/.test(sql)) {
      const count = modelRows.filter((row) => row.org_id === orgId).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }),
}));

import { DEFAULT_MODELS } from './ai-platform-schema.js';
import { seedDefaultModelsForOrg } from './ai-platform-migrate.js';

describe('ai-platform-migrate', () => {
  beforeEach(() => {
    modelRows.length = 0;
  });

  it('seedDefaultModelsForOrg inserts catalog once per org', async () => {
    await seedDefaultModelsForOrg('org-1');
    expect(modelRows).toHaveLength(DEFAULT_MODELS.length);
    expect(modelRows.every((row) => row.org_id === 'org-1')).toBe(true);

    await seedDefaultModelsForOrg('org-1');
    expect(modelRows).toHaveLength(DEFAULT_MODELS.length);
  });

  it('seedDefaultModelsForOrg scopes rows by org', async () => {
    await seedDefaultModelsForOrg('org-a');
    await seedDefaultModelsForOrg('org-b');
    expect(modelRows.filter((row) => row.org_id === 'org-a')).toHaveLength(DEFAULT_MODELS.length);
    expect(modelRows.filter((row) => row.org_id === 'org-b')).toHaveLength(DEFAULT_MODELS.length);
  });
});
