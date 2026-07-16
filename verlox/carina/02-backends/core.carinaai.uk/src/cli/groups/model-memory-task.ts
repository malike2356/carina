import chalk from 'chalk';
import {
  buildCatalogRows,
  formatCompactCatalogLine,
  formatProviderCatalogHeader,
} from '../../brain/provider-catalog.js';
import { providerCostLabel } from '../../brain/provider-tags.js';
import { PROVIDER_MAP } from '../../brain/provider-registry.js';
import { loadFromYaml, setConfigValue } from '../config/loader.js';
import type { CommandGroup, GroupContext } from '../group-command.js';

export const modelGroup: CommandGroup = {
  name: 'model',
  aliases: ['m'],
  summary: 'List, set, and test LLM providers and models',
  loadEnv: true,
  legacyHandler: async (args) => {
    const { runModelCommand } = await import('../commands/model.js');
    await runModelCommand(args);
  },
  subcommands: [
    {
      name: 'list',
      aliases: ['ls'],
      description: 'List available models per provider',
      options: ['--json  Output as JSON'],
      examples: ['carina model list', 'carina m ls --json'],
      handler: async (ctx: GroupContext) => {
        const config = await loadFromYaml();
        const rows = buildCatalogRows({ includeCatalogOnly: true });
        const payload = {
          active: { provider: config.provider, model: config.model },
          providers: rows.map((row) => ({
            id: row.id,
            displayName: row.displayName,
            configured: row.configured,
            routable: row.routable,
            model: row.model,
            cost: providerCostLabel(row.costTag),
            status: row.status,
          })),
        };
        if (ctx.json) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }
        console.log(chalk.bold('\nProviders\n'));
        console.log(chalk.gray(formatProviderCatalogHeader()));
        for (const row of rows) {
          console.log(`  ${formatCompactCatalogLine(row)}`);
        }
        console.log(`\nActive: ${config.provider} / ${config.model}\n`);
      },
    },
    {
      name: 'use',
      description: 'Set active model',
      usage: 'carina model use <provider> <model>',
      handler: async (ctx: GroupContext) => {
        const provider = ctx.positional[0];
        const model = ctx.positional[1];
        if (!provider || !model) {
          console.error('Usage: carina model use <provider> <model>');
          process.exit(1);
        }
        if (!PROVIDER_MAP[provider]) {
          console.error(`Unknown provider: ${provider}`);
          process.exit(1);
        }
        await setConfigValue('provider', provider);
        await setConfigValue('model', model);
        if (ctx.json) {
          console.log(JSON.stringify({ provider, model }, null, 2));
          return;
        }
        console.log(chalk.green(`Model set to ${provider}/${model}`));
      },
    },
    {
      name: 'current',
      aliases: ['.'],
      description: 'Show current model',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const config = await loadFromYaml();
        const payload = { provider: config.provider, model: config.model };
        if (ctx.json) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }
        console.log(`${config.provider}/${config.model}`);
      },
    },
    {
      name: 'test',
      description: 'Send a test prompt to the current model',
      usage: 'carina model test [provider]',
      handler: async (ctx: GroupContext) => {
        const { runModelCommand } = await import('../commands/model.js');
        await runModelCommand(['test', ...ctx.positional]);
      },
    },
    {
      name: 'cost',
      description: 'Show cost per 1K tokens for all models',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const rows = buildCatalogRows({ includeCatalogOnly: true }).map((row) => ({
          provider: row.id,
          displayName: row.displayName,
          costTag: row.costTag,
          costLabel: providerCostLabel(row.costTag),
        }));
        if (ctx.json) {
          console.log(JSON.stringify(rows, null, 2));
          return;
        }
        console.log(chalk.bold('\nProvider cost tags\n'));
        for (const row of rows) {
          console.log(`  ${row.provider.padEnd(16)} ${row.costLabel}`);
        }
        console.log('');
      },
    },
    {
      name: 'benchmark',
      aliases: ['bench'],
      description: 'Run latency benchmark across providers',
      usage: 'carina model benchmark [options]',
      handler: async (ctx: GroupContext) => {
        const { runBenchmarkCommand } = await import('../commands/benchmark-cli.js');
        await runBenchmarkCommand(['run', ...ctx.rawArgs.filter((a) => a !== 'benchmark')]);
      },
    },
  ],
};

export const memoryGroup: CommandGroup = {
  name: 'memory',
  aliases: ['mem'],
  summary: 'Manage long-term memory',
  loadEnv: true,
  legacyHandler: async (args) => {
    const { runMemoryCommand } = await import('../commands/memory-cli.js');
    await runMemoryCommand(args);
  },
  subcommands: [
    {
      name: 'list',
      aliases: ['ls'],
      description: 'List recent memories',
      options: ['--json', '--limit <n>'],
      handler: async (ctx: GroupContext) => {
        const limitIdx = ctx.rawArgs.indexOf('--limit');
        const limit = limitIdx >= 0 ? Number.parseInt(ctx.rawArgs[limitIdx + 1] ?? '20', 10) : 20;
        const { initDb } = await import('../../memory/db.js');
        const { initMemoryBackend } = await import('../../memory/backends/index.js');
        const { listRecentMemories } = await import('../../memory/store.js');
        initMemoryBackend();
        try { await initDb(); } catch { /* optional */ }
        const rows = await listRecentMemories(limit);
        if (ctx.json) {
          console.log(JSON.stringify(rows, null, 2));
          return;
        }
        console.log(chalk.bold(`\nMemories (${rows.length})\n`));
        for (const m of rows) {
          console.log(`  ${m.id.slice(0, 8)}  ${m.content.slice(0, 70)}`);
        }
        console.log('');
      },
    },
    {
      name: 'add',
      description: 'Manually add a memory',
      usage: 'carina memory add <text>',
      handler: async (ctx: GroupContext) => {
        const text = ctx.positional.join(' ');
        if (!text) {
          console.error('Usage: carina memory add <text>');
          process.exit(1);
        }
        const { initDb } = await import('../../memory/db.js');
        const { initMemoryBackend } = await import('../../memory/backends/index.js');
        const { saveMemory, listRecentMemories } = await import('../../memory/store.js');
        initMemoryBackend();
        await initDb();
        const sessionId = process.env.CARINA_SESSION_ID ?? 'cli-manual';
        await saveMemory(sessionId, 'user', text);
        const rows = await listRecentMemories(1);
        if (ctx.json) {
          console.log(JSON.stringify(rows[0] ?? { saved: true, sessionId }, null, 2));
          return;
        }
        console.log(chalk.green(`Saved memory${rows[0] ? ` ${rows[0].id.slice(0, 8)}` : ''}`));
      },
    },
    {
      name: 'search',
      aliases: ['find'],
      description: 'Fuzzy search memories',
      usage: 'carina memory search <query>',
      options: ['--json', '--limit <n>'],
      handler: async (ctx: GroupContext) => {
        const query = ctx.positional.join(' ');
        if (!query) {
          console.error('Usage: carina memory search <query>');
          process.exit(1);
        }
        const limitIdx = ctx.rawArgs.indexOf('--limit');
        const limit = limitIdx >= 0 ? Number.parseInt(ctx.rawArgs[limitIdx + 1] ?? '10', 10) : 10;
        const { initDb } = await import('../../memory/db.js');
        const { initMemoryBackend } = await import('../../memory/backends/index.js');
        const { searchMemory } = await import('../../memory/store.js');
        initMemoryBackend();
        await initDb();
        const rows = await searchMemory(query, limit);
        if (ctx.json) {
          console.log(JSON.stringify(rows, null, 2));
          return;
        }
        for (const m of rows) {
          console.log(`  ${m.id.slice(0, 8)}  ${m.content.slice(0, 80)}`);
        }
      },
    },
    {
      name: 'delete',
      aliases: ['rm'],
      description: 'Delete a memory by ID',
      usage: 'carina memory delete <id>',
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        if (!id) {
          console.error('Usage: carina memory delete <id>');
          process.exit(1);
        }
        const { initDb } = await import('../../memory/db.js');
        const { deleteMemory } = await import('../../memory/store.js');
        await initDb();
        const ok = await deleteMemory(id);
        if (!ok) {
          console.error(`Memory not found: ${id}`);
          process.exit(1);
        }
        if (ctx.json) {
          console.log(JSON.stringify({ deleted: id }, null, 2));
          return;
        }
        console.log(`Deleted memory ${id}`);
      },
    },
    {
      name: 'clear',
      description: 'Clear all memories (with confirmation)',
      usage: 'carina memory clear [--force]',
      handler: async (ctx: GroupContext) => {
        const force = ctx.rawArgs.includes('--force');
        if (!force) {
          console.error('Refusing to clear without --force');
          process.exit(1);
        }
        const { runMemoryCommand } = await import('../commands/memory-cli.js');
        await runMemoryCommand(['clear', '--force']);
      },
    },
    {
      name: 'export',
      description: 'Export all memories to JSON',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { initDb } = await import('../../memory/db.js');
        const { listRecentMemories } = await import('../../memory/store.js');
        await initDb();
        const rows = await listRecentMemories(5000);
        console.log(JSON.stringify(rows, null, 2));
      },
    },
    {
      name: 'stats',
      description: 'Count memories by type and date',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { initDb } = await import('../../memory/db.js');
        const { listRecentMemories } = await import('../../memory/store.js');
        await initDb();
        const rows = await listRecentMemories(5000);
        const byRole: Record<string, number> = {};
        for (const row of rows) {
          const key = row.role ?? 'unknown';
          byRole[key] = (byRole[key] ?? 0) + 1;
        }
        const payload = { total: rows.length, byRole, newest: rows[0]?.createdAt ?? null };
        if (ctx.json) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }
        console.log(`Total memories: ${payload.total}`);
        for (const [role, count] of Object.entries(byRole)) {
          console.log(`  ${role}: ${count}`);
        }
      },
    },
    {
      name: 'sync',
      description: 'Force sync memories to/from gateway',
      handler: async (ctx: GroupContext) => {
        const { runMemoryCommand } = await import('../commands/memory-cli.js');
        await runMemoryCommand(['reindex', ...(ctx.json ? ['--json'] : [])]);
      },
    },
  ],
};

export const taskGroup: CommandGroup = {
  name: 'task',
  aliases: ['t'],
  summary: 'Manage background tasks, cron jobs, and taskflows',
  loadEnv: true,
  legacyHandler: async (args) => {
    const { runTasksCommand } = await import('../commands/tasks-cli.js');
    await runTasksCommand(args);
  },
  subcommands: [
    {
      name: 'list',
      aliases: ['ls'],
      description: 'List active and recent tasks',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runTasksCommand } = await import('../commands/tasks-cli.js');
        await runTasksCommand(['all', ...(ctx.json ? ['--json'] : [])]);
      },
    },
    {
      name: 'create',
      aliases: ['new'],
      description: 'Create a task (cron job)',
      usage: 'carina task create <name> <schedule>',
      handler: async (ctx: GroupContext) => {
        const { runCronCommand } = await import('../commands/cron.js');
        await runCronCommand('add', undefined, ctx.positional);
      },
    },
    {
      name: 'status',
      aliases: ['s'],
      description: 'Show task status by ID',
      usage: 'carina task status <id>',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        const { listProcesses } = await import('../../tools/process-registry.js');
        const { listJobs } = await import('../../agents/cron-scheduler.js');
        const processes = listProcesses().filter((p) => p.session_id.startsWith(id ?? ''));
        const cron = (await listJobs()).filter((j) => j.id.startsWith(id ?? '') || (j.name ?? '').includes(id ?? ''));
        const payload = { processes, cron };
        if (ctx.json) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }
        if (!id) {
          console.error('Usage: carina task status <id>');
          process.exit(1);
        }
        console.log(JSON.stringify(payload, null, 2));
      },
    },
    {
      name: 'cancel',
      aliases: ['rm'],
      description: 'Cancel a running task',
      usage: 'carina task cancel <id>',
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        if (!id) {
          console.error('Usage: carina task cancel <id>');
          process.exit(1);
        }
        const { killProcess } = await import('../../tools/process-registry.js');
        const result = await killProcess(id);
        if (ctx.json) {
          console.log(JSON.stringify({ ...result, id }, null, 2));
          return;
        }
        console.log(result.status === 'killed' ? chalk.green(`Cancelled ${id}`) : chalk.yellow(`Process ${id} status: ${result.status}`));
      },
    },
    {
      name: 'watch',
      aliases: ['w'],
      description: 'Stream task output in real time',
      usage: 'carina task watch <id>',
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        if (!id) {
          console.error('Usage: carina task watch <id>');
          process.exit(1);
        }
        const { getProcessLog } = await import('../../tools/process-registry.js');
        try {
          const log = getProcessLog(id, -200, 200);
          if (ctx.json) {
            console.log(JSON.stringify(log, null, 2));
            return;
          }
          for (const line of log.lines) console.log(line);
        } catch (err) {
          console.error(String(err instanceof Error ? err.message : err));
          process.exit(1);
        }
      },
    },
    {
      name: 'export',
      description: 'Export task list to JSON',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runTasksCommand } = await import('../commands/tasks-cli.js');
        await runTasksCommand(['all', '--json']);
      },
    },
  ],
};
