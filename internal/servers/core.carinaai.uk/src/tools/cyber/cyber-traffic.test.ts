import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceTier } from '../tiers.js';
import { getCyberToolDef } from '../cyber-tools-registry.js';
import { getCyberTool } from './index.js';
import {
  parseTsharkJson,
  parseResponderLog,
  parseDsniffCredentials,
} from './traffic/phase7.js';

vi.mock('./exec.js', () => ({
  runBinary: vi.fn(async () => ({
    exitCode: 0,
    stdout: '[{"_source":{"layers":{"frame":{"frame.protocols":"eth:ethertype:ip:tcp"}}}}}]',
    stderr: 'Protocol Hierarchy Statistics\n',
  })),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => '[NTLMv2-SSP] admin :: 0101000000000000ABCDEF\n'),
}));

describe('phase 7 traffic parsers', () => {
  it('parses tshark json output', () => {
    const parsed = parseTsharkJson('[{"_source":{}}]');
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('parses responder ntlm log lines', () => {
    const rows = parseResponderLog('[NTLMv2-SSP] admin :: 0101000000000000ABCDEF\n');
    expect(rows[0]).toMatchObject({ user: 'admin', hash: '0101000000000000ABCDEF' });
  });

  it('parses dsniff credential lines', () => {
    const creds = parseDsniffCredentials('ftp: alice secret123\n');
    expect(creds[0]).toMatchObject({ protocol: 'ftp', user: 'alice', password: 'secret123' });
  });
});

describe('phase 7 monitor tier traffic tools', () => {
  beforeEach(() => {
    process.env.LABYRINTH_ENABLED = 'true';
    process.env.SCOUT_SUBSCRIPTION_PLAN = 'monitor';
  });

  afterEach(() => {
    delete process.env.LABYRINTH_ENABLED;
    delete process.env.SCOUT_SUBSCRIPTION_PLAN;
    vi.clearAllMocks();
  });

  it('registers all five traffic tools at monitor tier', () => {
    for (const name of ['tshark', 'tcpdump', 'dsniff', 'responder', 'scapy']) {
      expect(getCyberToolDef(name)?.requiredTier).toBe(WorkspaceTier.MONITOR);
      expect(getCyberTool(name)).toBeDefined();
    }
  });

  it('executes tshark pcap analysis', async () => {
    const tool = getCyberTool('tshark');
    const result = await tool!.execute({ pcap: '/tmp/sample.pcap', filter: 'http' });
    expect(result).toMatchObject({
      tool: 'tshark',
      pcap: '/tmp/sample.pcap',
      filter: 'http',
      exitCode: 0,
    });
  });

  it('requires confirmation for live capture and credential tools', () => {
    expect(getCyberTool('tcpdump')?.needsConfirmation?.({ interface: 'eth0' })).toBe(true);
    expect(getCyberTool('dsniff')?.needsConfirmation?.({ interface: 'eth0' })).toBe(true);
    expect(getCyberTool('scapy')?.needsConfirmation?.({ script: '/tmp/craft.py' })).toBe(true);
  });

  it('requires confirmation for responder poison but not analyze mode', () => {
    const tool = getCyberTool('responder');
    expect(tool?.needsConfirmation?.({ interface: 'eth0' })).toBe(true);
    expect(tool?.needsConfirmation?.({ interface: 'eth0', analyze: true })).toBe(false);
  });

  it('loads responder hashes from session log', async () => {
    const tool = getCyberTool('responder');
    const result = await tool!.execute({ interface: 'eth0', analyze: true });
    expect(result).toMatchObject({
      tool: 'responder',
      interface: 'eth0',
      analyze: true,
    });
    expect((result as { hashes: unknown[] }).hashes.length).toBeGreaterThan(0);
  });
});
