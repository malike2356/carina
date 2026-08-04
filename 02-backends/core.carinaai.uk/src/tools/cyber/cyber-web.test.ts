import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceTier } from '../tiers.js';
import { getCyberToolDef, getLegacyCyberToolDef } from '../cyber-tools-registry.js';
import { getCyberTool } from './index.js';
import {
  parseFfufJson,
  parseGobusterOutput,
  parseFeroxbusterLines,
  parseSstimapOutput,
  buildFfufUrl,
} from './web/phase4.js';

vi.mock('./exec.js', () => ({
  runBinary: vi.fn(async () => ({
    exitCode: 0,
    stdout: '{"results":[{"url":"https://example.com/admin","status":200}]}\n',
    stderr: '',
  })),
}));

describe('phase 4 web parsers', () => {
  it('parses ffuf json output', () => {
    const parsed = parseFfufJson('{"results":[{"status":200,"input":{"FUZZ":"admin"}}]}');
    expect(parsed).toMatchObject({ results: [{ status: 200 }] });
  });

  it('parses gobuster lines', () => {
    expect(parseGobusterOutput('/admin (Status: 200)\n/backup (Status: 403)')).toEqual(
      expect.arrayContaining(['admin', 'backup']),
    );
  });

  it('parses feroxbuster json lines', () => {
    const rows = parseFeroxbusterLines('{"url":"https://example.com/admin","status":200}\n');
    expect(rows).toHaveLength(1);
  });

  it('detects sstimap vulnerability text', () => {
    expect(parseSstimapOutput('Engine: jinja2\nTarget is vulnerable to SSTI')).toMatchObject({
      engine: 'jinja2',
      vulnerable: true,
    });
  });

  it('builds ffuf fuzz URLs by mode', () => {
    expect(buildFfufUrl({ mode: 'dir' }, 'https://example.com')).toBe('https://example.com/FUZZ');
    expect(buildFfufUrl({ mode: 'param' }, 'https://example.com/api')).toBe('https://example.com/api?FUZZ=test');
    expect(buildFfufUrl({ mode: 'vhost' }, 'example.com')).toBe('http://FUZZ.example.com');
  });
});

describe('phase 4 monitor tier web tools', () => {
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

  it('registers all seven web tools at monitor tier', () => {
    for (const name of [
      'burpsuite', 'ffuf', 'dirsearch', 'feroxbuster', 'gobuster', 'arjun', 'sstimap',
    ]) {
      expect((getLegacyCyberToolDef(name) ?? getCyberToolDef(name))?.requiredTier).toBe(WorkspaceTier.MONITOR);
      expect(getCyberTool(name)).toBeDefined();
    }
  });

  it('executes ffuf with structured output', async () => {
    const tool = getCyberTool('ffuf');
    const result = await tool!.execute({ url: 'https://example.com', mode: 'dir' });
    expect(result).toMatchObject({
      tool: 'ffuf',
      url: 'https://example.com',
      mode: 'dir',
      exitCode: 0,
    });
  });

  it('requires confirmation for sstimap os shell', () => {
    const tool = getCyberTool('sstimap');
    expect(tool?.needsConfirmation?.({ url: 'https://example.com', osShell: true })).toBe(true);
    expect(tool?.needsConfirmation?.({ url: 'https://example.com' })).toBe(false);
  });

  it('requires confirmation for burp active scan', () => {
    const tool = getCyberTool('burpsuite');
    expect(tool?.needsConfirmation?.({ action: 'scan', mode: 'active', url: 'https://example.com' })).toBe(true);
    expect(tool?.needsConfirmation?.({ action: 'scan', mode: 'passive', url: 'https://example.com' })).toBe(false);
  });
});
