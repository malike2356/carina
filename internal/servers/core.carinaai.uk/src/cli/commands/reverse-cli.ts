#!/usr/bin/env tsx
import chalk from 'chalk';
import { loadLocalEnv } from '../config/env.js';
import { getCyberTool } from '../../tools/cyber/index.js';
import { resolveReverseEngine } from '../../tools/cyber/reverse/phase9.js';

function readFlag(args: string[], name: string): string | undefined {
  const eq = args.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.split('=').slice(1).join('=');
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return undefined;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function parseReverseParams(action: string, rest: string[]): Record<string, unknown> {
  if (action === 'analyze') {
    const binary = rest[0];
    if (!binary) {
      throw new Error('Usage: carina reverse analyze <binary> [--engine radare2|cutter|ghidra] [--commands aa,afl,izz] [--analyze] [--strings] [--functions] [--export decompile|graph|report] [--script path]');
    }
    const engine = resolveReverseEngine(readFlag(rest, '--engine') ?? 'radare2');
    return {
      binary,
      engine,
      commands: readFlag(rest, '--commands'),
      analyze: hasFlag(rest, '--analyze') ? true : undefined,
      strings: hasFlag(rest, '--strings'),
      functions: hasFlag(rest, '--functions'),
      export: readFlag(rest, '--export'),
      outputDir: readFlag(rest, '--output-dir'),
      script: readFlag(rest, '--script'),
      projectDir: readFlag(rest, '--project-dir'),
      projectName: readFlag(rest, '--project'),
      deleteProject: !hasFlag(rest, '--keep-project'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'open') {
    const file = rest[0];
    if (!file) throw new Error('Usage: carina reverse open <file> [--wait] [--new-window]');
    return {
      file,
      wait: hasFlag(rest, '--wait'),
      newWindow: hasFlag(rest, '--new-window'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  throw new Error(`Unknown reverse action: ${action}`);
}

const ACTION_TOOL: Record<string, string | ((params: Record<string, unknown>) => string)> = {
  analyze: (params) => resolveReverseEngine(params.engine),
  open: 'vscodium',
};

export async function runReverseCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0];
  if (!action) {
    console.error('Usage: carina reverse <analyze|open> ...');
    process.exit(1);
  }

  const json = args.includes('--json');
  const rest = args.slice(1).filter((arg) => arg !== '--json');

  let params: Record<string, unknown>;
  try {
    params = parseReverseParams(action, rest);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  const toolRef = ACTION_TOOL[action];
  const toolName = typeof toolRef === 'function' ? toolRef(params) : toolRef;
  if (!toolName) {
    console.error(`Unknown reverse action: ${action}`);
    process.exit(1);
    return;
  }

  const tool = getCyberTool(toolName);
  if (!tool) {
    console.error(`Reverse tool not registered: ${toolName}`);
    process.exit(1);
    return;
  }

  console.log(chalk.gray(`Running ${toolName} (${action})...`));
  const result = await tool.execute(params);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (typeof result === 'object' && result !== null && 'error' in result) {
    console.error(chalk.red(String((result as { error: string }).error)));
    process.exit(1);
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}
