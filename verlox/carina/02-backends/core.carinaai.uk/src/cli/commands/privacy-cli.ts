#!/usr/bin/env tsx
import chalk from 'chalk';
import { loadLocalEnv } from '../config/env.js';
import { getCyberTool } from '../../tools/cyber/index.js';

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

function parsePrivacyParams(action: string, rest: string[]): Record<string, unknown> {
  if (action === 'tor') {
    const sub = rest[0];
    if (!sub || ['on', 'off', 'status', 'change', 'restart', 'start', 'stop'].includes(sub)) {
      return {
        action: sub ?? 'status',
      };
    }
    throw new Error('Usage: carina privacy tor <on|off|status|change|restart>');
  }

  if (action === 'proxy') {
    const command = rest.filter((arg) => !arg.startsWith('--')).join(' ').trim();
    if (!command) throw new Error('Usage: carina privacy proxy <command...> [--socks-port N]');
    return {
      action: 'proxy',
      command,
      socksPort: readFlag(rest, '--socks-port') ? Number(readFlag(rest, '--socks-port')) : undefined,
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'strip') {
    const target = rest[0];
    if (!target) throw new Error('Usage: carina privacy strip <file|dir> [--recursive] [--lightweight]');
    return {
      target,
      recursive: hasFlag(rest, '--recursive'),
      lightweight: hasFlag(rest, '--lightweight'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'clean') {
    return {
      presets: readFlag(rest, '--presets'),
      deep: hasFlag(rest, '--deep'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'disk') {
    const device = rest[0];
    if (!device) {
      throw new Error('Usage: carina privacy disk <device> [--table gpt|msdos] [--filesystem ext4] [--action setup|mklabel|mkpart]');
    }
    return {
      device,
      table: readFlag(rest, '--table') ?? 'gpt',
      filesystem: readFlag(rest, '--filesystem') ?? 'ext4',
      label: readFlag(rest, '--label'),
      action: readFlag(rest, '--action') ?? 'setup',
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  throw new Error(`Unknown privacy action: ${action}`);
}

const ACTION_TOOL: Record<string, string> = {
  tor: 'anonsurf',
  proxy: 'tor',
  strip: 'mat2',
  clean: 'bleachbit',
  disk: 'gparted',
};

export async function runPrivacyCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0];
  if (!action) {
    console.error('Usage: carina privacy <tor|proxy|strip|clean|disk> ...');
    process.exit(1);
  }

  const json = args.includes('--json');
  const rest = args.slice(1).filter((arg) => arg !== '--json');

  let params: Record<string, unknown>;
  try {
    params = parsePrivacyParams(action, rest);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  const toolName = ACTION_TOOL[action];
  if (!toolName) {
    console.error(`Unknown privacy action: ${action}`);
    process.exit(1);
    return;
  }

  const tool = getCyberTool(toolName);
  if (!tool) {
    console.error(`Privacy tool not registered: ${toolName}`);
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
