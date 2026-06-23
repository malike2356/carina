import type { Tool } from '../../../types/index.js';
import type { CyberToolDef } from '../../cyber-tools-registry.js';
import { createReconTool } from '../factory.js';
import { runBinary } from '../exec.js';
import { readFile } from 'node:fs/promises';
import {
  clampInt,
  sanitizeInterface,
  sanitizePacketFilter,
  sanitizePath,
} from '../sanitize.js';

const DEFAULT_RESPONDER_LOG = '/usr/share/responder/logs/Responder-Session.log';

function csvList(raw: unknown, fallback: string[]): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return fallback;
}

export function parseTsharkJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    return JSON.parse(trimmed);
  } catch {
    return { raw: trimmed };
  }
}

export function parseResponderLog(text: string): Array<{ user?: string; hash?: string; client?: string }> {
  const entries: Array<{ user?: string; hash?: string; client?: string }> = [];
  for (const line of text.split('\n')) {
    const ntlm = line.match(/\[NTLMv\d-SSP\]\s+(\S+)\s+::\s+(\S+)/i);
    if (ntlm) {
      entries.push({ user: ntlm[1], hash: ntlm[2] });
      continue;
    }
    const client = line.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
    if (client && entries.length > 0) {
      entries[entries.length - 1]!.client = client[1];
    }
  }
  return entries;
}

export function parseDsniffCredentials(text: string): Array<{ protocol?: string; user?: string; password?: string }> {
  const creds: Array<{ protocol?: string; user?: string; password?: string }> = [];
  for (const line of text.split('\n')) {
    const hit = line.match(/^(\w+):\s*(\S+)\s+(\S+)/);
    if (hit) creds.push({ protocol: hit[1], user: hit[2], password: hit[3] });
  }
  return creds;
}

function buildTsharkArgs(params: Record<string, unknown>): string[] | { error: string } {
  const pcap = sanitizePath(params.pcap ?? params.file ?? params.target);
  if (typeof pcap !== 'string') return pcap;

  const args = ['-r', pcap, '-n'];

  if (params.filter) {
    const filter = sanitizePacketFilter(params.filter);
    if (typeof filter !== 'string') return filter;
    args.push('-Y', filter);
  }

  const fields = csvList(params.fields, []);
  const format = String(params.outputFormat ?? 'json');
  if (fields.length > 0) {
    args.push('-T', 'fields');
    for (const field of fields) {
      if (!/^[a-zA-Z0-9._-]+$/.test(field)) {
        return { error: `invalid tshark field: ${field}` };
      }
      args.push('-e', field);
    }
  } else if (format === 'json') {
    args.push('-T', 'json');
  } else if (format === 'fields') {
    args.push('-T', 'fields');
  } else {
    args.push('-T', 'text');
  }

  if (params.stats === true) args.push('-z', 'io,phs');
  if (params.conversations === true) args.push('-z', 'conv,tcp');

  return args;
}

export function createTsharkTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        pcap: { type: 'string', description: 'PCAP file to analyze' },
        file: { type: 'string', description: 'PCAP alias' },
        filter: { type: 'string', description: 'Wireshark display filter' },
        fields: { type: 'array', description: 'Fields to extract' },
        stats: { type: 'boolean', description: 'Protocol hierarchy stats' },
        conversations: { type: 'boolean', description: 'TCP conversation stats' },
        outputFormat: { type: 'string', enum: ['json', 'text', 'fields'], description: 'Output format' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['pcap'],
    },
    buildArgs: (params) => buildTsharkArgs(params),
    formatResult: async (result, params, startedAt) => {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      const format = String(params.outputFormat ?? 'json');
      const body: Record<string, unknown> = {
        tool: 'tshark',
        pcap: String(params.pcap ?? params.file ?? ''),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        filter: params.filter,
      };

      if (format === 'json' && csvList(params.fields, []).length === 0) {
        body.packets = parseTsharkJson(result.stdout);
      } else {
        body.output = output;
      }

      if (params.stats === true || params.conversations === true) {
        body.statsOutput = result.stderr.trim() || undefined;
      }

      return body;
    },
  });

  tool.requiresConfirmation = false;
  return tool;
}

export function createTcpdumpTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 3_600_000,
    parameters: {
      type: 'object',
      properties: {
        interface: { type: 'string', description: 'Capture interface' },
        filter: { type: 'string', description: 'BPF capture filter' },
        count: { type: 'number', description: 'Packet count limit' },
        output: { type: 'string', description: 'Output PCAP path' },
        snaplen: { type: 'number', description: 'Snap length' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['interface'],
    },
    buildArgs: (params) => {
      const iface = sanitizeInterface(params.interface ?? params.iface);
      if (typeof iface !== 'string') return iface;

      const output = sanitizePath(params.output ?? '/tmp/carina_tcpdump.pcap');
      if (typeof output !== 'string') return output;

      const args = ['-i', iface, '-w', output, '-s', String(clampInt(params.snaplen, 65535, 64, 65535)), '-n'];
      const count = params.count != null ? clampInt(params.count, 0, 1, 1_000_000) : 0;
      if (count > 0) args.push('-c', String(count));

      if (params.filter) {
        const filter = sanitizePacketFilter(params.filter);
        if (typeof filter !== 'string') return filter;
        args.push(filter);
      }

      return args;
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'tcpdump',
      interface: String(params.interface ?? ''),
      pcap: String(params.output ?? '/tmp/carina_tcpdump.pcap'),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });

  tool.needsConfirmation = () => true;
  return tool;
}

export function createDsniffTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 600_000,
    parameters: {
      type: 'object',
      properties: {
        interface: { type: 'string', description: 'Sniff interface' },
        protocols: { type: 'array', description: 'Protocol modules' },
        outputFile: { type: 'string', description: 'Credential log path' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['interface'],
    },
    buildArgs: (params) => {
      const iface = sanitizeInterface(params.interface ?? params.iface);
      if (typeof iface !== 'string') return iface;

      const outputFile = sanitizePath(params.outputFile ?? `/tmp/dsniff_${Date.now()}.txt`);
      if (typeof outputFile !== 'string') return outputFile;

      const args = ['-i', iface, '-w', outputFile];
      const protocols = csvList(params.protocols, []);
      for (const proto of protocols) {
        if (!/^[a-z0-9_-]+$/i.test(proto)) {
          return { error: `invalid dsniff protocol: ${proto}` };
        }
        args.push('-m', proto);
      }
      return args;
    },
    formatResult: (result, params, startedAt) => {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      return {
        tool: 'dsniff',
        interface: String(params.interface ?? ''),
        outputFile: params.outputFile,
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        credentials: parseDsniffCredentials(output),
        output,
      };
    },
  });

  tool.needsConfirmation = () => true;
  return tool;
}

export function createResponderTool(def: CyberToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    dangerous: true,
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        interface: { type: 'string', description: 'Network interface' },
        analyze: { type: 'boolean', description: 'Passive analyze mode (no poisoning)' },
        wpad: { type: 'boolean', description: 'Enable WPAD proxy attack' },
        logFile: { type: 'string', description: 'Responder session log path' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['interface'],
    },
    needsConfirmation: (params) => params.analyze !== true,
    execute: async (params) => {
      const iface = sanitizeInterface(params.interface ?? params.iface);
      if (typeof iface !== 'string') return iface;

      const timeoutMs = clampInt(params.timeout, 600, 30, 7200) * 1000;
      const args = ['-I', iface];
      if (params.analyze === true) args.push('-A');
      if (params.wpad === true) args.push('-w');

      const result = await runBinary('responder', args, timeoutMs);
      const logPath = params.logFile
        ? sanitizePath(params.logFile)
        : process.env.RESPONDER_LOG ?? DEFAULT_RESPONDER_LOG;

      let hashes: Array<{ user?: string; hash?: string; client?: string }> = [];
      if (typeof logPath === 'string') {
        try {
          const logText = await readFile(logPath, 'utf8');
          hashes = parseResponderLog(logText);
        } catch {
          hashes = [];
        }
      }

      return {
        tool: 'responder',
        interface: iface,
        analyze: params.analyze === true,
        wpad: params.wpad === true,
        exitCode: result.exitCode,
        hashes,
        output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
        logFile: typeof logPath === 'string' ? logPath : undefined,
      };
    },
  };
}

export function createScapyTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'Python script path using scapy' },
        interface: { type: 'string', description: 'Network interface' },
        count: { type: 'number', description: 'Send count hint for scripts' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['script'],
    },
    buildArgs: (params) => {
      const script = sanitizePath(params.script);
      if (typeof script !== 'string') return script;

      const args = [script];
      if (params.interface) {
        const iface = sanitizeInterface(params.interface);
        if (typeof iface !== 'string') return iface;
        args.push('--interface', iface);
      }
      if (params.count != null) {
        args.push('--count', String(clampInt(params.count, 1, 1, 10_000)));
      }
      return args;
    },
    resolveBinary: () => 'python3',
    formatResult: (result, params, startedAt) => ({
      tool: 'scapy',
      script: String(params.script ?? ''),
      interface: params.interface,
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });

  tool.needsConfirmation = () => true;
  return tool;
}
