import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceTier } from '../tiers.js';
import { getCyberToolDef, getLegacyCyberToolDef } from '../cyber-tools-registry.js';
import { getCyberTool } from './index.js';
import {
  buildR2CommandSet,
  parseR2Output,
  resolveReverseEngine,
} from './reverse/phase9.js';

vi.mock('./exec.js', () => ({
  runBinary: vi.fn(async () => ({
    exitCode: 0,
    stdout: '0x00401234 42 42 sym.main\n string hello\n export main\n',
    stderr: '',
  })),
}));

describe('phase 9 reverse parsers', () => {
  it('builds default radare2 command set', () => {
    expect(buildR2CommandSet({ analyze: true })).toEqual(['aaa', 'afl', 'izz', 'iE']);
  });

  it('builds strings-only command set', () => {
    expect(buildR2CommandSet({ strings: true })).toEqual(['izz']);
  });

  it('parses radare2 output sections', () => {
    const parsed = parseR2Output('0x00401234 42 42 sym.main\n string hello\n export main');
    expect(parsed.functions.length + parsed.exports.length).toBeGreaterThan(0);
  });

  it('resolves reverse engine aliases', () => {
    expect(resolveReverseEngine('r2')).toBe('radare2');
    expect(resolveReverseEngine('cutter')).toBe('cutter');
  });
});

describe('phase 9 monitor tier reverse tools', () => {
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

  it('registers all three reverse tools at monitor tier', () => {
    for (const name of ['radare2', 'cutter', 'vscodium']) {
      expect((getLegacyCyberToolDef(name) ?? getCyberToolDef(name))?.requiredTier).toBe(WorkspaceTier.MONITOR);
      expect(getCyberTool(name)).toBeDefined();
    }
  });

  it('executes radare2 analyze with structured output', async () => {
    const tool = getCyberTool('radare2');
    const result = await tool!.execute({ binary: '/tmp/sample.bin', analyze: true });
    expect(result).toMatchObject({
      tool: 'radare2',
      binary: '/tmp/sample.bin',
      exitCode: 0,
    });
  });

  it('executes cutter headless analyze', async () => {
    const tool = getCyberTool('cutter');
    const result = await tool!.execute({ binary: '/tmp/sample.bin', export: 'decompile' });
    expect(result).toMatchObject({
      tool: 'cutter',
      binary: '/tmp/sample.bin',
      export: 'decompile',
      exitCode: 0,
    });
  });

  it('opens files with vscodium', async () => {
    const tool = getCyberTool('vscodium');
    const result = await tool!.execute({ file: '/tmp/script.py', wait: true });
    expect(result).toMatchObject({
      tool: 'vscodium',
      file: '/tmp/script.py',
      exitCode: 0,
    });
  });
});
