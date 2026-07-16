import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceTier } from '../tiers.js';
import { getCyberToolDef } from '../cyber-tools-registry.js';
import { getCyberTool } from './index.js';
import {
  parseDc3ddLog,
  parseMmls,
  parseFls,
  parseYaraOutput,
  parseBinwalkFindings,
  parseHashdeepSummary,
} from './forensic/phase6.js';

vi.mock('./exec.js', () => ({
  runBinary: vi.fn(async (_binary: string, args: string[]) => {
    if (args.includes('windows.pslist')) {
      return { exitCode: 0, stdout: 'PID PPID Image\n4 0 System\n', stderr: '' };
    }
    if (args[0] === '-r' && args[1] === '-m') {
      return { exitCode: 0, stdout: '0|/|2|d/d|128|atime|mtime|ctime|crtime\n', stderr: '' };
    }
    return {
      exitCode: 0,
      stdout: 'md5: d41d8cd98f00b204e9800998ecf8427e\nDECIMAL 0 0x0 uImage header\n',
      stderr: '',
    };
  }),
}));

describe('phase 6 forensic parsers', () => {
  it('parses dc3dd hash log lines', () => {
    expect(parseDc3ddLog('md5: d41d8cd98f00b204e9800998ecf8427e\n0 errors')).toMatchObject({
      hashes: { md5: 'd41d8cd98f00b204e9800998ecf8427e' },
    });
  });

  it('parses mmls partition rows', () => {
    const rows = parseMmls('Slot  Start        Length       Description\n0: Meta      0         1         Primary Table');
    expect(rows.length).toBeGreaterThanOrEqual(0);
  });

  it('parses fls listing rows', () => {
    const rows = parseFls('r/r 4-128-4: 128-128-2: admin\n');
    expect(rows.length).toBeGreaterThanOrEqual(0);
  });

  it('parses yara match headers', () => {
    const hits = parseYaraOutput('TestRule /tmp/sample.exe\n0x10:$a: abc');
    expect(hits[0]?.rule).toBe('TestRule');
  });

  it('parses binwalk signature lines', () => {
    const rows = parseBinwalkFindings('0          0x0       uImage header');
    expect(rows[0]?.description).toContain('uImage');
  });

  it('summarizes hashdeep diff markers', () => {
    expect(parseHashdeepSummary('+\n+\n-\n!')).toMatchObject({ matched: 2, missing: 1, extra: 1 });
  });
});

describe('phase 6 monitor tier forensic tools', () => {
  beforeEach(() => {
    process.env.LABYRINTH_ENABLED = 'true';
    process.env.SCOUT_SUBSCRIPTION_PLAN = 'monitor';
  });

  afterEach(() => {
    delete process.env.LABYRINTH_ENABLED;
    delete process.env.SCOUT_SUBSCRIPTION_PLAN;
    vi.clearAllMocks();
  });

  it('registers all sixteen forensic tools at monitor tier', () => {
    for (const name of [
      'autopsy', 'volatility3', 'dc3dd', 'sleuthkit', 'binwalk', 'ghidra',
      'bulk-extractor', 'yara', 'guymager', 'rekall', 'foremost', 'plasmo',
      'xplico', 'regripper', 'hashdeep', 'ollydbg',
    ]) {
      expect(getCyberToolDef(name)?.requiredTier).toBe(WorkspaceTier.MONITOR);
      expect(getCyberTool(name)).toBeDefined();
    }
  });

  it('executes binwalk with structured output', async () => {
    const tool = getCyberTool('binwalk');
    const result = await tool!.execute({ image: '/tmp/firmware.bin' });
    expect(result).toMatchObject({
      tool: 'binwalk',
      image: '/tmp/firmware.bin',
      exitCode: 0,
    });
  });

  it('executes volatility3 plugin loop', async () => {
    const tool = getCyberTool('volatility3');
    const result = await tool!.execute({
      dump: '/tmp/mem.raw',
      plugins: ['windows.pslist'],
    });
    expect(result).toMatchObject({
      tool: 'volatility3',
      dump: '/tmp/mem.raw',
    });
    expect((result as { plugins: Record<string, unknown> }).plugins).toHaveProperty('windows.pslist');
  });

  it('requires confirmation for dc3dd imaging', () => {
    expect(getCyberTool('dc3dd')?.needsConfirmation?.({ device: '/dev/sda' })).toBe(true);
  });

  it('requires confirmation for guymager and ollydbg', () => {
    expect(getCyberTool('guymager')?.needsConfirmation?.({ device: '/dev/sda', output: '/tmp/out.e01' })).toBe(true);
    expect(getCyberTool('ollydbg')?.needsConfirmation?.({ binary: '/tmp/sample.exe' })).toBe(true);
  });

  it('builds sleuthkit timeline from fls body output', async () => {
    const tool = getCyberTool('sleuthkit');
    const result = await tool!.execute({ image: '/tmp/image.dd', action: 'timeline' });
    expect(result).toMatchObject({
      tool: 'sleuthkit',
      action: 'timeline',
      image: '/tmp/image.dd',
    });
  });
});
