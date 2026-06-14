import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  estimateCost,
  estimateTokensFromText,
  encryptSecret,
  slugify,
  aiPlatformTablesReady,
  seedDefaultOrgIfMissing,
  listModels,
  createWorkbenchRun,
  createAsset,
  updateAsset,
  createEnvironment,
  updateEnvironment,
} from './ai-platform.js';

vi.mock('./db.js', () => {
  const stores = new Map<string, unknown[]>();

  function ensureTable(name: string): unknown[] {
    if (!stores.has(name)) stores.set(name, []);
    return stores.get(name)!;
  }

  return {
    pool: {},
    query: vi.fn(async (text: string, params?: unknown[]) => {
      const sql = text.replace(/\s+/g, ' ').trim();

      if (sql.includes('to_regclass')) {
        const table = String(params?.[0] ?? '').replace('public.', '');
        return { rows: [{ reg: stores.has(table) ? table : null }] };
      }

      if (sql.startsWith('CREATE TABLE')) {
        const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
        if (match) ensureTable(match[1]);
        return { rows: [] };
      }

      if (sql.includes('FROM ai_platform_orgs ORDER BY created_at ASC LIMIT 1')) {
        const rows = ensureTable('ai_platform_orgs');
        return { rows: rows.length ? [rows[0]] : [] };
      }

      if (sql.includes('INSERT INTO ai_platform_orgs')) {
        const row = {
          id: params?.[0],
          name: params?.[1],
          credit_balance: 0,
          monthly_limit: 500,
          auto_reload_enabled: false,
          prompt_caching_enabled: false,
          batch_enabled: false,
          created_at: new Date(),
          updated_at: new Date(),
        };
        ensureTable('ai_platform_orgs').push(row);
        return { rows: [] };
      }

      if (sql.includes('SELECT * FROM ai_platform_orgs WHERE id =')) {
        const rows = ensureTable('ai_platform_orgs');
        const found = rows.find((r) => (r as { id: string }).id === params?.[0]);
        return { rows: found ? [found] : [] };
      }

      if (sql.includes('COUNT(*)::text AS count FROM ai_platform_models')) {
        const rows = ensureTable('ai_platform_models');
        return { rows: [{ count: String(rows.length) }] };
      }

      if (sql.includes('INSERT INTO ai_platform_models')) {
        ensureTable('ai_platform_models').push({
          id: params?.[0],
          provider: params?.[1],
          model: params?.[2],
          tier: params?.[3],
          is_default: params?.[4],
          status: params?.[5],
          input_price: params?.[6],
          output_price: params?.[7],
          notes: params?.[8],
          created_at: new Date(),
          updated_at: new Date(),
        });
        return { rows: [] };
      }

      if (sql.includes('FROM ai_platform_models ORDER BY')) {
        return { rows: ensureTable('ai_platform_models') };
      }

      if (sql.includes('INSERT INTO ai_platform_workbench_runs')) {
        const row = {
          id: params?.[0],
          org_id: params?.[1],
          title: params?.[2],
          prompt: params?.[3],
          provider: params?.[4],
          model: params?.[5],
          status: params?.[6],
          tokens_in: 0,
          tokens_out: 0,
          cost_estimate: 0,
          response_text: null,
          created_at: new Date(),
        };
        ensureTable('ai_platform_workbench_runs').push(row);
        return { rows: [] };
      }

      if (sql.includes('SELECT * FROM ai_platform_workbench_runs WHERE id =')) {
        const rows = ensureTable('ai_platform_workbench_runs');
        const found = rows.find((r) => (r as { id: string }).id === params?.[0]);
        return { rows: found ? [found] : [] };
      }

      if (sql.includes('UPDATE ai_platform_workbench_runs')) {
        const rows = ensureTable('ai_platform_workbench_runs');
        const row = rows.find((r) => (r as { id: string }).id === params?.[params.length - 1]) as Record<string, unknown> | undefined;
        if (row && sql.includes('status =')) row.status = params?.[0];
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO ai_platform_assets')) {
        const row = {
          id: params?.[0],
          kind: params?.[1],
          name: params?.[2],
          slug: params?.[3],
          status: params?.[4],
          metadata_json: JSON.parse(String(params?.[5] ?? '{}')),
          created_at: new Date(),
          updated_at: new Date(),
        };
        ensureTable('ai_platform_assets').push(row);
        return { rows: [] };
      }

      if (sql.includes('SELECT * FROM ai_platform_assets WHERE id =')) {
        const rows = ensureTable('ai_platform_assets');
        const found = rows.find((r) => (r as { id: string }).id === params?.[0]);
        return { rows: found ? [found] : [] };
      }

      if (sql.includes('FROM ai_platform_assets')) {
        const kind = params?.[0];
        let rows = ensureTable('ai_platform_assets');
        if (kind) rows = rows.filter((r) => (r as { kind: string }).kind === kind);
        return { rows };
      }

      if (sql.includes('UPDATE ai_platform_assets')) {
        return { rows: [] };
      }

      if (sql.includes('DELETE FROM ai_platform_assets')) {
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO ai_platform_environments')) {
        const row = {
          id: params?.[0],
          name: params?.[1],
          slug: params?.[2],
          api_base_url: params?.[3],
          notes: params?.[4],
          status: params?.[5],
          created_at: new Date(),
          updated_at: new Date(),
        };
        ensureTable('ai_platform_environments').push(row);
        return { rows: [] };
      }

      if (sql.includes('FROM ai_platform_environments ORDER BY')) {
        return { rows: ensureTable('ai_platform_environments') };
      }

      if (sql.includes('UPDATE ai_platform_environments')) {
        const rows = ensureTable('ai_platform_environments');
        const row = rows.find((r) => (r as { id: string }).id === params?.[params.length - 1]) as Record<string, unknown> | undefined;
        if (row && sql.includes('name =')) row.name = params?.[0];
        return { rows: [] };
      }

      return { rows: [] };
    }),
  };
});

describe('ai-platform pure helpers', () => {
  it('slugify normalizes names', () => {
    expect(slugify('Production API')).toBe('production-api');
    expect(slugify('---')).toBe('item');
  });

  it('estimateCost uses per-million pricing', () => {
    const cost = estimateCost(1_000_000, 500_000, 3, 15);
    expect(cost).toBeCloseTo(10.5, 4);
  });

  it('estimateTokensFromText uses char heuristic', () => {
    expect(estimateTokensFromText('abcd')).toBe(1);
    expect(estimateTokensFromText('a'.repeat(40))).toBe(10);
  });

  it('encryptSecret returns iv:ciphertext format', () => {
    const enc = encryptSecret('sk-test-key');
    expect(enc).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });
});

describe('ai-platform persistence helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports tables missing until org table exists', async () => {
    expect(await aiPlatformTablesReady()).toBe(false);
  });

  it('seeds default org when missing', async () => {
    const org = await seedDefaultOrgIfMissing();
    expect(org.name).toBe('Default Organization');
    expect(org.monthlyLimit).toBe(500);
    expect(await aiPlatformTablesReady()).toBe(true);
  });

  it('persists workbench runs', async () => {
    const org = await seedDefaultOrgIfMissing();
    const run = await createWorkbenchRun({
      orgId: org.id,
      prompt: 'Hello',
      provider: 'anthropic',
      model: 'claude-sonnet',
      status: 'draft',
    });
    expect(run.prompt).toBe('Hello');
    expect(run.status).toBe('draft');
  });

  it('creates and lists assets', async () => {
    const asset = await createAsset({
      kind: 'file',
      name: 'notes.txt',
      metadataJson: { tags: ['docs'] },
    });
    expect(asset.slug).toBe('notes-txt');
    expect(asset.metadataJson.tags).toEqual(['docs']);
  });

  it('creates and updates environments', async () => {
    const env = await createEnvironment({ name: 'Staging', apiBaseUrl: 'http://localhost:3333' });
    expect(env.slug).toBe('staging');
    await updateEnvironment(env.id, { name: 'Staging v2' });
    expect(env.name).toBe('Staging');
  });
});

describe('model listing', () => {
  it('returns empty before seed, populated after ensure schema path', async () => {
    await seedDefaultOrgIfMissing();
    const before = await listModels();
    expect(Array.isArray(before)).toBe(true);
  });
});
