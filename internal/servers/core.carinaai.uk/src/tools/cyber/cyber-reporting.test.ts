import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceTier } from '../tiers.js';
import { getCyberToolDef } from '../cyber-tools-registry.js';
import { getCyberTool, createCyberTools } from './index.js';
import { normalizeFindings, parseRecipeOps, resolveTimelineEngine } from './reporting/phase11.js';

vi.mock('./exec.js', () => ({
  runBinary: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => JSON.stringify([{ name: 'test-ioc', pattern: "[ipv4-addr:value = '1.2.3.4']" }])),
  writeFile: vi.fn(async () => undefined),
  unlink: vi.fn(async () => undefined),
}));

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (String(url).includes('/bake')) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ value: 'decoded-output' }),
    };
  }
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ objects: [{ message: 'event' }], query: init?.body }),
  };
});

vi.stubGlobal('fetch', fetchMock);

describe('phase 11 reporting helpers', () => {
  it('resolves timeline engine aliases', () => {
    expect(resolveTimelineEngine('psteal')).toBe('plasmo');
    expect(resolveTimelineEngine('log2timeline')).toBe('log2timeline');
  });

  it('validates cyberchef recipe operations', () => {
    expect(parseRecipeOps('From Base64,Decode text')).toEqual(['From Base64', 'Decode text']);
  });

  it('normalizes stix findings arrays', () => {
    expect(normalizeFindings([{ name: 'ioc', pattern: 'x' }])).toHaveLength(1);
  });
});

describe('phase 11 monitor tier reporting tools', () => {
  beforeEach(() => {
    process.env.LABYRINTH_ENABLED = 'true';
    process.env.SCOUT_SUBSCRIPTION_PLAN = 'monitor';
  });

  afterEach(() => {
    delete process.env.LABYRINTH_ENABLED;
    delete process.env.SCOUT_SUBSCRIPTION_PLAN;
    vi.clearAllMocks();
  });

  it('registers all four reporting tools at monitor tier', () => {
    for (const name of ['log2timeline', 'timesketch', 'stix', 'cyberchef']) {
      expect(getCyberToolDef(name)?.requiredTier).toBe(WorkspaceTier.MONITOR);
      expect(getCyberTool(name)).toBeDefined();
    }
  });

  it('wires all 72 enhanced cyber tools', () => {
    const tools = createCyberTools();
    expect(tools.length).toBeGreaterThanOrEqual(72);
  });

  it('executes log2timeline with plaso output path', async () => {
    const tool = getCyberTool('log2timeline');
    const result = await tool!.execute({
      image: '/tmp/evidence.dd',
      outputFile: '/tmp/timeline.plaso',
    });
    expect(result).toMatchObject({
      tool: 'log2timeline',
      plasoFile: '/tmp/timeline.plaso',
      exitCode: 0,
    });
  });

  it('queries timesketch explore API', async () => {
    const tool = getCyberTool('timesketch');
    const result = await tool!.execute({ query: 'message:*', limit: 10 });
    expect(result).toMatchObject({
      tool: 'timesketch',
      action: 'search',
      query: 'message:*',
    });
  });

  it('exports stix bundle from findings file', async () => {
    const tool = getCyberTool('stix');
    const result = await tool!.execute({
      findingsFile: '/tmp/findings.json',
      outputFile: '/tmp/bundle.json',
      tlp: 'amber',
    });
    expect(result).toMatchObject({
      tool: 'stix',
      outputFile: '/tmp/bundle.json',
      findingsCount: 1,
    });
  });

  it('transforms data via cyberchef API', async () => {
    const tool = getCyberTool('cyberchef');
    const result = await tool!.execute({
      input: 'SGVsbG8=',
      recipe: 'From Base64,Decode text',
    });
    expect(result).toMatchObject({
      tool: 'cyberchef',
      output: 'decoded-output',
    });
  });
});
