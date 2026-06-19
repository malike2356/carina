import type { Tool } from '../../../types/index.js';
import type { CyberToolDef } from '../../cyber-tools-registry.js';
import { createReconTool } from '../factory.js';
import { runBinary } from '../exec.js';
import {
  clampInt,
  sanitizeBlockDevice,
  sanitizePath,
  tokenizeOptions,
} from '../sanitize.js';

const ANONSURF_ACTIONS = new Set(['start', 'stop', 'status', 'change', 'restart']);
const PARTITION_TABLES = new Set(['gpt', 'msdos']);
const DEFAULT_BLEACHBIT_PRESETS = ['firefox', 'chrome', 'system', 'tmp'];

function csvList(raw: unknown, fallback: string[]): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return fallback;
}

export function mapAnonsurfAction(raw: unknown): string | { error: string } {
  const input = String(raw ?? 'status').trim().toLowerCase();
  const mapped = input === 'on' ? 'start' : input === 'off' ? 'stop' : input;
  if (!ANONSURF_ACTIONS.has(mapped)) {
    return { error: `unsupported anonsurf action: ${input}` };
  }
  return mapped;
}

export function parseAnonsurfStatus(text: string): { torActive: boolean; output: string } {
  const lower = text.toLowerCase();
  return {
    torActive: lower.includes('active') || lower.includes('enabled') || lower.includes('running'),
    output: text.trim(),
  };
}

export function parseMat2Output(text: string): { cleaned: number; files: string[] } {
  const files: string[] = [];
  for (const line of text.split('\n')) {
    const hit = line.match(/Cleaned\s+(.+)|Stripped\s+metadata\s+from\s+(.+)/i);
    if (hit) files.push((hit[1] ?? hit[2] ?? '').trim());
  }
  return { cleaned: files.length, files };
}

export function createAnonsurfTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 60_000,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start', 'stop', 'status', 'change', 'restart', 'on', 'off'], description: 'Anonsurf action' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['action'],
    },
    buildArgs: (params) => {
      const action = mapAnonsurfAction(params.action);
      if (typeof action !== 'string') return action;
      return [action];
    },
    formatResult: (result, params, startedAt) => {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      const action = typeof mapAnonsurfAction(params.action) === 'string'
        ? mapAnonsurfAction(params.action) as string
        : String(params.action ?? 'status');
      const body: Record<string, unknown> = {
        tool: 'anonsurf',
        action,
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        output,
      };
      if (action === 'status') {
        body.status = parseAnonsurfStatus(output);
      }
      return body;
    },
  });

  tool.needsConfirmation = (params) => {
    const action = mapAnonsurfAction(params.action);
    return typeof action === 'string' && ['start', 'change', 'restart'].includes(action);
  };

  return tool;
}

export function createTorTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['proxy', 'status'], description: 'Tor action' },
        command: { type: 'string', description: 'Command to run via torify' },
        socksPort: { type: 'number', description: 'SOCKS port (default 9050)' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
    },
    buildArgs: (params) => {
      const action = String(params.action ?? (params.command ? 'proxy' : 'status'));
      if (action === 'status') {
        return ['--verify-config'];
      }

      const command = params.command ?? params.target;
      if (!command) return { error: 'command is required for tor proxy mode' };
      const tokens = tokenizeOptions(command);
      if ('error' in tokens) return tokens;
      if (tokens.length === 0) return { error: 'command is required for tor proxy mode' };
      return tokens;
    },
    resolveBinary: (params) => {
      const action = String(params.action ?? (params.command ? 'proxy' : 'status'));
      return action === 'status' ? 'tor' : 'torify';
    },
    formatResult: (result, params, startedAt) => {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      const action = String(params.action ?? (params.command ? 'proxy' : 'status'));
      return {
        tool: 'tor',
        action,
        command: params.command,
        viaTor: action === 'proxy',
        socksPort: clampInt(params.socksPort, 9050, 1, 65535),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        output,
      };
    },
  });

  tool.needsConfirmation = (params) => {
    const action = String(params.action ?? (params.command ? 'proxy' : 'status'));
    return action === 'proxy';
  };

  return tool;
}

export function createMat2Tool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'File or directory to strip' },
        recursive: { type: 'boolean', description: 'Recursive directory strip' },
        lightweight: { type: 'boolean', description: 'Lightweight mode' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['target'],
    },
    buildArgs: (params) => {
      const target = sanitizePath(params.target);
      if (typeof target !== 'string') return target;

      const args: string[] = [];
      if (params.recursive === true) args.push('-r');
      if (params.lightweight === true) args.push('--lightweight');
      args.push(target);
      return args;
    },
    formatResult: (result, params, startedAt) => {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      return {
        tool: 'mat2',
        target: String(params.target ?? ''),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        ...parseMat2Output(output),
        output,
      };
    },
  });

  tool.requiresConfirmation = false;
  return tool;
}

export function createBleachbitTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 600_000,
    parameters: {
      type: 'object',
      properties: {
        presets: { type: 'array', description: 'BleachBit cleaner presets' },
        deep: { type: 'boolean', description: 'Deep scan mode' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
    },
    buildArgs: (params) => {
      const presets = csvList(params.presets, DEFAULT_BLEACHBIT_PRESETS);
      const args = ['--clean'];
      if (params.deep === true) args.push('--deep-scan');

      for (const preset of presets) {
        if (!/^[a-z0-9._-]+$/i.test(preset)) {
          return { error: `invalid bleachbit preset: ${preset}` };
        }
        args.push(`--preset=${preset}`);
      }
      return args;
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'bleachbit',
      presets: csvList(params.presets, DEFAULT_BLEACHBIT_PRESETS),
      deep: params.deep === true,
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
      timestamp: new Date(startedAt).toISOString(),
    }),
  });

  tool.needsConfirmation = () => true;
  return tool;
}

export function createGpartedTool(def: CyberToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    dangerous: true,
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        device: { type: 'string', description: 'Block device to partition' },
        action: { type: 'string', enum: ['setup', 'mklabel', 'mkpart'], description: 'Partition action' },
        table: { type: 'string', enum: ['gpt', 'msdos'], description: 'Partition table type' },
        label: { type: 'string', description: 'Volume label (informational)' },
        filesystem: { type: 'string', description: 'Filesystem for new partition' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['device'],
    },
    needsConfirmation: () => true,
    execute: async (params) => {
      const device = sanitizeBlockDevice(params.device);
      if (typeof device !== 'string') return device;

      const action = String(params.action ?? 'setup');
      const table = String(params.table ?? 'gpt');
      if (!PARTITION_TABLES.has(table)) {
        return { error: `unsupported partition table: ${table}` };
      }

      const fs = String(params.filesystem ?? 'ext4');
      if (!/^[a-z0-9+.-]+$/i.test(fs)) {
        return { error: 'filesystem name contains invalid characters' };
      }

      const timeoutMs = clampInt(params.timeout, 300, 30, 3600) * 1000;
      const steps: Array<{ step: string; exitCode: number; output: string }> = [];

      if (action === 'mklabel' || action === 'setup') {
        const mklabel = await runBinary('parted', ['-s', device, 'mklabel', table], timeoutMs);
        steps.push({
          step: 'mklabel',
          exitCode: mklabel.exitCode,
          output: [mklabel.stdout, mklabel.stderr].filter(Boolean).join('\n').trim(),
        });
        if (mklabel.exitCode !== 0) {
          return {
            tool: 'gparted',
            device,
            table,
            error: 'mklabel failed',
            steps,
          };
        }
      }

      if (action === 'mkpart' || action === 'setup') {
        const mkpart = await runBinary(
          'parted',
          ['-s', device, 'mkpart', 'primary', fs, '0%', '100%'],
          timeoutMs,
        );
        steps.push({
          step: 'mkpart',
          exitCode: mkpart.exitCode,
          output: [mkpart.stdout, mkpart.stderr].filter(Boolean).join('\n').trim(),
        });
        if (mkpart.exitCode !== 0) {
          return {
            tool: 'gparted',
            device,
            table,
            filesystem: fs,
            error: 'mkpart failed',
            steps,
          };
        }
      }

      return {
        tool: 'gparted',
        device,
        action,
        table,
        filesystem: fs,
        label: params.label,
        warning: 'Partitioning destroys existing data on the device',
        steps,
      };
    },
  };
}
