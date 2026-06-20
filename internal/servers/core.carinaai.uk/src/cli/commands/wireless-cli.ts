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

function parseWirelessParams(action: string, rest: string[]): Record<string, unknown> {
  if (action === 'audit') {
    const iface = rest[0];
    if (!iface) {
      throw new Error('Usage: carina wireless audit <interface> [--target BSSID] [--mode capture|crack|wpa|wpa2|deauth] [--wordlist path] [--cap-file path] [--channel N]');
    }
    return {
      interface: iface,
      mode: readFlag(rest, '--mode') ?? 'capture',
      bssid: readFlag(rest, '--target') ?? readFlag(rest, '--bssid'),
      wordlist: readFlag(rest, '--wordlist'),
      capFile: readFlag(rest, '--cap-file'),
      channel: readFlag(rest, '--channel') ? Number(readFlag(rest, '--channel')) : undefined,
      count: readFlag(rest, '--count') ? Number(readFlag(rest, '--count')) : undefined,
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'discover') {
    const iface = rest[0];
    if (!iface) {
      throw new Error('Usage: carina wireless discover <interface> [--source wlan0=wlan0] [--duration N]');
    }
    return {
      interface: iface,
      source: readFlag(rest, '--source'),
      duration: readFlag(rest, '--duration') ? Number(readFlag(rest, '--duration')) : undefined,
      action: 'discover',
    };
  }

  if (action === 'auto') {
    const iface = rest[0];
    if (!iface) {
      throw new Error('Usage: carina wireless auto <interface> [--wps] [--wpa] [--crack] [--kill] [--wordlist path]');
    }
    return {
      interface: iface,
      wps: hasFlag(rest, '--wps') ? true : hasFlag(rest, '--no-wps') ? false : undefined,
      wpa: hasFlag(rest, '--wpa') ? true : hasFlag(rest, '--no-wpa') ? false : undefined,
      crack: hasFlag(rest, '--crack') ? true : hasFlag(rest, '--no-crack') ? false : undefined,
      kill: hasFlag(rest, '--kill'),
      wordlist: readFlag(rest, '--wordlist'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'mitm') {
    const engine = readFlag(rest, '--engine') ?? 'bettercap';
    const iface = rest.find((arg) => !arg.startsWith('--') && arg !== engine) ?? rest[0];
    if (!iface) {
      throw new Error('Usage: carina wireless mitm <interface> [--engine bettercap|ettercap] [--target IP] [--gateway IP] [--module arp.spoof,...]');
    }

    const base = {
      interface: iface,
      target: readFlag(rest, '--target'),
      gateway: readFlag(rest, '--gateway'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };

    if (engine === 'ettercap') {
      return {
        ...base,
        target1: readFlag(rest, '--target1') ?? base.target,
        target2: readFlag(rest, '--target2') ?? base.gateway,
        mitm: readFlag(rest, '--mitm') ?? 'arp:remote',
        sniff: !hasFlag(rest, '--no-sniff'),
        filter: readFlag(rest, '--filter'),
        pcap: readFlag(rest, '--pcap'),
      };
    }

    return {
      ...base,
      modules: readFlag(rest, '--module') ?? readFlag(rest, '--modules'),
      caplet: readFlag(rest, '--caplet'),
      sniffFilter: readFlag(rest, '--filter'),
    };
  }

  throw new Error(`Unknown wireless action: ${action}`);
}

const ACTION_TOOL: Record<string, string | ((params: Record<string, unknown>, rest: string[]) => string)> = {
  audit: 'aircrack-ng',
  discover: 'kismet',
  auto: 'wifite',
  mitm: (_params, rest) => (readFlag(rest, '--engine') ?? 'bettercap') === 'ettercap' ? 'ettercap' : 'bettercap',
};

export async function runWirelessCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0];
  if (!action) {
    console.error('Usage: carina wireless <audit|discover|auto|mitm> ...');
    process.exit(1);
  }

  const json = args.includes('--json');
  const rest = args.slice(1).filter((arg) => arg !== '--json');

  let params: Record<string, unknown>;
  try {
    params = parseWirelessParams(action, rest);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  const toolRef = ACTION_TOOL[action];
  const toolName = typeof toolRef === 'function' ? toolRef(params, rest) : toolRef;
  if (!toolName) {
    console.error(`Unknown wireless action: ${action}`);
    process.exit(1);
    return;
  }

  const tool = getCyberTool(toolName);
  if (!tool) {
    console.error(`Wireless tool not registered: ${toolName}`);
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
