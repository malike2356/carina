#!/usr/bin/env tsx
import chalk from 'chalk';
import { loadLocalEnv } from '../config/env.js';
import { getCyberTool } from '../../tools/cyber/index.js';
import { resolveReverseEngine } from '../../tools/cyber/reverse/phase9.js';
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

function parseForensicParams(action: string, rest: string[]): Record<string, unknown> {
  if (action === 'autopsy') {
    const image = rest[0];
    if (!image) throw new Error('Usage: carina forensic autopsy <image> --output-dir <dir> [--case name] [--modules a,b]');
    return {
      image,
      outputDir: readFlag(rest, '--output-dir') ?? readFlag(rest, '--output'),
      caseName: readFlag(rest, '--case'),
      caseNumber: readFlag(rest, '--case-number'),
      examiner: readFlag(rest, '--examiner'),
      ingestModules: readFlag(rest, '--modules'),
      report: readFlag(rest, '--report') ?? 'html',
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'memory') {
    const dump = rest[0];
    if (!dump) throw new Error('Usage: carina forensic memory <dump> [--engine volatility3|rekall] [--plugins a,b]');
    const engine = readFlag(rest, '--engine') ?? 'volatility3';
    return {
      dump,
      plugins: readFlag(rest, '--plugins'),
      outputDir: readFlag(rest, '--output-dir'),
      profile: readFlag(rest, '--profile'),
      dumpPids: readFlag(rest, '--pids'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
      _engine: engine,
    };
  }

  if (action === 'image') {
    const device = rest[0];
    if (!device) throw new Error('Usage: carina forensic image <device> [--engine dc3dd|guymager] [--output path]');
    const engine = readFlag(rest, '--engine') ?? 'dc3dd';
    return {
      device,
      output: readFlag(rest, '--output'),
      hash: readFlag(rest, '--hash'),
      split: readFlag(rest, '--split') ? Number(readFlag(rest, '--split')) : undefined,
      format: readFlag(rest, '--format'),
      caseName: readFlag(rest, '--case'),
      examiner: readFlag(rest, '--examiner'),
      compress: hasFlag(rest, '--compress') ? true : hasFlag(rest, '--no-compress') ? false : undefined,
      log: readFlag(rest, '--log'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
      _engine: engine,
    };
  }

  if (action === 'ts') {
    const image = rest[0];
    if (!image) throw new Error('Usage: carina forensic ts <image> --action mmls|list|recover|timeline|stat|icat [--inode N] [--offset N]');
    return {
      image,
      action: readFlag(rest, '--action') ?? 'mmls',
      inode: readFlag(rest, '--inode') ? Number(readFlag(rest, '--inode')) : undefined,
      offset: readFlag(rest, '--offset') ? Number(readFlag(rest, '--offset')) : undefined,
      outputDir: readFlag(rest, '--output-dir'),
      fileType: readFlag(rest, '--type'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'firmware') {
    const image = rest[0];
    if (!image) throw new Error('Usage: carina forensic firmware <image> [--extract] [--entropy] [--deep] [--output-dir path]');
    return {
      image,
      extract: !hasFlag(rest, '--no-extract'),
      entropy: hasFlag(rest, '--entropy'),
      deep: hasFlag(rest, '--deep'),
      outputDir: readFlag(rest, '--output-dir'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'reverse') {
    const binary = rest[0];
    if (!binary) {
      throw new Error('Usage: carina forensic reverse <binary> [--engine radare2|cutter|ghidra] [--commands aa,afl,izz] [--script path]');
    }
    return {
      binary,
      engine: readFlag(rest, '--engine') ?? 'ghidra',
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

  if (action === 'extract') {
    const image = rest[0];
    if (!image) throw new Error('Usage: carina forensic extract <image> --output-dir <dir> [--features all|email,url]');
    return {
      image,
      outputDir: readFlag(rest, '--output-dir') ?? readFlag(rest, '--output'),
      features: readFlag(rest, '--features'),
      threads: readFlag(rest, '--threads') ? Number(readFlag(rest, '--threads')) : undefined,
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'yara') {
    const target = rest[0];
    if (!target) throw new Error('Usage: carina forensic yara <target> [--rules dir] [--recursive] [--timeout N]');
    return {
      target,
      rulesDir: readFlag(rest, '--rules'),
      recursive: !hasFlag(rest, '--no-recursive'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
      tags: readFlag(rest, '--tags'),
    };
  }

  if (action === 'carve') {
    const image = rest[0];
    if (!image) throw new Error('Usage: carina forensic carve <image> --output-dir <dir> [--types jpg,pdf,all]');
    return {
      image,
      outputDir: readFlag(rest, '--output-dir') ?? readFlag(rest, '--output'),
      types: readFlag(rest, '--types'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'timeline') {
    const image = rest[0];
    if (!image) throw new Error('Usage: carina forensic timeline <image> --output <file.plaso> [--engine plasmo|log2timeline] [--parsers a,b]');
    return {
      image,
      outputFile: readFlag(rest, '--output'),
      engine: readFlag(rest, '--engine') ?? 'plasmo',
      parsers: readFlag(rest, '--parsers'),
      partition: readFlag(rest, '--partition') ? Number(readFlag(rest, '--partition')) : undefined,
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'pcap') {
    const pcap = rest[0];
    if (!pcap) throw new Error('Usage: carina forensic pcap <file> --output-dir <dir> [--decode http,smtp]');
    return {
      pcap,
      outputDir: readFlag(rest, '--output-dir') ?? readFlag(rest, '--output'),
      decode: readFlag(rest, '--decode'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'registry') {
    const hive = rest[0];
    if (!hive) throw new Error('Usage: carina forensic registry <hive> [--plugins all|usbstor,run]');
    return {
      hive,
      plugins: readFlag(rest, '--plugins') ?? readFlag(rest, '--plugin'),
      outputFile: readFlag(rest, '--output'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'hash') {
    const directory = rest[0];
    if (!directory) throw new Error('Usage: carina forensic hash <dir> [--algo md5|sha1|sha256] [--compare hashset]');
    return {
      directory,
      algorithm: readFlag(rest, '--algo') ?? readFlag(rest, '--algorithm') ?? 'sha256',
      compare: readFlag(rest, '--compare'),
      outputFile: readFlag(rest, '--output'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  if (action === 'debug') {
    const binary = rest[0];
    if (!binary) throw new Error('Usage: carina forensic debug <binary> [--engine ollydbg] [--script path]');
    return {
      binary,
      script: readFlag(rest, '--script'),
      timeout: readFlag(rest, '--timeout') ? Number(readFlag(rest, '--timeout')) : undefined,
    };
  }

  throw new Error(`Unknown forensic action: ${action}`);
}

const ACTION_TOOL: Record<string, string | ((params: Record<string, unknown>) => string)> = {
  autopsy: 'autopsy',
  memory: (params) => (params._engine === 'rekall' ? 'rekall' : 'volatility3'),
  image: (params) => (params._engine === 'guymager' ? 'guymager' : 'dc3dd'),
  ts: 'sleuthkit',
  firmware: 'binwalk',
  reverse: (params) => resolveReverseEngine(params.engine),
  extract: 'bulk-extractor',
  yara: 'yara',
  carve: 'foremost',
  timeline: (params) => resolveTimelineEngine(params.engine ?? 'plasmo'),
  pcap: 'xplico',
  registry: 'regripper',
  hash: 'hashdeep',
  debug: 'ollydbg',
};

export async function runForensicCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0];
  if (!action) {
    console.error('Usage: carina forensic <autopsy|memory|image|ts|firmware|reverse|extract|yara|carve|timeline|pcap|registry|hash|debug> ...');
    process.exit(1);
  }

  const json = args.includes('--json');
  const rest = args.slice(1).filter((arg) => arg !== '--json');

  let params: Record<string, unknown>;
  try {
    params = parseForensicParams(action, rest);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  const toolRef = ACTION_TOOL[action];
  const toolName = typeof toolRef === 'function' ? toolRef(params) : toolRef;
  if (!toolName) {
    console.error(`Unknown forensic action: ${action}`);
    process.exit(1);
    return;
  }

  const tool = getCyberTool(toolName);
  if (!tool) {
    console.error(`Forensic tool not registered: ${toolName}`);
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
