import type { CyberToolDef } from '../../cyber-tools-registry.js';
import { createReconTool } from '../factory.js';
import {
  sanitizeTarget,
  tokenizeOptions,
} from '../sanitize.js';

export const SCAN_TYPE_FLAGS: Record<string, string[]> = {
  quick: ['-T4', '-F', '-Pn'],
  full: ['-T4', '-p-', '-Pn'],
  stealth: ['-sS', '-T2', '-f', '--data-length', '24', '-Pn'],
  service: ['-sV', '--version-intensity', '5', '-Pn'],
  os: ['-O', '--osscan-guess', '-Pn'],
  vuln: ['--script', 'vuln', '-Pn', '--script-timeout', '30s'],
};

export interface NmapPort {
  port: number;
  protocol: string;
  state: string;
  service: string;
  version: string;
  host?: string;
}

export interface NmapOsMatch {
  name: string;
  accuracy: number;
}

export interface NmapScanResult {
  tool: 'nmap';
  target: string;
  scanType: string;
  duration: number;
  exitCode: number;
  hosts: { total: number; up: number; down: number };
  ports: NmapPort[];
  osMatches: NmapOsMatch[];
  rawXml?: string;
}

export function parseNmapXml(xml: string): Omit<NmapScanResult, 'tool' | 'target' | 'scanType' | 'duration' | 'exitCode'> {
  const ports: NmapPort[] = [];
  const osMatches: NmapOsMatch[] = [];

  const hostBlocks = xml.match(/<host[\s\S]*?<\/host>/g) ?? [];
  for (const block of hostBlocks) {
    const hostAddr = block.match(/<address\s+addr="([^"]+)"/)?.[1];
    const portBlocks = block.match(/<port[\s\S]*?<\/port>/g) ?? [];
    for (const portBlock of portBlocks) {
      const portId = Number(portBlock.match(/portid="(\d+)"/)?.[1] ?? 0);
      const protocol = portBlock.match(/protocol="([^"]+)"/)?.[1] ?? 'tcp';
      const state = portBlock.match(/<state\s+state="([^"]+)"/)?.[1] ?? 'unknown';
      const service = portBlock.match(/<service\s[^>]*name="([^"]*)"/)?.[1] ?? '';
      const product = portBlock.match(/product="([^"]*)"/)?.[1] ?? '';
      const version = portBlock.match(/version="([^"]*)"/)?.[1] ?? '';
      const versionText = [product, version].filter(Boolean).join(' ').trim();
      ports.push({
        port: portId,
        protocol,
        state,
        service,
        version: versionText,
        host: hostAddr,
      });
    }

    const osBlock = block.match(/<osmatch\s+name="([^"]+)"\s+accuracy="(\d+)"/g) ?? [];
    for (const match of osBlock) {
      const name = match.match(/name="([^"]+)"/)?.[1] ?? '';
      const accuracy = Number(match.match(/accuracy="(\d+)"/)?.[1] ?? 0);
      if (name) osMatches.push({ name, accuracy });
    }
  }

  const up = Number(xml.match(/<hosts[^>]*\s+up="(\d+)"/)?.[1] ?? hostBlocks.length);
  const down = Number(xml.match(/<hosts[^>]*\s+down="(\d+)"/)?.[1] ?? 0);
  const total = Number(xml.match(/<hosts[^>]*\s+total="(\d+)"/)?.[1] ?? up + down);

  return {
    hosts: { total, up, down },
    ports: ports.filter((p) => p.port > 0),
    osMatches,
  };
}

function buildNmapArgs(params: Record<string, unknown>): string[] | { error: string } {
  const target = sanitizeTarget(params.target);
  if (typeof target !== 'string') return target;

  const scanType = String(params.scanType ?? 'quick');
  const flags = SCAN_TYPE_FLAGS[scanType] ?? SCAN_TYPE_FLAGS.quick;
  const extra = tokenizeOptions(params.options);
  if ('error' in extra) return extra;

  return [...flags, ...extra, '-oX', '-', target];
}

function stealthRetryArgs(params: Record<string, unknown>, first: { stderr: string; exitCode: number }): string[] | null {
  if (params.scanType !== 'stealth' || first.exitCode === 0) return null;
  const msg = `${first.stderr}`.toLowerCase();
  if (!msg.includes('root') && !msg.includes('permission') && !msg.includes('syn')) return null;

  const target = sanitizeTarget(params.target);
  if (typeof target !== 'string') return null;
  const extra = tokenizeOptions(params.options);
  if ('error' in extra) return null;

  return ['-sT', '-T2', '-f', '--data-length', '24', '-Pn', ...extra, '-oX', '-', target];
}

export function createNmapTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'IP, hostname, or CIDR range' },
        scanType: {
          type: 'string',
          enum: ['quick', 'full', 'stealth', 'service', 'os', 'vuln'],
          description: 'Scan profile',
        },
        options: { type: 'string', description: 'Additional nmap flags' },
        timeout: { type: 'number', description: 'Max scan seconds (default 300)' },
      },
      required: ['target'],
    },
    buildArgs: (params) => buildNmapArgs(params),
    retryArgs: stealthRetryArgs,
    formatResult: (result, params, startedAt) => {
      const target = String(params.target ?? '');
      const scanType = String(params.scanType ?? 'quick');
      const duration = (Date.now() - startedAt) / 1000;
      const parsed = parseNmapXml(result.stdout);
      return {
        tool: 'nmap',
        target,
        scanType,
        duration,
        exitCode: result.exitCode,
        ...parsed,
      };
    },
  });
}
