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

function parseReconParams(action: string, rest: string[]): Record<string, unknown> {
  const json = hasFlag(rest, '--json');
  void json;

  if (action === 'scan') {
    const target = rest[0];
    if (!target) throw new Error('Usage: carina recon scan <target> [--scan-type quick|full|stealth|service|os|vuln] [--options "..."] [--timeout N]');
    return {
      target,
      scanType: readFlag(rest, '--scan-type') ?? 'quick',
      options: readFlag(rest, '--options'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'subdomains') {
    const domain = rest[0];
    if (!domain) throw new Error('Usage: carina recon subdomains <domain> [--mode passive|active|full] [--depth N]');
    return {
      domain,
      mode: readFlag(rest, '--mode') ?? 'passive',
      depth: readFlag(rest, '--depth') ? Number(readFlag(rest, '--depth')) : undefined,
      wordlist: readFlag(rest, '--wordlist'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'osint') {
    const domain = rest[0];
    if (!domain) throw new Error('Usage: carina recon osint <domain> [--source all|google|shodan|...] [--limit N]');
    return {
      domain,
      source: readFlag(rest, '--source') ?? 'all',
      limit: readFlag(rest, '--limit') ? Number(readFlag(rest, '--limit')) : undefined,
    };
  }

  if (action === 'framework') {
    const domain = rest[0];
    if (!domain) throw new Error('Usage: carina recon framework <domain> [--modules discovery|reporting|expansion|all] [--workspace name]');
    return {
      domain,
      modules: readFlag(rest, '--modules') ?? 'discovery',
      workspace: readFlag(rest, '--workspace'),
    };
  }

  if (action === 'spiderfoot') {
    const target = rest[0];
    const targetType = readFlag(rest, '--type') ?? readFlag(rest, '--target-type');
    if (!target || !targetType) {
      throw new Error('Usage: carina recon spiderfoot <target> --type ip|domain|email|cidr|name|asn [--modules all|recon|vuln|darknet]');
    }
    return {
      target,
      targetType,
      modules: readFlag(rest, '--modules') ?? 'all',
      scanId: readFlag(rest, '--scan-id'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'username') {
    const username = rest[0];
    if (!username) throw new Error('Usage: carina recon username <username> [--timeout N] [--tor]');
    return {
      username,
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
      tor: hasFlag(rest, '--tor'),
    };
  }

  if (action === 'graph') {
    const entity = rest[0];
    const entityType = readFlag(rest, '--type') ?? readFlag(rest, '--entity-type');
    if (!entity || !entityType) {
      throw new Error('Usage: carina recon graph <entity> --type domain|email|ip|person|company [--depth N] [--output json|png|pdf|graphml]');
    }
    return {
      entity,
      entityType,
      depth: readFlag(rest, '--depth') ? Number(readFlag(rest, '--depth')) : undefined,
      output: readFlag(rest, '--output') ?? 'json',
    };
  }

  if (action === 'dmitry') {
    const target = rest[0];
    if (!target) throw new Error('Usage: carina recon dmitry <target> [--modules whois|subdomains|email|ports|banner|all]');
    return {
      target,
      modules: readFlag(rest, '--modules') ?? 'all',
      output: readFlag(rest, '--output'),
    };
  }

  if (action === 'metadata') {
    const domain = rest[0];
    if (!domain) throw new Error('Usage: carina recon metadata <domain> [--limit N] [--download] [--work-dir path]');
    return {
      domain,
      limit: readFlag(rest, '--limit') ? Number(readFlag(rest, '--limit')) : undefined,
      download: hasFlag(rest, '--download'),
      workDir: readFlag(rest, '--work-dir'),
    };
  }

  if (action === 'wordlist') {
    const url = rest[0];
    if (!url) throw new Error('Usage: carina recon wordlist <url> [--depth N] [--min-length N] [--output path]');
    return {
      url,
      depth: readFlag(rest, '--depth') ? Number(readFlag(rest, '--depth')) : undefined,
      minLength: readFlag(rest, '--min-length') ? Number(readFlag(rest, '--min-length')) : undefined,
      output: readFlag(rest, '--output'),
      withCount: hasFlag(rest, '--with-count'),
      email: hasFlag(rest, '--email'),
      meta: hasFlag(rest, '--meta'),
    };
  }

  throw new Error(`Unknown recon action: ${action}`);
}

const ACTION_TOOL: Record<string, string> = {
  scan: 'nmap',
  subdomains: 'amass',
  osint: 'theHarvester',
  framework: 'recon-ng',
  spiderfoot: 'spiderfoot',
  username: 'sherlock',
  graph: 'maltego',
  dmitry: 'dmitry',
  metadata: 'metagoofil',
  wordlist: 'cewl',
};

export async function runReconCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0];
  if (!action) {
    console.error('Usage: carina recon <scan|subdomains|osint|framework|spiderfoot|username|graph|dmitry|metadata|wordlist> ...');
    process.exit(1);
  }

  const json = args.includes('--json');
  const rest = args.slice(1).filter((arg) => arg !== '--json');

  let params: Record<string, unknown>;
  try {
    params = parseReconParams(action, rest);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  const toolName = ACTION_TOOL[action];
  if (!toolName) {
    console.error(`Unknown recon action: ${action}`);
    process.exit(1);
    return;
  }

  const tool = getCyberTool(toolName);
  if (!tool) {
    console.error(`Recon tool not registered: ${toolName}`);
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
