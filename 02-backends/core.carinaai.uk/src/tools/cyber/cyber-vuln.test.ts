import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceTier } from '../tiers.js';
import { getCyberToolDef, getLegacyCyberToolDef } from '../cyber-tools-registry.js';
import { getCyberTool } from './index.js';
import {
  parseNucleiFindings,
  parseNiktoJson,
  parseSqlmapSummary,
  NUCLEI_TEMPLATE_FLAGS,
} from './vuln/phase2.js';
import { parseSeverityList, normalizeScanUrl } from './sanitize.js';

vi.mock('./exec.js', () => ({
  runBinary: vi.fn(async () => ({
    exitCode: 0,
    stdout: '{"template-id":"test","info":{"name":"Test","severity":"high"}}\n',
    stderr: '',
  })),
}));

describe('phase 2 vuln parsers', () => {
  it('parses nuclei jsonl findings', () => {
    const findings = parseNucleiFindings('{"template-id":"a"}\n\n{"template-id":"b"}\n');
    expect(findings).toHaveLength(2);
  });

  it('parses nikto json output', () => {
    const parsed = parseNiktoJson('{"host":"example.com","vulnerabilities":[]}');
    expect(parsed).toMatchObject({ host: 'example.com' });
  });

  it('detects sqlmap injection summary', () => {
    const parsed = parseSqlmapSummary('sqlmap identified the following injection point', '');
    expect(parsed.vulnerable).toBe(true);
  });

  it('defines nuclei template categories from spec', () => {
    expect(Object.keys(NUCLEI_TEMPLATE_FLAGS).sort()).toEqual(
      ['all', 'cve', 'dast', 'default-logins', 'exposures', 'misconfig', 'secrets', 'tech'].sort(),
    );
  });

  it('normalizes scan URLs', () => {
    expect(normalizeScanUrl('example.com')).toBe('https://example.com');
    expect(parseSeverityList('critical,high')).toBe('critical,high');
  });
});

describe('phase 2 cloud registry', () => {
  beforeEach(() => {
    process.env.CARINA_CLOUD = 'true';
    process.env.CARINA_ENABLE_LEGACY_CYBER_TOOLS = 'true';
  });

  afterEach(() => {
    delete process.env.CARINA_CLOUD;
    delete process.env.CARINA_ENABLE_LEGACY_CYBER_TOOLS;
    vi.clearAllMocks();
  });

  it('registers all seven vuln tools at cloud tier', () => {
    for (const name of ['nuclei', 'nikto', 'sqlmap', 'wpscan', 'whatweb', 'yersinia', 'legion']) {
      expect((getLegacyCyberToolDef(name) ?? getCyberToolDef(name))?.requiredTier).toBe(WorkspaceTier.CLOUD);
      expect(getCyberTool(name)).toBeDefined();
    }
  });

  it('returns structured nuclei output', async () => {
    const tool = getCyberTool('nuclei');
    const result = await tool!.execute({ target: 'https://example.com', templates: 'cve' });
    expect(result).toMatchObject({
      tool: 'nuclei',
      target: 'https://example.com',
      templates: 'cve',
      exitCode: 0,
    });
    expect((result as { findingCount: number }).findingCount).toBeGreaterThan(0);
  });

  it('blocks sqlmap without url', async () => {
    const { runBinary } = await import('./exec.js');
    const tool = getCyberTool('sqlmap');
    const result = await tool!.execute({});
    expect(result).toEqual({ error: 'url is required' });
    expect(runBinary).not.toHaveBeenCalled();
  });

  it('requires confirmation for yersinia attack mode', () => {
    const tool = getCyberTool('yersinia');
    expect(tool?.needsConfirmation?.({ mode: 'attack', interface: 'eth0' })).toBe(true);
    expect(tool?.needsConfirmation?.({ mode: 'discover', interface: 'eth0' })).toBe(false);
  });
});
