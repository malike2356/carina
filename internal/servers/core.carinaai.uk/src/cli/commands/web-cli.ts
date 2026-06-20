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

const FUZZ_ENGINES = new Set(['ffuf', 'dirsearch', 'feroxbuster', 'gobuster']);

function parseWebParams(action: string, rest: string[]): Record<string, unknown> {
  if (action === 'scan') {
    const url = rest[0];
    if (!url) throw new Error('Usage: carina web scan <url> [--mode passive|active] [--timeout N]');
    return {
      action: 'scan',
      url,
      mode: readFlag(rest, '--mode') ?? 'passive',
      scope: readFlag(rest, '--scope'),
      loginUrl: readFlag(rest, '--login-url'),
      username: readFlag(rest, '--username'),
      password: readFlag(rest, '--password'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'proxy') {
    const proxyAction = rest[0] ?? 'status';
    return {
      action: 'proxy',
      proxyAction,
      port: readFlag(rest, '--port') ? Number(readFlag(rest, '--port')) : undefined,
      intercept: hasFlag(rest, '--intercept'),
    };
  }

  if (action === 'dirs') {
    const url = rest[0];
    if (!url) throw new Error('Usage: carina web dirs <url> [--engine ffuf|dirsearch|feroxbuster|gobuster] [--wordlist path] [--extensions php,html]');
    const engine = readFlag(rest, '--engine') ?? 'ffuf';
    if (!FUZZ_ENGINES.has(engine)) {
      throw new Error(`Unknown engine: ${engine}. Use ffuf, dirsearch, feroxbuster, or gobuster.`);
    }
    return {
      url,
      engine,
      wordlist: readFlag(rest, '--wordlist'),
      extensions: readFlag(rest, '--extensions'),
      threads: readFlag(rest, '--threads') ? Number(readFlag(rest, '--threads')) : undefined,
      recursive: hasFlag(rest, '--recursive'),
      depth: readFlag(rest, '--depth') ? Number(readFlag(rest, '--depth')) : undefined,
      filterStatus: readFlag(rest, '--filter-status'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'vhost') {
    const domain = rest[0];
    if (!domain) throw new Error('Usage: carina web vhost <domain> [--wordlist path]');
    return {
      url: domain,
      mode: 'vhost',
      wordlist: readFlag(rest, '--wordlist'),
      threads: readFlag(rest, '--threads') ? Number(readFlag(rest, '--threads')) : undefined,
      engine: readFlag(rest, '--engine') ?? 'ffuf',
    };
  }

  if (action === 'params') {
    const url = rest[0];
    if (!url) throw new Error('Usage: carina web params <url> [--method GET|POST|JSON|XML] [--wordlist path]');
    return {
      url,
      method: readFlag(rest, '--method') ?? 'GET',
      wordlist: readFlag(rest, '--wordlist'),
      threads: readFlag(rest, '--threads') ? Number(readFlag(rest, '--threads')) : undefined,
    };
  }

  if (action === 'gobuster') {
    const mode = rest[0];
    const target = rest[1];
    if (!mode || !target) throw new Error('Usage: carina web gobuster <dir|dns|vhost|s3> <target> [--wordlist path]');
    return {
      mode,
      target,
      wordlist: readFlag(rest, '--wordlist'),
      threads: readFlag(rest, '--threads') ? Number(readFlag(rest, '--threads')) : undefined,
      extensions: readFlag(rest, '--extensions'),
      statusCodes: readFlag(rest, '--status-codes'),
    };
  }

  if (action === 'ssti') {
    const url = rest[0];
    if (!url) throw new Error('Usage: carina web ssti <url> [--param name] [--engine auto|jinja2|twig] [--os-shell]');
    return {
      url,
      param: readFlag(rest, '--param'),
      data: readFlag(rest, '--data'),
      cookie: readFlag(rest, '--cookie'),
      engine: readFlag(rest, '--engine') ?? 'auto',
      osShell: hasFlag(rest, '--os-shell'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  throw new Error(`Unknown web action: ${action}`);
}

const ACTION_TOOL: Record<string, string | ((params: Record<string, unknown>) => string)> = {
  scan: 'burpsuite',
  proxy: 'burpsuite',
  dirs: (params) => String(params.engine ?? 'ffuf'),
  vhost: (params) => String(params.engine ?? 'ffuf'),
  params: 'arjun',
  gobuster: 'gobuster',
  ssti: 'sstimap',
};

export async function runWebCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0];
  if (!action) {
    console.error('Usage: carina web <scan|proxy|dirs|vhost|params|gobuster|ssti> ...');
    process.exit(1);
  }

  const json = args.includes('--json');
  const rest = args.slice(1).filter((arg) => arg !== '--json');

  let params: Record<string, unknown>;
  try {
    params = parseWebParams(action, rest);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  const toolRef = ACTION_TOOL[action];
  const toolName = typeof toolRef === 'function' ? toolRef(params) : toolRef;
  if (!toolName) {
    console.error(`Unknown web action: ${action}`);
    process.exit(1);
    return;
  }

  const tool = getCyberTool(toolName);
  if (!tool) {
    console.error(`Web tool not registered: ${toolName}`);
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
