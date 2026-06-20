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

function parseVulnParams(action: string, rest: string[]): Record<string, unknown> {
  if (action === 'scan') {
    const target = rest[0];
    if (!target) throw new Error('Usage: carina vuln scan <target> [--templates all|cve|misconfig|...] [--severity critical,high,medium] [--rate-limit N]');
    return {
      target,
      templates: readFlag(rest, '--templates') ?? 'all',
      severity: readFlag(rest, '--severity'),
      rateLimit: readFlag(rest, '--rate-limit') ? Number(readFlag(rest, '--rate-limit')) : undefined,
      customTemplates: readFlag(rest, '--custom-templates'),
      proxy: readFlag(rest, '--proxy'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'web') {
    const target = rest[0];
    if (!target) throw new Error('Usage: carina vuln web <target> [--port N] [--ssl] [--tuning 123456789]');
    return {
      target,
      port: readFlag(rest, '--port') ? Number(readFlag(rest, '--port')) : undefined,
      ssl: hasFlag(rest, '--ssl'),
      tuning: readFlag(rest, '--tuning'),
      hostHeader: readFlag(rest, '--host-header'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'sqli') {
    const url = rest[0];
    if (!url) throw new Error('Usage: carina vuln sqli <url> [--data "..."] [--cookie "..."] [--level 1-5] [--risk 1-3] [--dump]');
    return {
      url,
      data: readFlag(rest, '--data'),
      cookie: readFlag(rest, '--cookie'),
      level: readFlag(rest, '--level') ? Number(readFlag(rest, '--level')) : undefined,
      risk: readFlag(rest, '--risk') ? Number(readFlag(rest, '--risk')) : undefined,
      dump: hasFlag(rest, '--dump'),
      dbms: readFlag(rest, '--dbms'),
      technique: readFlag(rest, '--technique'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'wordpress') {
    const url = rest[0];
    if (!url) throw new Error('Usage: carina vuln wordpress <url> [--enumerate p,t,u] [--api-token KEY] [--stealthy]');
    return {
      url,
      enumerate: readFlag(rest, '--enumerate'),
      apiToken: readFlag(rest, '--api-token'),
      stealthy: hasFlag(rest, '--stealthy'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'fingerprint') {
    const url = rest[0];
    if (!url) throw new Error('Usage: carina vuln fingerprint <url> [--aggression 1-4]');
    return {
      url,
      aggression: readFlag(rest, '--aggression') ? Number(readFlag(rest, '--aggression')) : undefined,
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'layer2') {
    const iface = rest[0];
    if (!iface) throw new Error('Usage: carina vuln layer2 <interface> [--protocol stp|cdp|...|all] [--mode attack|discover]');
    return {
      interface: iface,
      protocol: readFlag(rest, '--protocol') ?? 'all',
      mode: readFlag(rest, '--mode') ?? 'discover',
    };
  }

  if (action === 'assess') {
    const target = rest[0];
    if (!target) throw new Error('Usage: carina vuln assess <target> [--ports top1000|all|custom] [--brute] [--no-screenshots]');
    return {
      target,
      ports: readFlag(rest, '--ports') ?? 'top1000',
      brute: hasFlag(rest, '--brute'),
      screenshots: !hasFlag(rest, '--no-screenshots'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  throw new Error(`Unknown vuln action: ${action}`);
}

const ACTION_TOOL: Record<string, string> = {
  scan: 'nuclei',
  web: 'nikto',
  sqli: 'sqlmap',
  wordpress: 'wpscan',
  fingerprint: 'whatweb',
  layer2: 'yersinia',
  assess: 'legion',
};

export async function runVulnCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0];
  if (!action) {
    console.error('Usage: carina vuln <scan|web|sqli|wordpress|fingerprint|layer2|assess> ...');
    process.exit(1);
  }

  const json = args.includes('--json');
  const rest = args.slice(1).filter((arg) => arg !== '--json');

  let params: Record<string, unknown>;
  try {
    params = parseVulnParams(action, rest);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  const toolName = ACTION_TOOL[action];
  if (!toolName) {
    console.error(`Unknown vuln action: ${action}`);
    process.exit(1);
    return;
  }

  const tool = getCyberTool(toolName);
  if (!tool) {
    console.error(`Vulnerability tool not registered: ${toolName}`);
    process.exit(1);
    return;
  }

  console.log(chalk.gray(`Running ${toolName}...`));
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
