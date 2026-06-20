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

function parseBruteParams(action: string, rest: string[]): Record<string, unknown> {
  if (action === 'service') {
    const target = rest[0];
    const protocol = readFlag(rest, '--protocol');
    if (!target || !protocol) {
      throw new Error('Usage: carina brute service <target> --protocol ssh|ftp|... --port N [--username u|--users file] [--password p|--passwords file] [--mode spray|brute]');
    }
    return {
      target,
      protocol,
      port: readFlag(rest, '--port') ? Number(readFlag(rest, '--port')) : undefined,
      username: readFlag(rest, '--username'),
      password: readFlag(rest, '--password'),
      userFile: readFlag(rest, '--users'),
      passFile: readFlag(rest, '--passwords'),
      mode: readFlag(rest, '--mode') ?? 'brute',
      tasks: readFlag(rest, '--tasks') ? Number(readFlag(rest, '--tasks')) : undefined,
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }
  throw new Error(`Unknown brute action: ${action}`);
}

function parseCrackParams(action: string, rest: string[]): Record<string, unknown> {
  if (action === 'hash') {
    const hashFile = rest[0];
    if (!hashFile) throw new Error('Usage: carina crack hash <file> [--format ntlm|...] [--wordlist path] [--rules name] [--mode wordlist|incremental|single]');
    return {
      hashFile,
      format: readFlag(rest, '--format'),
      wordlist: readFlag(rest, '--wordlist'),
      rules: readFlag(rest, '--rules'),
      mode: readFlag(rest, '--mode') ?? 'wordlist',
      session: readFlag(rest, '--session'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'gpu') {
    const hashFile = rest[0];
    if (!hashFile) throw new Error('Usage: carina crack gpu <file> [--mode ntlm|md5|...] [--attack wordlist|mask] [--mask "?a?a?a?a?a?a?a?a"]');
    return {
      hashFile,
      mode: readFlag(rest, '--mode'),
      hashMode: readFlag(rest, '--hash-mode') ? Number(readFlag(rest, '--hash-mode')) : undefined,
      attackMode: readFlag(rest, '--attack') ?? 'wordlist',
      wordlist: readFlag(rest, '--wordlist'),
      rules: readFlag(rest, '--rules'),
      mask: readFlag(rest, '--mask'),
      device: readFlag(rest, '--device') ? Number(readFlag(rest, '--device')) : undefined,
      session: readFlag(rest, '--session'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  throw new Error(`Unknown crack action: ${action}`);
}

export async function runBruteCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0];
  if (!action) {
    console.error('Usage: carina brute service <target> --protocol <proto> --port N ...');
    process.exit(1);
  }

  const json = args.includes('--json');
  const rest = args.slice(1).filter((arg) => arg !== '--json');
  const params = parseBruteParams(action, rest);
  const tool = getCyberTool('hydra');
  if (!tool) {
    console.error('Hydra tool not registered');
    process.exit(1);
  }

  console.log(chalk.gray('Running hydra...'));
  const result = await tool.execute(params);
  console.log(json ? JSON.stringify(result, null, 2) : JSON.stringify(result, null, 2));
}

export async function runCrackCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0];
  if (!action) {
    console.error('Usage: carina crack <hash|gpu> <file> ...');
    process.exit(1);
  }

  const json = args.includes('--json');
  const rest = args.slice(1).filter((arg) => arg !== '--json');
  const params = parseCrackParams(action, rest);
  const toolName = action === 'gpu' ? 'hashcat' : 'john';
  const tool = getCyberTool(toolName);
  if (!tool) {
    console.error(`${toolName} tool not registered`);
    process.exit(1);
  }

  console.log(chalk.gray(`Running ${toolName}...`));
  const result = await tool.execute(params);
  console.log(json ? JSON.stringify(result, null, 2) : JSON.stringify(result, null, 2));
}
