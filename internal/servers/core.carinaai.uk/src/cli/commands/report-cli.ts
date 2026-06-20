#!/usr/bin/env tsx
import chalk from 'chalk';
import { loadLocalEnv } from '../config/env.js';
import { getCyberTool } from '../../tools/cyber/index.js';
import { resolveTimelineEngine } from '../../tools/cyber/reporting/phase11.js';

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

function parseReportParams(action: string, rest: string[]): Record<string, unknown> {
  if (action === 'timeline') {
    const image = rest[0];
    if (!image) {
      throw new Error('Usage: carina report timeline <image> --output file.plaso [--engine log2timeline|plasmo] [--parsers a,b] [--partition all|N]');
    }
    return {
      image,
      outputFile: readFlag(rest, '--output'),
      engine: resolveTimelineEngine(readFlag(rest, '--engine')),
      parsers: readFlag(rest, '--parsers'),
      partition: readFlag(rest, '--partition'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'search') {
    const query = rest[0];
    if (!query) {
      throw new Error('Usage: carina report search <query> [--timeline id] [--sketch id] [--time-start ISO] [--time-end ISO] [--limit N]');
    }
    return {
      action: 'search',
      query,
      timelineId: readFlag(rest, '--timeline') ? Number(readFlag(rest, '--timeline')) : undefined,
      sketchId: readFlag(rest, '--sketch') ? Number(readFlag(rest, '--sketch')) : undefined,
      timeStart: readFlag(rest, '--time-start'),
      timeEnd: readFlag(rest, '--time-end'),
      limit: readFlag(rest, '--limit') ? Number(readFlag(rest, '--limit')) : undefined,
    };
  }

  if (action === 'status') {
    return {
      action: 'status',
      sketchId: readFlag(rest, '--sketch') ? Number(readFlag(rest, '--sketch')) : undefined,
    };
  }

  if (action === 'stix') {
    return {
      findingsFile: readFlag(rest, '--findings'),
      outputFile: readFlag(rest, '--output'),
      tlp: readFlag(rest, '--tlp') ?? 'amber',
      author: readFlag(rest, '--author'),
      engagementId: readFlag(rest, '--engagement'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'transform') {
    const input = rest[0];
    if (!input) {
      throw new Error('Usage: carina report transform <data|file> --recipe "From Base64,Decode text" [--output file] [--from-file]');
    }
    return {
      input,
      recipe: readFlag(rest, '--recipe'),
      inputFromFile: hasFlag(rest, '--from-file'),
      outputFile: readFlag(rest, '--output'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  throw new Error(`Unknown report action: ${action}`);
}

const ACTION_TOOL: Record<string, string | ((params: Record<string, unknown>) => string)> = {
  timeline: (params) => resolveTimelineEngine(params.engine),
  search: 'timesketch',
  status: 'timesketch',
  stix: 'stix',
  transform: 'cyberchef',
};

export async function runReportCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0];
  if (!action) {
    console.error('Usage: carina report <timeline|search|status|stix|transform> ...');
    process.exit(1);
  }

  const json = args.includes('--json');
  const rest = args.slice(1).filter((arg) => arg !== '--json');

  let params: Record<string, unknown>;
  try {
    params = parseReportParams(action, rest);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  const toolRef = ACTION_TOOL[action];
  const toolName = typeof toolRef === 'function' ? toolRef(params) : toolRef;
  if (!toolName) {
    console.error(`Unknown report action: ${action}`);
    process.exit(1);
    return;
  }

  const tool = getCyberTool(toolName);
  if (!tool) {
    console.error(`Report tool not registered: ${toolName}`);
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
