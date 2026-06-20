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

function parseTrafficParams(action: string, rest: string[]): Record<string, unknown> {
  if (action === 'pcap') {
    const file = rest[0];
    if (!file) throw new Error('Usage: carina traffic pcap <file> [--filter "http or dns"] [--stats] [--conversations] [--fields a,b]');
    return {
      pcap: file,
      filter: readFlag(rest, '--filter'),
      fields: readFlag(rest, '--fields'),
      stats: hasFlag(rest, '--stats'),
      conversations: hasFlag(rest, '--conversations'),
      outputFormat: readFlag(rest, '--format') ?? 'json',
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'capture') {
    const iface = rest[0];
    if (!iface) throw new Error('Usage: carina traffic capture <interface> [--filter "port 80"] [--count N] [--output file.pcap]');
    return {
      interface: iface,
      filter: readFlag(rest, '--filter'),
      count: readFlag(rest, '--count') ? Number(readFlag(rest, '--count')) : undefined,
      output: readFlag(rest, '--output'),
      snaplen: readFlag(rest, '--snaplen') ? Number(readFlag(rest, '--snaplen')) : undefined,
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'creds') {
    const iface = rest[0];
    if (!iface) throw new Error('Usage: carina traffic creds <interface> [--protocols http,ftp,smtp] [--output file]');
    return {
      interface: iface,
      protocols: readFlag(rest, '--protocols'),
      outputFile: readFlag(rest, '--output'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'poison') {
    const iface = rest[0];
    if (!iface) throw new Error('Usage: carina traffic poison <interface> [--analyze] [--wpad] [--log path]');
    return {
      interface: iface,
      analyze: hasFlag(rest, '--analyze'),
      wpad: hasFlag(rest, '--wpad'),
      logFile: readFlag(rest, '--log'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'craft') {
    const script = rest[0];
    if (!script) throw new Error('Usage: carina traffic craft <script.py> [--interface eth0] [--count N]');
    return {
      script,
      interface: readFlag(rest, '--interface'),
      count: readFlag(rest, '--count') ? Number(readFlag(rest, '--count')) : undefined,
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  throw new Error(`Unknown traffic action: ${action}`);
}

const ACTION_TOOL: Record<string, string> = {
  pcap: 'tshark',
  capture: 'tcpdump',
  creds: 'dsniff',
  poison: 'responder',
  craft: 'scapy',
};

export async function runTrafficCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0];
  if (!action) {
    console.error('Usage: carina traffic <pcap|capture|creds|poison|craft> ...');
    process.exit(1);
  }

  const json = args.includes('--json');
  const rest = args.slice(1).filter((arg) => arg !== '--json');

  let params: Record<string, unknown>;
  try {
    params = parseTrafficParams(action, rest);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  const toolName = ACTION_TOOL[action];
  if (!toolName) {
    console.error(`Unknown traffic action: ${action}`);
    process.exit(1);
    return;
  }

  const tool = getCyberTool(toolName);
  if (!tool) {
    console.error(`Traffic tool not registered: ${toolName}`);
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
