import fsp from 'fs/promises';
import chalk from 'chalk';
import type { CommandGroup, GroupContext } from '../group-command.js';
import {
  addEvidence,
  appendDailyLog,
  bootstrapVault,
  closeInvestigation,
  createInvestigation,
  findCasePath,
  getConfig,
  getVaultStats,
  resolveVaultPath,
  searchVault,
  slugifyCaseId,
  upsertTarget,
  writeDashboard,
  type InvestigationSeverity,
} from '../../integrations/obsidian-vault.js';

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx < 0) return undefined;
  return args[idx + 1];
}

function parseListFlag(args: string[], flag: string): string[] {
  const value = parseFlag(args, flag);
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function tokensAfterAction(rawArgs: string[], action: string): string[] {
  const idx = rawArgs.indexOf(action);
  if (idx < 0) return [];
  const parts: string[] = [];
  for (let i = idx + 1; i < rawArgs.length; i++) {
    const arg = rawArgs[i]!;
    if (arg.startsWith('--')) break;
    parts.push(arg);
  }
  return parts;
}

function requireVaultConfigured(): void {
  const vp = resolveVaultPath();
  if (!vp) {
    console.error(chalk.red('OBSIDIAN_VAULT_PATH is not configured.'));
    process.exit(1);
  }
}

async function handleCase(ctx: GroupContext): Promise<void> {
  const action = ctx.positional[0];
  const config = getConfig();

  if (action === 'new') {
    const title = tokensAfterAction(ctx.rawArgs, 'new').join(' ').trim();
    if (!title) {
      console.error('Usage: carina obsidian case new "<title>" [--severity level] [--cvss N] [--org name] [--targets a,b] [--tags a,b]');
      process.exit(1);
    }
    const severity = (parseFlag(ctx.rawArgs, '--severity') ?? 'medium') as InvestigationSeverity;
    const cvss = Number.parseFloat(parseFlag(ctx.rawArgs, '--cvss') ?? '0');
    const org = parseFlag(ctx.rawArgs, '--org') ?? 'unknown';
    const targets = parseListFlag(ctx.rawArgs, '--targets');
    const tags = parseListFlag(ctx.rawArgs, '--tags');
    const caseId = slugifyCaseId(title);

    await bootstrapIfNeeded(config);
    const casePath = await createInvestigation(config, {
      caseId,
      title,
      severity,
      cvss,
      tags,
      targets: targets.length > 0 ? targets : ['unknown-target'],
      org,
    });
    await appendDailyLog(config, { investigations: [caseId], toolsRun: 0, findingsConfirmed: 0 });

    if (ctx.json) {
      console.log(JSON.stringify({ caseId, casePath }, null, 2));
      return;
    }
    console.log(chalk.green(`Created investigation ${caseId}`));
    console.log(chalk.gray(casePath));
    return;
  }

  if (action === 'close') {
    const caseId = tokensAfterAction(ctx.rawArgs, 'close')[0];
    if (!caseId) {
      console.error('Usage: carina obsidian case close <case-id>');
      process.exit(1);
    }
    const casePath = await closeInvestigation(config, caseId);
    if (ctx.json) {
      console.log(JSON.stringify({ caseId, casePath, status: 'closed' }, null, 2));
      return;
    }
    console.log(chalk.green(`Closed investigation ${caseId}`));
    console.log(chalk.gray(casePath));
    return;
  }

  console.error('Usage: carina obsidian case <new|close> ...');
  process.exit(1);
}

async function handleEvidence(ctx: GroupContext): Promise<void> {
  const action = ctx.positional[0];
  if (action !== 'add') {
    console.error('Usage: carina obsidian evidence add <case-id> --tool <name> --scan-type <type> [--output file]');
    process.exit(1);
  }

  const config = getConfig();
  const caseId = tokensAfterAction(ctx.rawArgs, 'add')[0];
  const tool = parseFlag(ctx.rawArgs, '--tool');
  const scanType = parseFlag(ctx.rawArgs, '--scan-type') ?? 'scan';
  const target = parseFlag(ctx.rawArgs, '--target') ?? 'unknown';
  const outputPath = parseFlag(ctx.rawArgs, '--output');
  const scanId = parseFlag(ctx.rawArgs, '--scan-id') ?? `scan_${Date.now()}`;
  const duration = Number.parseFloat(parseFlag(ctx.rawArgs, '--duration') ?? '0');

  if (!caseId || !tool) {
    console.error('Usage: carina obsidian evidence add <case-id> --tool <name> --scan-type <type> [--output file]');
    process.exit(1);
  }

  let output = `Evidence captured at ${new Date().toISOString()}`;
  if (outputPath) {
    output = await fsp.readFile(outputPath, 'utf-8');
  }

  const casePath = await findCasePath(config, caseId);
  if (!casePath) {
    console.error(chalk.red(`Investigation not found: ${caseId}`));
    process.exit(1);
  }

  const evidencePath = await addEvidence(config, {
    caseId,
    casePath,
    tool,
    scanType,
    scanId,
    target,
    output,
    status: 'completed',
    durationSeconds: duration,
  });

  if (ctx.json) {
    console.log(JSON.stringify({ caseId, evidencePath }, null, 2));
    return;
  }
  console.log(chalk.green(`Evidence note created for ${caseId}`));
  console.log(chalk.gray(evidencePath));
}

async function handleTarget(ctx: GroupContext): Promise<void> {
  const action = ctx.positional[0];
  if (action !== 'add') {
    console.error('Usage: carina obsidian target add <name> [--org name] [--ips a,b]');
    process.exit(1);
  }

  const config = getConfig();
  const name = tokensAfterAction(ctx.rawArgs, 'add')[0];
  if (!name) {
    console.error('Usage: carina obsidian target add <name> [--org name] [--ips a,b]');
    process.exit(1);
  }

  await bootstrapIfNeeded(config);
  const targetPath = await upsertTarget(config, name, {
    domain: name,
    org: parseFlag(ctx.rawArgs, '--org'),
    ips: parseListFlag(ctx.rawArgs, '--ips'),
    tags: parseListFlag(ctx.rawArgs, '--tags'),
  });

  if (ctx.json) {
    console.log(JSON.stringify({ name, targetPath }, null, 2));
    return;
  }
  console.log(chalk.green(`Target profile saved: ${name}`));
  console.log(chalk.gray(targetPath));
}

async function handleLog(ctx: GroupContext): Promise<void> {
  const action = ctx.positional[0];
  if (action !== 'today') {
    console.error('Usage: carina obsidian log today');
    process.exit(1);
  }

  const config = getConfig();
  await bootstrapIfNeeded(config);
  const logPath = await appendDailyLog(config, {
    investigations: [],
    toolsRun: 0,
    findingsConfirmed: 0,
  });

  if (ctx.json) {
    console.log(JSON.stringify({ logPath }, null, 2));
    return;
  }
  console.log(chalk.green("Today's daily log"));
  console.log(chalk.gray(logPath));
}

async function handleVault(ctx: GroupContext): Promise<void> {
  const action = ctx.positional[0];
  if (action !== 'stats') {
    console.error('Usage: carina obsidian vault stats');
    process.exit(1);
  }

  const config = getConfig();
  const stats = await getVaultStats(config);

  if (ctx.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log(chalk.bold('\nObsidian vault stats\n'));
  console.log(`  Open investigations: ${stats.openInvestigations}`);
  console.log(`  Closed investigations: ${stats.closedInvestigations}`);
  console.log(`  Targets monitored: ${stats.targetsMonitored}`);
  console.log(`  Evidence files: ${stats.evidenceFiles}`);
  console.log(`  Total case notes: ${stats.totalCaseNotes}`);
  console.log(`  Vault size: ${formatBytes(stats.vaultSizeBytes)}`);
  console.log(chalk.gray(`  Path: ${config.vaultPath}`));
  console.log('');
}

async function bootstrapIfNeeded(config: ReturnType<typeof getConfig>): Promise<void> {
  try {
    await fsp.access(`${config.vaultPath}/Dashboard.md`);
  } catch {
    await bootstrapVault(config);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export const obsidianGroup: CommandGroup = {
  name: 'obsidian',
  summary: 'Obsidian vault integration for investigation knowledge base',
  loadEnv: true,
  subcommands: [
    {
      name: 'init',
      description: 'Bootstrap vault structure, templates, playbooks, and tool notes',
      options: ['--json'],
      handler: async (ctx) => {
        requireVaultConfigured();
        const config = getConfig();
        await bootstrapVault(config);
        if (ctx.json) {
          console.log(JSON.stringify({ vaultPath: config.vaultPath, initialized: true }, null, 2));
          return;
        }
        console.log(chalk.green('Obsidian vault initialized'));
        console.log(chalk.gray(config.vaultPath));
      },
    },
    {
      name: 'dashboard',
      description: 'Regenerate Dashboard.md with latest stats',
      options: ['--json'],
      handler: async (ctx) => {
        const config = getConfig();
        await bootstrapIfNeeded(config);
        await writeDashboard(config.vaultPath, config);
        if (ctx.json) {
          console.log(JSON.stringify({ dashboard: `${config.vaultPath}/Dashboard.md` }, null, 2));
          return;
        }
        console.log(chalk.green('Dashboard regenerated'));
        console.log(chalk.gray(`${config.vaultPath}/Dashboard.md`));
      },
    },
    {
      name: 'case',
      description: 'Create or close investigation case notes',
      usage: 'carina obsidian case <new|close> ...',
      options: [
        '--severity critical|high|medium|low|info',
        '--cvss <score>',
        '--org <name>',
        '--targets a,b',
        '--tags a,b',
        '--json',
      ],
      handler: handleCase,
    },
    {
      name: 'evidence',
      description: 'Add evidence note to a case',
      usage: 'carina obsidian evidence add <case-id> --tool <name> --scan-type <type> [--output file]',
      options: ['--tool <name>', '--scan-type <type>', '--target <host>', '--output <file>', '--scan-id <id>', '--duration <seconds>', '--json'],
      handler: handleEvidence,
    },
    {
      name: 'target',
      description: 'Create or update a target profile',
      usage: 'carina obsidian target add <name> [--org name] [--ips a,b]',
      options: ['--org <name>', '--ips a,b', '--tags a,b', '--json'],
      handler: handleTarget,
    },
    {
      name: 'log',
      description: 'Open or create daily log note',
      usage: 'carina obsidian log today',
      options: ['--json'],
      handler: handleLog,
    },
    {
      name: 'search',
      description: 'Search investigations and target notes',
      usage: 'carina obsidian search <query>',
      options: ['--json'],
      handler: async (ctx) => {
        const query = tokensAfterAction(ctx.rawArgs, 'search').join(' ').trim();
        if (!query) {
          console.error('Usage: carina obsidian search <query>');
          process.exit(1);
        }
        const config = getConfig();
        const results = await searchVault(config, query);
        if (ctx.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }
        console.log(chalk.bold(`\nSearch results for "${query}" (${results.length})\n`));
        for (const row of results) {
          console.log(`  [${row.type}] ${row.title}`);
          console.log(chalk.gray(`    ${row.path}`));
        }
        console.log('');
      },
    },
    {
      name: 'vault',
      description: 'Vault statistics',
      usage: 'carina obsidian vault stats',
      options: ['--json'],
      handler: handleVault,
    },
  ],
};
