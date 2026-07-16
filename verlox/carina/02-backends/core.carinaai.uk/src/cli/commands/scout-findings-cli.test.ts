import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const tmpHome = path.join(os.tmpdir(), `carina-scout-cli-test-${process.pid}`);
const fetchMock = vi.fn();

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  const fsp = await import('fs/promises');
  await fsp.rm(tmpHome, { recursive: true, force: true });
});

const sampleFinding = {
  id: 'finding-abc',
  scanRunId: null,
  targetId: 'target-1',
  accountId: 'acct-1',
  tool: 'nuclei',
  findingType: 'cve',
  severity: 'critical',
  cvssScore: 9.1,
  title: 'Critical CVE',
  description: 'RCE',
  remediation: 'Patch',
  rawData: {},
  status: 'open',
  isNew: true,
  firstSeen: '2026-06-19T00:00:00.000Z',
  lastSeen: '2026-06-19T00:00:00.000Z',
  createdAt: '2026-06-19T00:00:00.000Z',
};

function mockFetchRouter() {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes('/api/findings/finding-abc') && init?.method === 'PATCH') {
      return {
        ok: true,
        json: async () => ({ ...sampleFinding, status: 'investigating' }),
      };
    }
    if (url.includes('/api/findings/finding-abc/investigate') && init?.method === 'POST') {
      return {
        ok: true,
        json: async () => ({ investigation: { findingId: 'finding-abc', status: 'opened' } }),
      };
    }
    if (url.includes('/api/findings/finding-abc')) {
      return { ok: true, json: async () => sampleFinding };
    }
    if (url.includes('/api/findings')) {
      return { ok: true, json: async () => ({ findings: [sampleFinding] }) };
    }
    if (url.includes('/api/score')) {
      return {
        ok: true,
        json: async () => ({
          score: 72,
          openCritical: 1,
          openHigh: 0,
          openMedium: 0,
          openLow: 0,
          calculatedAt: '2026-06-19T00:00:00.000Z',
        }),
      };
    }
    return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({ error: 'not found' }) };
  });
  vi.stubGlobal('fetch', fetchMock);
}

describe('scout findings cli', () => {
  it('pull requires API key', async () => {
    vi.stubEnv('LABYRINTH_API_KEY', '');
    const { runScoutPullCommand } = await import('./scout-findings-cli.js');
    await expect(runScoutPullCommand([])).rejects.toThrow('LABYRINTH_API_KEY');
  });

  it('pull fetches findings and score', async () => {
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('LABYRINTH_API_KEY', 'lsk_test');
    vi.stubEnv('SCOUT_BASE_URL', 'http://localhost:4444');
    mockFetchRouter();

    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });

    const { runScoutPullCommand } = await import('./scout-findings-cli.js');
    await runScoutPullCommand([]);

    expect(logs.some((line) => line.includes('Scout findings pull'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/findings'))).toBe(true);
    spy.mockRestore();
  });

  it('investigate opens a local case and marks finding investigating', async () => {
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('LABYRINTH_API_KEY', 'lsk_test');
    vi.stubEnv('SCOUT_BASE_URL', 'http://localhost:4444');
    mockFetchRouter();

    const { runScoutInvestigateCommand } = await import('./scout-findings-cli.js');
    await runScoutInvestigateCommand(['finding-abc', '--json']);

    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(patchCall).toBeTruthy();

    const fsp = await import('fs/promises');
    const dir = path.join(tmpHome, 'data', 'scout-investigations');
    const files = await fsp.readdir(dir);
    expect(files.length).toBe(1);
  });

  it('connect writes scout env vars', async () => {
    vi.stubEnv('CARINA_HOME', tmpHome);
    const { runScoutConnectCommand } = await import('./scout-findings-cli.js');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        score: 90,
        openCritical: 0,
        openHigh: 0,
        openMedium: 0,
        openLow: 0,
        calculatedAt: '2026-06-19T00:00:00.000Z',
      }),
    });

    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });

    await runScoutConnectCommand(['--api-key', 'lsk_test', '--url', 'http://localhost:4444']);

    const fsp = await import('fs/promises');
    const env = await fsp.readFile(path.join(tmpHome, '.env'), 'utf-8');
    expect(env).toContain('LABYRINTH_API_KEY=lsk_test');
    expect(env).toContain('LABYRINTH_ENABLED=true');
    expect(logs.some((line) => line.includes('Scout connected'))).toBe(true);
    spy.mockRestore();
  });
});
