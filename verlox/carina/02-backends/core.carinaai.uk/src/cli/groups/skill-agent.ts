import chalk from 'chalk';
import { listSubagentMetrics } from '../../telemetry/subagent-metrics.js';
import { buildSkillIndex } from '../../skills/index.js';
import type { CommandGroup, GroupContext } from '../group-command.js';

export const skillGroup: CommandGroup = {
  name: 'skill',
  aliases: ['sk'],
  summary: 'Manage skill packs and CarinaHub installs',
  loadEnv: true,
  subcommands: [
    {
      name: 'list',
      aliases: ['ls'],
      description: 'List installed skill packs',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const index = await buildSkillIndex();
        const rows = index.map((e) => ({
          name: e.name,
          source: e.source,
          version: e.version,
          enabled: !e.gated,
          description: e.description,
        }));
        if (ctx.json) {
          console.log(JSON.stringify(rows, null, 2));
          return;
        }
        console.log(chalk.bold(`\nSkills (${rows.length})\n`));
        for (const row of rows.slice(0, 40)) {
          console.log(`  ${row.name.padEnd(24)} ${row.source.padEnd(10)} ${row.description.slice(0, 50)}`);
        }
        console.log('');
      },
    },
    {
      name: 'search',
      aliases: ['find'],
      description: 'Search the CarinaHub for skills',
      usage: 'carina skill search <query>',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const query = ctx.positional.join(' ');
        const { runHubCommand } = await import('../commands/hub-cli.js');
        await runHubCommand(['search', query, ...(ctx.json ? ['--json'] : [])]);
      },
    },
    {
      name: 'install',
      aliases: ['i'],
      description: 'Install a skill pack',
      usage: 'carina skill install <slug>',
      handler: async (ctx: GroupContext) => {
        const slug = ctx.positional[0];
        if (!slug) {
          console.error('Usage: carina skill install <slug>');
          process.exit(1);
        }
        const { installPackSlug } = await import('../commands/pack/install.js');
        const result = await installPackSlug(slug);
        if (ctx.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        console.log(chalk.green(`Installed ${result.name}@${result.version}`));
      },
    },
    {
      name: 'uninstall',
      aliases: ['rm'],
      description: 'Uninstall a skill pack',
      usage: 'carina skill uninstall <slug>',
      handler: async (ctx: GroupContext) => {
        const slug = ctx.positional[0];
        if (!slug) {
          console.error('Usage: carina skill uninstall <slug>');
          process.exit(1);
        }
        const { runHubCommand } = await import('../commands/hub-cli.js');
        await runHubCommand(['remove', `pack:${slug}`, ...(ctx.json ? ['--json'] : [])]);
      },
    },
    {
      name: 'enable',
      aliases: ['on'],
      description: 'Enable a skill pack',
      usage: 'carina skill enable <slug>',
      handler: async (ctx: GroupContext) => {
        const slug = ctx.positional[0];
        if (!slug) {
          console.error('Usage: carina skill enable <slug>');
          process.exit(1);
        }
        const { runHubCommand } = await import('../commands/hub-cli.js');
        await runHubCommand(['enable', `pack:${slug}`]);
      },
    },
    {
      name: 'disable',
      aliases: ['off'],
      description: 'Disable a skill pack',
      usage: 'carina skill disable <slug>',
      handler: async (ctx: GroupContext) => {
        const slug = ctx.positional[0];
        if (!slug) {
          console.error('Usage: carina skill disable <slug>');
          process.exit(1);
        }
        const { runHubCommand } = await import('../commands/hub-cli.js');
        await runHubCommand(['disable', `pack:${slug}`]);
      },
    },
    {
      name: 'info',
      description: 'Show detail for an installed skill',
      usage: 'carina skill info <name>',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const name = ctx.positional[0];
        if (!name) {
          console.error('Usage: carina skill info <name>');
          process.exit(1);
        }
        const index = await buildSkillIndex();
        const entry = index.find((e) => e.name === name);
        if (!entry) {
          console.error(`Skill not found: ${name}`);
          process.exit(1);
        }
        if (ctx.json) {
          console.log(JSON.stringify(entry, null, 2));
          return;
        }
        console.log(`${entry.name} (${entry.source})`);
        console.log(entry.description);
        if (entry.version) console.log(`version: ${entry.version}`);
      },
    },
    {
      name: 'update',
      aliases: ['up'],
      description: 'Update all installed skills',
      handler: async (ctx: GroupContext) => {
        const { runHubCommand } = await import('../commands/hub-cli.js');
        await runHubCommand(['update', ...(ctx.json ? ['--json'] : [])]);
      },
    },
    {
      name: 'publish',
      aliases: ['pub'],
      description: 'Publish a local skill to the hub',
      usage: 'carina skill publish [path]',
      handler: async (ctx: GroupContext) => {
        const { runHubCommand } = await import('../commands/hub-cli.js');
        await runHubCommand(['publish', ...ctx.positional]);
      },
    },
  ],
};

export const agentGroup: CommandGroup = {
  name: 'agent',
  aliases: ['a'],
  summary: 'Inspect and control subagents',
  loadEnv: true,
  subcommands: [
    {
      name: 'list',
      aliases: ['ls'],
      description: 'List active subagents',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const active = listSubagentMetrics(50).filter((m) => m.status === 'started');
        if (ctx.json) {
          console.log(JSON.stringify(active, null, 2));
          return;
        }
        console.log(chalk.bold('\nActive subagents\n'));
        for (const m of active) {
          console.log(`  ${m.sessionId.slice(0, 8)}  ${m.agentType}  ${m.ts}`);
        }
        console.log('');
      },
    },
    {
      name: 'status',
      aliases: ['s'],
      description: 'Show status of a subagent by ID',
      usage: 'carina agent status <id>',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        const rows = listSubagentMetrics(100).filter((m) => !id || m.sessionId.startsWith(id));
        if (ctx.json) {
          console.log(JSON.stringify(rows, null, 2));
          return;
        }
        if (rows.length === 0) {
          console.log('No matching subagent metrics.');
          return;
        }
        for (const m of rows) {
          console.log(`${m.sessionId.slice(0, 8)}  ${m.agentType}  ${m.status}  ${m.latencyMs ?? '-'}ms`);
        }
      },
    },
    {
      name: 'cancel',
      aliases: ['rm'],
      description: 'Cancel a running subagent',
      usage: 'carina agent cancel <session-id>',
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        if (!id) {
          console.error('Usage: carina agent cancel <session-id>');
          process.exit(1);
        }
        const { killProcess } = await import('../../tools/process-registry.js');
        try {
          const result = await killProcess(id);
          if (ctx.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
          }
          console.log(chalk.green(`Cancelled ${id}`));
        } catch (err) {
          console.error(String(err instanceof Error ? err.message : err));
          process.exit(1);
        }
      },
    },
    {
      name: 'logs',
      description: "Stream a subagent's output",
      usage: 'carina agent logs <session-id>',
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        if (!id) {
          console.error('Usage: carina agent logs <session-id>');
          process.exit(1);
        }
        const { getProcessLog } = await import('../../tools/process-registry.js');
        const log = getProcessLog(id, -200, 200);
        if (ctx.json) {
          console.log(JSON.stringify(log, null, 2));
          return;
        }
        for (const line of log.lines) console.log(line);
      },
    },
    {
      name: 'spawn',
      aliases: ['run'],
      description: 'Manually spawn a subagent with a task',
      usage: 'carina agent spawn <type> <task...>',
      handler: async (ctx: GroupContext) => {
        const type = ctx.positional[0] ?? 'research';
        const task = ctx.positional.slice(1).join(' ');
        if (!task) {
          console.error('Usage: carina agent spawn <type> <task...>');
          process.exit(1);
        }
        const { spawnBackgroundProcess } = await import('../../tools/process-registry.js');
        const proc = await spawnBackgroundProcess(
          `carina chat --subagent ${type} --task ${JSON.stringify(task)}`,
          { label: `subagent:${type}` },
        );
        if (ctx.json) {
          console.log(JSON.stringify({ sessionId: proc.sessionId, status: proc.status, command: proc.command }, null, 2));
          return;
        }
        console.log(chalk.green(`Spawned subagent ${proc.sessionId.slice(0, 8)} (${type})`));
      },
    },
    {
      name: 'history',
      aliases: ['hist'],
      description: 'List completed/failed agents (last 50)',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const rows = listSubagentMetrics(50).filter((m) => m.status !== 'started');
        if (ctx.json) {
          console.log(JSON.stringify(rows, null, 2));
          return;
        }
        for (const m of rows) {
          console.log(`  ${m.sessionId.slice(0, 8)}  ${m.agentType}  ${m.status}  ${m.ts}`);
        }
      },
    },
  ],
};
