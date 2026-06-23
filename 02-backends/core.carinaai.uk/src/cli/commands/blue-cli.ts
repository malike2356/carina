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

function parseBlueParams(action: string, rest: string[]): Record<string, unknown> {
  if (action === 'monitor') {
    const engine = readFlag(rest, '--engine') ?? 'snort';
    if (engine !== 'snort') {
      throw new Error(`Unknown monitor engine: ${engine}. Only snort is supported in Phase 10.`);
    }

    if (hasFlag(rest, '--test-config')) {
      return {
        action: 'test',
        configFile: readFlag(rest, '--config'),
        timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
      };
    }

    if (hasFlag(rest, '--alerts')) {
      return {
        action: 'alerts',
        alertFile: readFlag(rest, '--alert-file'),
        logDir: readFlag(rest, '--log-dir'),
        threshold: readFlag(rest, '--threshold') ? Number(readFlag(rest, '--threshold')) : undefined,
      };
    }

    const iface = rest.find((arg) => !arg.startsWith('--'));
    if (!iface) {
      throw new Error('Usage: carina blue monitor <interface> [--engine snort] [--config path] [--alert-mode fast|full|console] [--log-dir path] [--test-config] [--alerts]');
    }

    return {
      action: 'monitor',
      interface: iface,
      configFile: readFlag(rest, '--config'),
      rulesDir: readFlag(rest, '--rules'),
      alertMode: readFlag(rest, '--alert-mode') ?? (hasFlag(rest, '--alert-fast') ? 'fast' : undefined),
      logDir: readFlag(rest, '--log-dir'),
      daqDir: readFlag(rest, '--daq-dir'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'ad-map') {
    const domain = rest[0];
    if (!domain) {
      throw new Error('Usage: carina blue ad-map <domain> --username user (--password pass | --hash ntlm) --output-dir dir [--dc host] [--collection Default,Session]');
    }
    return {
      domain,
      username: readFlag(rest, '--username'),
      password: readFlag(rest, '--password'),
      hash: readFlag(rest, '--hash'),
      dc: readFlag(rest, '--dc'),
      dnsServer: readFlag(rest, '--dns'),
      collection: readFlag(rest, '--collection'),
      outputDir: readFlag(rest, '--output-dir') ?? readFlag(rest, '--output'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  throw new Error(`Unknown blue action: ${action}`);
}

const ACTION_TOOL: Record<string, string> = {
  monitor: 'snort',
  'ad-map': 'bloodhound',
};

export async function runBlueCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0];
  if (!action) {
    console.error('Usage: carina blue <monitor|ad-map> ...');
    process.exit(1);
  }

  const json = args.includes('--json');
  const rest = args.slice(1).filter((arg) => arg !== '--json');

  let params: Record<string, unknown>;
  try {
    params = parseBlueParams(action, rest);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  const toolName = ACTION_TOOL[action];
  if (!toolName) {
    console.error(`Unknown blue action: ${action}`);
    process.exit(1);
    return;
  }

  const tool = getCyberTool(toolName);
  if (!tool) {
    console.error(`Blue team tool not registered: ${toolName}`);
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
