import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceTier } from '../tiers.js';
import { getCyberToolDef, getLegacyCyberToolDef } from '../cyber-tools-registry.js';
import { getCyberTool } from './index.js';
import {
  mapAnonsurfAction,
  parseAnonsurfStatus,
  parseMat2Output,
} from './privacy/phase8.js';

vi.mock('./exec.js', () => ({
  runBinary: vi.fn(async (binary: string, args: string[]) => {
    if (binary === 'parted') {
      return { exitCode: 0, stdout: 'parted ok', stderr: '' };
    }
    if (binary === 'anonsurf' && args[0] === 'status') {
      return { exitCode: 0, stdout: 'Tor is active\n', stderr: '' };
    }
    return { exitCode: 0, stdout: 'ok\n', stderr: '' };
  }),
}));

describe('phase 8 privacy parsers', () => {
  it('maps anonsurf CLI aliases', () => {
    expect(mapAnonsurfAction('on')).toBe('start');
    expect(mapAnonsurfAction('off')).toBe('stop');
  });

  it('parses anonsurf active status', () => {
    expect(parseAnonsurfStatus('Tor is active')).toMatchObject({ torActive: true });
  });

  it('parses mat2 cleaned file lines', () => {
    const parsed = parseMat2Output('Cleaned /tmp/photo.jpg\n');
    expect(parsed.cleaned).toBe(1);
  });
});

describe('phase 8 monitor tier privacy tools', () => {
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

  it('registers all five privacy tools at monitor tier', () => {
    for (const name of ['anonsurf', 'tor', 'mat2', 'bleachbit', 'gparted']) {
      expect(getCyberToolDef(name)?.requiredTier).toBe(WorkspaceTier.MONITOR);
      expect(getCyberTool(name)).toBeDefined();
    }
  });

  it('executes anonsurf status', async () => {
    const tool = getCyberTool('anonsurf');
    const result = await tool!.execute({ action: 'status' });
    expect(result).toMatchObject({
      tool: 'anonsurf',
      action: 'status',
      exitCode: 0,
    });
  });

  it('requires confirmation for anonsurf start and gparted disk setup', () => {
    expect(getCyberTool('anonsurf')?.needsConfirmation?.({ action: 'on' })).toBe(true);
    expect(getCyberTool('anonsurf')?.needsConfirmation?.({ action: 'status' })).toBe(false);
    expect(getCyberTool('gparted')?.needsConfirmation?.({ device: '/dev/sdb' })).toBe(true);
  });

  it('requires confirmation for tor proxy and bleachbit clean', () => {
    expect(getCyberTool('tor')?.needsConfirmation?.({ action: 'proxy', command: 'curl example.com' })).toBe(true);
    expect(getCyberTool('tor')?.needsConfirmation?.({ action: 'status' })).toBe(false);
    expect(getCyberTool('bleachbit')?.needsConfirmation?.({})).toBe(true);
  });

  it('partitions disk via gparted setup action', async () => {
    const tool = getCyberTool('gparted');
    const result = await tool!.execute({ device: '/dev/sdb', action: 'setup', table: 'gpt' });
    expect(result).toMatchObject({
      tool: 'gparted',
      device: '/dev/sdb',
      table: 'gpt',
      action: 'setup',
    });
  });
});
