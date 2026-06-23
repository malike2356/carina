import type { Tool } from '../../../types/index.js';
import type { CyberToolDef } from '../../cyber-tools-registry.js';
import { createReconTool } from '../factory.js';
import { sanitizePath } from '../sanitize.js';

const DEFAULT_R2_COMMANDS = ['aaa', 'afl', 'izz', 'iE'];
const CUTTER_EXPORT = new Set(['decompile', 'graph', 'report']);
const R2_COMMAND_RE = /^[a-zA-Z0-9_. @!?-]+$/;

function csvList(raw: unknown, fallback: string[]): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return fallback;
}

function validateR2Commands(commands: string[]): string[] | { error: string } {
  for (const cmd of commands) {
    if (!cmd || !R2_COMMAND_RE.test(cmd)) {
      return { error: `invalid radare2 command: ${cmd}` };
    }
  }
  return commands;
}

export function buildR2CommandSet(params: Record<string, unknown>): string[] | { error: string } {
  const explicit = csvList(params.commands, []);
  if (explicit.length > 0) return validateR2Commands(explicit);

  if (params.strings === true) return validateR2Commands(['izz']);
  if (params.functions === true) return validateR2Commands(['aaa', 'afl']);
  if (params.analyze === true || params.analyze === undefined) {
    return validateR2Commands(DEFAULT_R2_COMMANDS);
  }

  return validateR2Commands(DEFAULT_R2_COMMANDS);
}

export function parseR2Output(text: string): {
  functions: string[];
  strings: string[];
  exports: string[];
  raw: string;
} {
  const functions: string[] = [];
  const strings: string[] = [];
  const exports: string[] = [];

  for (const line of text.split('\n')) {
    const fn = line.match(/^\s*0x[0-9a-f]+\s+\d+\s+(\d+)\s+(\S+)/i);
    if (fn && line.includes('sym.')) {
      functions.push(fn[2] ?? line.trim());
    }
    const str = line.match(/^\s*\d+\s+0x[0-9a-f]+\s+\d+\s+(.+)$/);
    if (str && line.includes(' string ')) {
      strings.push(str[1]!.trim());
    }
    if (/export/i.test(line) || line.trim().startsWith('nth ')) {
      exports.push(line.trim());
    }
  }

  return { functions, strings, exports, raw: text.trim() };
}

export function createRadare2Tool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        binary: { type: 'string', description: 'Binary to analyze' },
        commands: { type: 'array', description: 'Radare2 commands to run' },
        analyze: { type: 'boolean', description: 'Run default analysis command set' },
        strings: { type: 'boolean', description: 'Extract strings only' },
        functions: { type: 'boolean', description: 'List functions' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['binary'],
    },
    buildArgs: (params) => {
      const binary = sanitizePath(params.binary);
      if (typeof binary !== 'string') return binary;

      const commands = buildR2CommandSet(params);
      if ('error' in commands) return commands;

      return ['-q', '-c', commands.join(';'), binary];
    },
    resolveBinary: () => 'r2',
    formatResult: (result, params, startedAt) => {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      const parsed = parseR2Output(output);
      const commandSet = buildR2CommandSet(params);
      const commands = typeof commandSet === 'object' && 'error' in commandSet ? [] : commandSet;
      return {
        tool: 'radare2',
        binary: String(params.binary ?? ''),
        commands,
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        functionCount: parsed.functions.length,
        stringCount: parsed.strings.length,
        exportCount: parsed.exports.length,
        ...parsed,
      };
    },
  });

  tool.requiresConfirmation = false;
  return tool;
}

export function createCutterTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 600_000,
    parameters: {
      type: 'object',
      properties: {
        binary: { type: 'string', description: 'Binary to analyze' },
        script: { type: 'string', description: 'Cutter Python script path' },
        export: { type: 'string', enum: ['decompile', 'graph', 'report'], description: 'Export format' },
        outputDir: { type: 'string', description: 'Export output directory' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['binary'],
    },
    buildArgs: (params) => {
      const binary = sanitizePath(params.binary);
      if (typeof binary !== 'string') return binary;

      if (params.script) {
        const script = sanitizePath(params.script);
        if (typeof script !== 'string') return script;
        return ['--script', script, binary];
      }

      const args = ['-1', '-a', binary, '-c'];
      const exportFmt = String(params.export ?? '').toLowerCase();
      if (exportFmt) {
        if (!CUTTER_EXPORT.has(exportFmt)) {
          return { error: `unsupported cutter export: ${exportFmt}` };
        }
        args.push('-e', exportFmt);
      }

      if (params.outputDir) {
        const outputDir = sanitizePath(params.outputDir);
        if (typeof outputDir !== 'string') return outputDir;
        args.push('-o', outputDir);
      }

      return args;
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'cutter',
      binary: String(params.binary ?? ''),
      export: params.export,
      outputDir: params.outputDir,
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
      note: 'Cutter batch mode delegates analysis to radare2 when headless.',
    }),
  });

  tool.requiresConfirmation = false;
  return tool;
}

export function createVscodiumTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 120_000,
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'File or directory to open' },
        target: { type: 'string', description: 'File alias' },
        wait: { type: 'boolean', description: 'Wait until editor closes' },
        newWindow: { type: 'boolean', description: 'Open in new window' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['file'],
    },
    buildArgs: (params) => {
      const file = sanitizePath(params.file ?? params.target);
      if (typeof file !== 'string') return file;

      const args: string[] = [];
      if (params.wait === true) args.push('--wait');
      if (params.newWindow === true) args.push('--new-window');
      args.push(file);
      return args;
    },
    resolveBinary: () => process.env.VSCODIUM_BIN ?? process.env.CODIUM_BIN ?? 'codium',
    formatResult: (result, params, startedAt) => ({
      tool: 'vscodium',
      file: String(params.file ?? params.target ?? ''),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });

  tool.requiresConfirmation = false;
  return tool;
}

export function resolveReverseEngine(engine: unknown): string {
  const value = String(engine ?? 'ghidra').trim().toLowerCase();
  if (value === 'r2' || value === 'radare2') return 'radare2';
  if (value === 'cutter') return 'cutter';
  if (value === 'ghidra') return 'ghidra';
  return value;
}
