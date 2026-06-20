import type { PackageInfo } from './types.js';

export type GroupContext = {
  json: boolean;
  help: boolean;
  positional: string[];
  rawArgs: string[];
};

export type GroupSubcommand = {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  examples?: string[];
  options?: string[];
  handler: (ctx: GroupContext) => Promise<void>;
};

export type CommandGroup = {
  name: string;
  aliases?: string[];
  summary: string;
  loadEnv?: boolean;
  subcommands: GroupSubcommand[];
  legacyHandler?: (args: string[]) => Promise<void>;
};

export const TOP_GROUP_ALIASES: Record<string, string> = {
  ws: 'workspace',
  s: 'session',
  mem: 'memory',
  m: 'model',
  t: 'task',
  sk: 'skill',
  a: 'agent',
  wh: 'webhook',
  sec: 'scout',
  ch: 'channel',
  cfg: 'config',
};

const GLOBAL_SUB_ALIASES: Record<string, string> = {
  ls: 'list',
  rm: 'delete',
  mv: 'rename',
  find: 'search',
  i: 'install',
  r: 'resume',
  w: 'watch',
  pub: 'publish',
  up: 'update',
  on: 'enable',
  off: 'disable',
  ev: 'events',
  rep: 'report',
  pol: 'policy',
  hist: 'history',
  '.': 'current',
};

const GROUP_SUB_ALIASES: Record<string, Record<string, string>> = {
  workspace: { new: 'create', use: 'switch' },
  session: { new: 'new', stats: 'stats' },
  model: { use: 'use', bench: 'benchmark' },
  task: { new: 'create', s: 'status' },
  skill: { i: 'install' },
  agent: { run: 'spawn', s: 'status' },
  webhook: { new: 'create' },
  scout: { s: 'status', kill: 'kill', reset: 'reset', inv: 'investigate' },
  channel: { new: 'add', s: 'status' },
  config: { ls: 'list' },
};

export function expandCliArgv(argv: string[]): string[] {
  if (argv.length === 0) return argv;
  const top = TOP_GROUP_ALIASES[argv[0]!] ?? argv[0]!;
  const out = [top];
  if (argv.length > 1) {
    const groupMap = GROUP_SUB_ALIASES[top] ?? {};
    const sub = groupMap[argv[1]!] ?? GLOBAL_SUB_ALIASES[argv[1]!] ?? argv[1]!;
    out.push(sub, ...argv.slice(2));
  }
  return out;
}

export function parseGroupContext(args: string[]): GroupContext {
  const json = args.includes('--json');
  const help = args.includes('--help') || args.includes('-h');
  const positional = args.filter((a) => !a.startsWith('--') && a !== '-h');
  return { json, help, positional, rawArgs: args };
}

export function resolveSubcommand(group: CommandGroup, token?: string): GroupSubcommand | undefined {
  if (!token) return undefined;
  const normalized = token.toLowerCase();
  return group.subcommands.find(
    (s) => s.name === normalized || s.aliases?.includes(normalized),
  );
}

export function printGroupHelp(group: CommandGroup, pkg?: PackageInfo): void {
  const aliasLine = group.aliases?.length ? `\nAliases: ${group.aliases.join(', ')}` : '';
  console.log(`Usage: carina ${group.name} <command> [options]${aliasLine}\n`);
  console.log(`${group.summary}\n`);
  console.log('Commands:');
  for (const sub of group.subcommands) {
    const alias = sub.aliases?.length ? ` (${sub.aliases.join(', ')})` : '';
    console.log(`  ${sub.name.padEnd(12)} ${sub.description}${alias}`);
  }
  console.log('');
  if (pkg) console.log(`Carina v${pkg.version}`);
}

export function printSubcommandHelp(group: CommandGroup, sub: GroupSubcommand, pkg?: PackageInfo): void {
  const usage = sub.usage ?? `carina ${group.name} ${sub.name} [options]`;
  console.log(`Usage: ${usage}\n`);
  console.log(sub.description);
  if (sub.options?.length) {
    console.log('\nOptions:');
    for (const opt of sub.options) console.log(`  ${opt}`);
  }
  if (sub.examples?.length) {
    console.log('\nExamples:');
    for (const ex of sub.examples) console.log(`  ${ex}`);
  }
  console.log('');
  if (pkg) console.log(`Carina v${pkg.version}`);
}

export async function dispatchGroup(
  group: CommandGroup,
  args: string[],
  pkg?: PackageInfo,
): Promise<void> {
  const ctx = parseGroupContext(args);
  const subToken = ctx.positional[0];

  if (ctx.help && !subToken) {
    printGroupHelp(group, pkg);
    return;
  }

  const sub = resolveSubcommand(group, subToken);
  if (ctx.help && sub) {
    printSubcommandHelp(group, sub, pkg);
    return;
  }

  if (sub) {
    const subCtx: GroupContext = {
      ...ctx,
      positional: ctx.positional.slice(1),
    };
    await sub.handler(subCtx);
    return;
  }

  if (!sub) {
    if (group.legacyHandler) {
      await group.legacyHandler(args);
      return;
    }
    printGroupHelp(group, pkg);
    return;
  }
}

export function outputJson(value: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
}
