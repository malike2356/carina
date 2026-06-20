import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceTier } from '../tiers.js';
import { getCyberToolDef } from '../cyber-tools-registry.js';
import { getCyberTool } from './index.js';

vi.mock('./exec.js', () => ({
  runBinary: vi.fn(async () => ({
    exitCode: 0,
    stdout: `<?xml version="1.0"?><nmaprun><host><status state="up"/><address addr="127.0.0.1"/><ports><port protocol="tcp" portid="80"><state state="open"/><service name="http"/></port></ports></host><runstats><hosts up="1" down="0" total="1"/></runstats></nmaprun>`,
    stderr: '',
  })),
}));

describe('getCyberTool nmap', () => {
  beforeEach(() => {
    process.env.CARINA_TIER = WorkspaceTier.SELF_HOSTED;
  });

  afterEach(() => {
    delete process.env.CARINA_TIER;
    vi.clearAllMocks();
  });

  it('registers enhanced nmap with scanType parameter', () => {
    const def = getCyberToolDef('nmap');
    expect(def?.binary).toBe('nmap');
    const tool = getCyberTool('nmap');
    expect(tool?.parameters.properties).toHaveProperty('scanType');
  });

  it('returns structured scan output', async () => {
    const tool = getCyberTool('nmap');
    const result = await tool!.execute({ target: '127.0.0.1', scanType: 'quick' });
    expect(result).toMatchObject({
      tool: 'nmap',
      target: '127.0.0.1',
      scanType: 'quick',
      exitCode: 0,
    });
    expect((result as { ports: unknown[] }).ports.length).toBeGreaterThan(0);
  });

  it('rejects invalid targets without executing', async () => {
    const { runBinary } = await import('./exec.js');
    const tool = getCyberTool('nmap');
    const result = await tool!.execute({ target: 'bad;cmd' });
    expect(result).toEqual({ error: expect.any(String) });
    expect(runBinary).not.toHaveBeenCalled();
  });
});

describe('phase 1 registry', () => {
  it('includes all ten recon tools', () => {
    for (const name of [
      'nmap', 'amass', 'theHarvester', 'recon-ng', 'spiderfoot',
      'sherlock', 'maltego', 'dmitry', 'metagoofil', 'cewl',
    ]) {
      expect(getCyberToolDef(name)?.requiredTier).toBe(WorkspaceTier.SELF_HOSTED);
      expect(getCyberTool(name)).toBeDefined();
    }
  });
});
