import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceTier } from '../tiers.js';
import { getCyberToolDef, getLegacyCyberToolDef } from '../cyber-tools-registry.js';
import { getCyberTool } from './index.js';
import { parseSnortAlerts } from './blue/phase10.js';

vi.mock('./exec.js', () => ({
  runBinary: vi.fn(async (_binary: string, args: string[]) => {
    if (args.includes('-T')) {
      return { exitCode: 0, stdout: 'Snort configuration validation successful\n', stderr: '' };
    }
    return { exitCode: 0, stdout: 'Snort monitoring started\n', stderr: '' };
  }),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => '[Priority: 1] TCP 10.0.0.5:443 -> 10.0.0.10:50123 (sid:1; rev:1;)\n'),
}));

describe('phase 10 blue parsers', () => {
  it('parses snort fast alert lines', () => {
    const alerts = parseSnortAlerts('[Priority: 1] TCP 10.0.0.5:443 -> 10.0.0.10:50123 (sid:1;)');
    expect(alerts[0]).toMatchObject({
      priority: 1,
      protocol: 'TCP',
      src: '10.0.0.5:443',
      dst: '10.0.0.10:50123',
    });
  });
});

describe('phase 10 monitor tier blue tools', () => {
  beforeEach(() => {
    process.env.LABYRINTH_ENABLED = 'true';
    process.env.CARINA_ENABLE_LEGACY_CYBER_TOOLS = 'true';
    process.env.SCOUT_SUBSCRIPTION_PLAN = 'monitor';
  });

  afterEach(() => {
    delete process.env.LABYRINTH_ENABLED;
    delete process.env.CARINA_ENABLE_LEGACY_CYBER_TOOLS;
    delete process.env.SCOUT_SUBSCRIPTION_PLAN;
    vi.clearAllMocks();
  });

  it('registers snort and bloodhound at monitor tier', () => {
    for (const name of ['snort', 'bloodhound']) {
      expect(getCyberToolDef(name)?.requiredTier).toBe(WorkspaceTier.MONITOR);
      expect(getCyberTool(name)).toBeDefined();
    }
  });

  it('validates snort config via test action', async () => {
    const tool = getCyberTool('snort');
    const result = await tool!.execute({ action: 'test' });
    expect(result).toMatchObject({
      tool: 'snort',
      action: 'test',
      configValid: true,
      exitCode: 0,
    });
  });

  it('parses snort alerts from log file', async () => {
    const tool = getCyberTool('snort');
    const result = await tool!.execute({ action: 'alerts', alertFile: '/var/log/snort/alert' });
    expect(result).toMatchObject({
      tool: 'snort',
      action: 'alerts',
      alertCount: 1,
    });
  });

  it('requires confirmation for snort monitor and bloodhound collection', () => {
    expect(getCyberTool('snort')?.needsConfirmation?.({ action: 'monitor', interface: 'eth0' })).toBe(true);
    expect(getCyberTool('snort')?.needsConfirmation?.({ action: 'test' })).toBe(false);
    expect(getCyberTool('bloodhound')?.needsConfirmation?.({
      domain: 'corp.local',
      username: 'audit',
      outputDir: '/tmp/bh',
    })).toBe(true);
  });

  it('executes bloodhound collection args', async () => {
    const tool = getCyberTool('bloodhound');
    const result = await tool!.execute({
      domain: 'corp.local',
      username: 'audit',
      password: 'secret',
      outputDir: '/tmp/bh-out',
      collection: 'Default,Session',
    });
    expect(result).toMatchObject({
      tool: 'bloodhound',
      domain: 'corp.local',
      exitCode: 0,
    });
  });
});
