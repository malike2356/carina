import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type pg from 'pg';
import { HoneypotManager } from '../honeypot-manager.js';

const queryMock = vi.fn();
const dispatchMock = vi.fn().mockResolvedValue(undefined);
const mkdirSyncMock = vi.fn();
const writeFileSyncMock = vi.fn();

vi.mock('../../redis.js', () => ({
  getRedis: () => null,
}));

vi.mock('fs', () => ({
  default: {
    mkdirSync: (...args: unknown[]) => mkdirSyncMock(...args),
    writeFileSync: (...args: unknown[]) => writeFileSyncMock(...args),
  },
  mkdirSync: (...args: unknown[]) => mkdirSyncMock(...args),
  writeFileSync: (...args: unknown[]) => writeFileSyncMock(...args),
}));

function makePool(): pg.Pool {
  return { query: queryMock } as unknown as pg.Pool;
}

function honeypotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hp-1',
    type: 'api_key',
    name: 'honeypot-openai-test',
    value: 'sk-lab-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    description: 'Fake openai API key',
    instance_id: 'instance-1',
    triggered: false,
    triggered_at: null,
    trigger_ip: null,
    trigger_metadata: {},
    created_at: new Date(),
    ...overrides,
  };
}

describe('HoneypotManager.deployApiKeyHoneypot', () => {
  beforeEach(() => {
    queryMock.mockReset();
    dispatchMock.mockReset();
    dispatchMock.mockResolvedValue(undefined);
  });

  it('generates correct OpenAI format', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [honeypotRow({ value: 'placeholder' })],
    });
    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    const fake = manager.generateFakeKey('openai');
    expect(fake).toMatch(/^sk-lab-[A-Za-z0-9]{48}$/);
  });

  it('generates correct Anthropic format', async () => {
    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    const fake = manager.generateFakeKey('anthropic');
    expect(fake).toMatch(/^sk-ant-api03-[A-Za-z0-9_-]{95}$/);
  });

  it('generates correct DeepSeek format', async () => {
    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    const fake = manager.generateFakeKey('deepseek');
    expect(fake).toMatch(/^sk-[a-f0-9]{32}$/);
  });

  it('inserts api key honeypot and returns mapped object', async () => {
    queryMock.mockImplementation(async (_sql: string, params: unknown[]) => {
      return {
        rows: [
          honeypotRow({
            value: params[1],
            name: params[0],
            description: params[2],
            instance_id: params[3],
          }),
        ],
      };
    });
    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    const honeypot = await manager.deployApiKeyHoneypot('instance-1', 'openai');
    expect(honeypot.value).toMatch(/^sk-lab-[A-Za-z0-9]{48}$/);
    expect(honeypot.instanceId).toBe('instance-1');
  });
});

describe('HoneypotManager.deployFileHoneypots', () => {
  beforeEach(() => {
    queryMock.mockReset();
    mkdirSyncMock.mockReset();
    writeFileSyncMock.mockReset();
    queryMock.mockImplementation(async (_sql: string, params: unknown[]) => ({
      rows: [
        honeypotRow({
          id: `hp-${params[0]}`,
          type: 'file',
          name: params[0],
          value: params[1],
          description: params[2],
          instance_id: params[3],
        }),
      ],
    }));
  });

  it('creates files and DB rows', async () => {
    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    const honeypots = await manager.deployFileHoneypots('instance-1');

    expect(writeFileSyncMock).toHaveBeenCalledTimes(3);
    expect(mkdirSyncMock).toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(honeypots).toHaveLength(3);
    expect(honeypots.every((h) => h.type === 'file')).toBe(true);
  });
});

describe('HoneypotManager.checkApiKey', () => {
  beforeEach(() => {
    queryMock.mockReset();
    dispatchMock.mockReset();
    dispatchMock.mockResolvedValue(undefined);
  });

  it('triggers a registered honeypot', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [honeypotRow()] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'evt-1', created_at: new Date() }] });

    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    const matched = await manager.checkApiKey('sk-lab-test');

    expect(matched).toBe(true);
    expect(dispatchMock).toHaveBeenCalledOnce();
  });

  it('returns false for unknown key', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    const matched = await manager.checkApiKey('sk-unknown');
    expect(matched).toBe(false);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('does not dispatch twice when already triggered', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [honeypotRow({ triggered: true })] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    const matched = await manager.checkApiKey('sk-lab-test');
    expect(matched).toBe(true);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});

describe('HoneypotManager.generateDecoyValue', () => {
  const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });

  it('generates api_key values matching the spec templates', () => {
    for (let i = 0; i < 20; i += 1) {
      const value = manager.generateDecoyValue('api_key');
      expect(value).toMatch(/^(sk-carina-decoy-[a-z0-9]{8}|carina_live_[a-z0-9]{12})$/);
    }
  });

  it('generates password values matching the spec templates', () => {
    for (let i = 0; i < 20; i += 1) {
      const value = manager.generateDecoyValue('password');
      expect(value).toMatch(/^(Carina\$ecure!\d{4}!Decoy|D3c0y_[a-z0-9]{6}_P@ss)$/);
    }
  });

  it('generates token values matching the spec templates', () => {
    for (let i = 0; i < 20; i += 1) {
      const value = manager.generateDecoyValue('token');
      expect(value).toMatch(/^(eyJ\.\.\.[A-Za-z0-9]{16}\.\.\.decoy|tkn_decoy_[a-z0-9]{16})$/);
    }
  });

  it('generates endpoint values matching the spec templates', () => {
    for (let i = 0; i < 20; i += 1) {
      const value = manager.generateDecoyValue('endpoint');
      expect(value).toMatch(
        /^(https:\/\/decoy-[a-z0-9]{4}\.internal\.carinaai\.uk\/v1\/|https:\/\/api\.carinaai\.uk\/decoy\/[a-z0-9]{8}\/)$/,
      );
    }
  });

  it('generates database values matching the spec template', () => {
    for (let i = 0; i < 20; i += 1) {
      const value = manager.generateDecoyValue('database');
      expect(value).toMatch(/^postgres:\/\/decoy:decoy_[a-z0-9]{6}@[a-z0-9]{4}-db\.internal:5432\/decoy$/);
    }
  });
});

describe('HoneypotManager.deployDecoyHoneypot', () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockImplementation(async (_sql: string, params: unknown[]) => ({
      rows: [
        honeypotRow({
          id: `hp-${params[1]}`,
          type: params[0],
          name: params[1],
          value: params[2],
          description: params[3],
          instance_id: params[4],
        }),
      ],
    }));
  });

  it('inserts a decoy honeypot scoped to the instance (per-tenant uniqueness)', async () => {
    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    const a = await manager.deployDecoyHoneypot('tenant-a', 'api_key');
    const b = await manager.deployDecoyHoneypot('tenant-b', 'api_key');

    expect(a.instanceId).toBe('tenant-a');
    expect(b.instanceId).toBe('tenant-b');
    expect(a.value).not.toBe(b.value);
  });
});

describe('HoneypotManager.rotate', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('retires the active set and deploys a fresh set covering all five categories', async () => {
    queryMock.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('UPDATE honeypots')) {
        return { rowCount: 5, rows: [] };
      }
      return {
        rows: [
          honeypotRow({
            id: `hp-${params[1]}`,
            type: params[0],
            name: params[1],
            value: params[2],
            description: params[3],
            instance_id: params[4],
            retired_at: null,
          }),
        ],
      };
    });

    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    const fresh = await manager.rotate('instance-1');

    const retireCall = queryMock.mock.calls.find(([sql]: [string]) => sql.includes('UPDATE honeypots'));
    expect(retireCall).toBeDefined();
    expect(retireCall![1][1]).toEqual(['api_key', 'password', 'token', 'endpoint', 'database']);

    expect(fresh).toHaveLength(5);
    expect(fresh.map((h) => h.type).sort()).toEqual(
      ['api_key', 'database', 'endpoint', 'password', 'token'],
    );
  });
});

describe('HoneypotManager retired-honeypot delayed-leak monitoring', () => {
  beforeEach(() => {
    queryMock.mockReset();
    dispatchMock.mockReset();
    dispatchMock.mockResolvedValue(undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('checkApiKey still matches a key retired 23 hours ago', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [honeypotRow({ retired_at: new Date('2025-12-31T01:00:00Z') })],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'evt-1', created_at: new Date() }] });

    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    const matched = await manager.checkApiKey('sk-lab-test');

    expect(matched).toBe(true);
    const [sql, params] = queryMock.mock.calls[0]!;
    expect(sql).toContain("INTERVAL '24 hours'");
    expect(params).toEqual(['sk-lab-test']);
  });

  it('scanForLeak detects a value retired 23 hours ago but not 25 hours ago', async () => {
    queryMock.mockReset();
    queryMock
      .mockResolvedValueOnce({
        rows: [honeypotRow({ id: 'hp-recent', value: 'sk-carina-decoy-recent', retired_at: new Date('2025-12-31T01:00:00Z') })],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'evt-1', created_at: new Date() }] });

    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    const matches = await manager.scanForLeak('the key is sk-carina-decoy-recent', 'instance-1');

    expect(matches).toHaveLength(1);
    expect(matches[0]!.id).toBe('hp-recent');
  });

  it('scanForLeak SQL filter excludes honeypots retired more than 24 hours ago', async () => {
    queryMock.mockReset();
    queryMock.mockResolvedValueOnce({ rows: [] });

    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    await manager.scanForLeak('nothing sensitive here', 'instance-1');

    const [sql] = queryMock.mock.calls[0]!;
    expect(sql).toContain("retired_at > NOW() - INTERVAL '24 hours'");
  });
});

describe('HoneypotManager.getActiveSet', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('generates any missing categories so the active set always has all five', async () => {
    queryMock.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('SELECT * FROM honeypots')) {
        return {
          rows: [honeypotRow({ id: 'hp-existing', type: 'api_key', value: 'sk-carina-decoy-aaaaaaaa', retired_at: null })],
        };
      }
      return {
        rows: [
          honeypotRow({
            id: `hp-${params[1]}`,
            type: params[0],
            name: params[1],
            value: params[2],
            description: params[3],
            instance_id: params[4],
            retired_at: null,
          }),
        ],
      };
    });

    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    const active = await manager.getActiveSet('instance-1');

    expect(active.map((h) => h.type).sort()).toEqual(
      ['api_key', 'database', 'endpoint', 'password', 'token'],
    );
  });
});

describe('HoneypotManager.checkFilePath', () => {
  beforeEach(() => {
    queryMock.mockReset();
    dispatchMock.mockReset();
  });

  it('returns false for non-honeypot path', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const manager = new HoneypotManager(makePool(), { dispatch: dispatchMock });
    const matched = await manager.checkFilePath('/tmp/normal-file.txt');
    expect(matched).toBe(false);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
