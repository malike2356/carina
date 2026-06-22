import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { CARINA_HOME } from '../../config/paths.js';
import { initDb } from '../../memory/db.js';
import { listSubscriptions } from '../../webhooks/store.js';
import { listDeliveries } from '../../webhooks/webhook-delivery.js';
import { buildScoutSnapshot } from '../../tui/panels/scout-panel.js';
import { readSecurityAuditTail } from '../../security/security-audit.js';
import {
  _resetSuspendedFlag,
  isSuspended,
} from '../../security/kill-switch-listener.js';
import type { CommandGroup, GroupContext } from '../group-command.js';

export const webhookGroup: CommandGroup = {
  name: 'webhook',
  aliases: ['wh'],
  summary: 'Manage outbound webhook subscriptions',
  loadEnv: true,
  subcommands: [
    {
      name: 'list',
      aliases: ['ls'],
      description: 'List configured webhooks',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        await initDb();
        const rows = await listSubscriptions(true);
        if (ctx.json) {
          console.log(JSON.stringify(rows, null, 2));
          return;
        }
        console.log(chalk.bold(`\nWebhooks (${rows.length})\n`));
        for (const w of rows) {
          console.log(`  ${w.id.slice(0, 8)}  ${w.active ? 'active' : 'off'}  ${w.url}`);
        }
        console.log('');
      },
    },
    {
      name: 'create',
      aliases: ['new'],
      description: 'Create a webhook endpoint',
      usage: 'carina webhook create <url> [event...]',
      handler: async (ctx: GroupContext) => {
        const url = ctx.positional[0];
        const events = ctx.positional.slice(1);
        if (!url) {
          console.error('Usage: carina webhook create <url> [event...]');
          process.exit(1);
        }
        await initDb();
        const { createSubscription } = await import('../../webhooks/store.js');
        const { WEBHOOK_EVENTS } = await import('../../webhooks/webhook-types.js');
        const chosen = events.length > 0 ? events : [...WEBHOOK_EVENTS];
        const sub = await createSubscription(url, chosen as never);
        if (ctx.json) {
          console.log(JSON.stringify(sub, null, 2));
          return;
        }
        console.log(chalk.green(`Created webhook ${sub.id.slice(0, 8)}`));
        console.log(chalk.gray(`Secret: ${sub.secret}`));
      },
    },
    {
      name: 'delete',
      aliases: ['rm'],
      description: 'Delete a webhook',
      usage: 'carina webhook delete <id>',
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        if (!id) {
          console.error('Usage: carina webhook delete <id>');
          process.exit(1);
        }
        await initDb();
        const { removeSubscription } = await import('../../webhooks/store.js');
        await removeSubscription(id);
        if (ctx.json) {
          console.log(JSON.stringify({ deleted: id }, null, 2));
          return;
        }
        console.log(`Deactivated webhook ${id}`);
      },
    },
    {
      name: 'test',
      description: 'Send a test payload to a webhook',
      usage: 'carina webhook test <id>',
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        if (!id) {
          console.error('Usage: carina webhook test <id>');
          process.exit(1);
        }
        await initDb();
        const { deliverToSubscription } = await import('../../webhooks/dispatcher.js');
        const result = await deliverToSubscription(id, 'agent.turn.complete', {
          test: true,
          source: 'carina-cli',
        });
        if (ctx.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        console.log(result.delivered ? chalk.green('Delivered') : chalk.yellow('Delivery failed'));
      },
    },
    {
      name: 'logs',
      description: 'Show recent webhook delivery logs',
      options: ['--json', '--limit <n>'],
      handler: async (ctx: GroupContext) => {
        await initDb();
        const limitIdx = ctx.rawArgs.indexOf('--limit');
        const limit = limitIdx >= 0 ? Number.parseInt(ctx.rawArgs[limitIdx + 1] ?? '20', 10) : 20;
        const rows = await listDeliveries({ limit });
        if (ctx.json) {
          console.log(JSON.stringify(rows, null, 2));
          return;
        }
        for (const d of rows) {
          console.log(`  ${d.id.slice(0, 8)}  ${d.status}  ${d.event}  attempts=${d.attemptCount}`);
        }
      },
    },
  ],
};

async function readMcpServersFile(): Promise<Array<Record<string, unknown>>> {
  const file = path.join(CARINA_HOME, 'resources', 'claude-import', 'mcp-servers.json');
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as { servers?: Array<Record<string, unknown>> };
    return parsed.servers ?? [];
  } catch {
    return [];
  }
}

export const mcpGroup: CommandGroup = {
  name: 'mcp',
  summary: 'Manage MCP server definitions and tool exposure',
  loadEnv: true,
  legacyHandler: async (args) => {
    const { runMcpCommand } = await import('../commands/mcp-server-cli.js');
    await runMcpCommand(args);
  },
  subcommands: [
    {
      name: 'connect',
      description: 'Connect to an external MCP server and discover tools',
      usage: 'carina mcp connect <url-or-package> [name]',
      options: ['--json', '-y', '--yes'],
      handler: async (ctx: GroupContext) => {
        const { runMcpClientCommand } = await import('../commands/mcp-client-cli.js');
        await runMcpClientCommand('connect', [...ctx.positional, ...(ctx.json ? ['--json'] : []), ...(ctx.rawArgs.includes('-y') ? ['-y'] : [])]);
      },
    },
    {
      name: 'disconnect',
      description: 'Disconnect a connected MCP server',
      usage: 'carina mcp disconnect <name>',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runMcpClientCommand } = await import('../commands/mcp-client-cli.js');
        await runMcpClientCommand('disconnect', [...ctx.positional, ...(ctx.json ? ['--json'] : [])]);
      },
    },
    {
      name: 'doctor',
      description: 'Diagnose MCP environment and connections',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runMcpClientCommand } = await import('../commands/mcp-client-cli.js');
        await runMcpClientCommand('doctor', ctx.rawArgs.filter((a) => a !== 'doctor'));
      },
    },
    {
      name: 'permissions',
      description: 'View MCP tool permissions',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runMcpClientCommand } = await import('../commands/mcp-client-cli.js');
        await runMcpClientCommand('permissions', ctx.rawArgs.filter((a) => a !== 'permissions'));
      },
    },
    {
      name: 'connections',
      description: 'List live and persisted MCP connections',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runMcpClientCommand } = await import('../commands/mcp-client-cli.js');
        await runMcpClientCommand('connections', ctx.rawArgs.filter((a) => a !== 'connections'));
      },
    },
    {
      name: 'list',
      description: 'List installed MCP servers',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const servers = await readMcpServersFile();
        const profile = (await import('../../mcp/server/profile-bind.js')).bindMcpProfile();
        const payload = { profile: profile.profileName, servers };
        if (ctx.json) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }
        console.log(chalk.bold('\nMCP servers\n'));
        console.log(`  Profile: ${profile.profileName}`);
        for (const s of servers) {
          console.log(`  ${String(s.name ?? 'unnamed')}  ${String(s.command ?? s.url ?? '')}`);
        }
        console.log('');
      },
    },
    {
      name: 'add',
      description: 'Add an MCP server entry to local import map',
      usage: 'carina mcp add <name> <command...>',
      handler: async (ctx: GroupContext) => {
        const name = ctx.positional[0];
        const command = ctx.positional[1];
        const args = ctx.positional.slice(2);
        if (!name || !command) {
          console.error('Usage: carina mcp add <name> <command> [args...]');
          process.exit(1);
        }
        const file = path.join(CARINA_HOME, 'resources', 'claude-import', 'mcp-servers.json');
        await fs.mkdir(path.dirname(file), { recursive: true });
        const servers = await readMcpServersFile();
        servers.push({ name, command, args });
        await fs.writeFile(file, JSON.stringify({ servers }, null, 2), 'utf-8');
        if (ctx.json) {
          console.log(JSON.stringify({ name, command, args }, null, 2));
          return;
        }
        console.log(chalk.green(`Added MCP server ${name}`));
      },
    },
    {
      name: 'remove',
      description: 'Remove an MCP server',
      usage: 'carina mcp remove <name>',
      handler: async (ctx: GroupContext) => {
        const name = ctx.positional[0];
        if (!name) {
          console.error('Usage: carina mcp remove <name>');
          process.exit(1);
        }
        const file = path.join(CARINA_HOME, 'resources', 'claude-import', 'mcp-servers.json');
        const servers = (await readMcpServersFile()).filter((s) => s.name !== name);
        await fs.writeFile(file, JSON.stringify({ servers }, null, 2), 'utf-8');
        if (ctx.json) {
          console.log(JSON.stringify({ removed: name }, null, 2));
          return;
        }
        console.log(`Removed MCP server ${name}`);
      },
    },
    {
      name: 'test',
      description: 'Test connection to an MCP server',
      usage: 'carina mcp test [profile]',
      handler: async (ctx: GroupContext) => {
        const { runMcpCommand } = await import('../commands/mcp-server-cli.js');
        await runMcpCommand(['status', ...ctx.positional]);
      },
    },
    {
      name: 'tools',
      description: 'List tools exposed by MCP server profile',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { listMcpTools } = await import('../../mcp/server/tool-catalog.js');
        const allowDangerous = process.env.CARINA_MCP_ALLOW_DANGEROUS === 'true';
        const tools = listMcpTools(allowDangerous);
        if (ctx.json) {
          console.log(JSON.stringify(tools.map((t) => ({ name: t.name, description: t.description })), null, 2));
          return;
        }
        for (const t of tools) console.log(`  ${t.name}`);
      },
    },
  ],
};

export const scoutGroup: CommandGroup = {
  name: 'scout',
  aliases: ['sec'],
  summary: 'Security trust score, kill switch, and Scout integration',
  loadEnv: true,
  legacyHandler: async (args) => {
    const { runScoutCommand } = await import('../commands/scout-cli.js');
    await runScoutCommand(args);
  },
  subcommands: [
    {
      name: 'status',
      aliases: ['s'],
      description: 'Show trust score and kill switch status',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const snapshot = buildScoutSnapshot();
        const payload = {
          ...snapshot,
          suspended: isSuspended(),
        };
        if (ctx.json) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }
        console.log(chalk.bold('\nScout / security status\n'));
        console.log(`  Trust score: ${snapshot.trustScore}/100`);
        console.log(`  Kill switch: ${snapshot.killSwitchActive ? chalk.red('ACTIVE') : chalk.green('off')}`);
        if (snapshot.killSwitchReason) console.log(chalk.red(`  Reason: ${snapshot.killSwitchReason}`));
      },
    },
    {
      name: 'events',
      aliases: ['ev'],
      description: 'List recent security events',
      options: ['--json', '--limit <n>'],
      handler: async (ctx: GroupContext) => {
        const limitIdx = ctx.rawArgs.indexOf('--limit');
        const limit = limitIdx >= 0 ? Number.parseInt(ctx.rawArgs[limitIdx + 1] ?? '20', 10) : 20;
        const events = readSecurityAuditTail(limit);
        if (ctx.json) {
          console.log(JSON.stringify(events, null, 2));
          return;
        }
        for (const e of events) {
          console.log(`  ${e.at}  [${e.category}] ${e.action}: ${e.detail}`);
        }
      },
    },
    {
      name: 'pull',
      description: 'Pull open findings and Scout score from the Scout API',
      options: ['--json', '--severity <level>', '--status <status>', '--account-id <uuid>'],
      handler: async (ctx: GroupContext) => {
        const { runScoutPullCommand, formatScoutCliError } = await import('../commands/scout-findings-cli.js');
        try {
          const flags = ctx.rawArgs.filter((a) => a !== 'pull');
          await runScoutPullCommand(flags);
        } catch (err) {
          console.error(chalk.red(formatScoutCliError(err)));
          process.exit(1);
        }
      },
    },
    {
      name: 'investigate',
      aliases: ['inv'],
      description: 'Open an investigation for a Scout finding',
      options: ['--json', '--session <id>'],
      handler: async (ctx: GroupContext) => {
        const { runScoutInvestigateCommand, formatScoutCliError } = await import('../commands/scout-findings-cli.js');
        try {
          const args = [...ctx.positional, ...(ctx.json ? ['--json'] : [])];
          await runScoutInvestigateCommand(args);
        } catch (err) {
          console.error(chalk.red(formatScoutCliError(err)));
          process.exit(1);
        }
      },
    },
    {
      name: 'report',
      aliases: ['rep'],
      description: 'Generate full shield report',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        try {
          const { requireScoutAccess } = await import('../scout-gate.js');
          await requireScoutAccess('scout report');
        } catch (err) {
          if (err instanceof Error && err.name === 'ScoutGateError') {
            console.error(err.message);
            process.exit(1);
          }
          throw err;
        }
        const { runSecurityCommand } = await import('../commands/security-cli.js');
        await runSecurityCommand(['trust', ...(ctx.json ? ['--json'] : [])]);
      },
    },
    {
      name: 'kill',
      description: 'Trigger kill switch (emergency)',
      handler: async (ctx: GroupContext) => {
        const { _setSuspendedFlag } = await import('../../security/kill-switch-listener.js');
        _setSuspendedFlag('Manual kill switch via carina scout kill');
        if (ctx.json) {
          console.log(JSON.stringify({ suspended: true }, null, 2));
          return;
        }
        console.log(chalk.red('Kill switch activated'));
      },
    },
    {
      name: 'reset',
      description: 'Reset kill switch after review',
      handler: async (ctx: GroupContext) => {
        _resetSuspendedFlag();
        if (ctx.json) {
          console.log(JSON.stringify({ suspended: false }, null, 2));
          return;
        }
        console.log(chalk.green('Kill switch reset'));
      },
    },
    {
      name: 'policy',
      aliases: ['pol'],
      description: 'Show current security policy',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runSecurityCommand } = await import('../commands/security-cli.js');
        await runSecurityCommand(['audit', ...(ctx.json ? ['--json'] : [])]);
      },
    },
    {
      name: 'score',
      description: 'Show Scout Score from Scout Engine API',
      options: ['--json', '--days <n>'],
      handler: async (ctx: GroupContext) => {
        const { runScoutScoreCommand, formatScoutProductCliError } = await import('../commands/scout-product-cli.js');
        try {
          await runScoutScoreCommand(ctx.positional.length ? ctx.positional : ['current', ...ctx.rawArgs.filter((a) => a.startsWith('--'))]);
        } catch (err) {
          console.error(chalk.red(formatScoutProductCliError(err)));
          process.exit(1);
        }
      },
    },
    {
      name: 'targets',
      description: 'Manage Scout scan targets',
      usage: 'carina scout targets <list|add|scan> [args]',
      options: ['--json', '--schedule <cadence>', '--fast'],
      handler: async (ctx: GroupContext) => {
        const { runScoutTargetsCommand, formatScoutProductCliError } = await import('../commands/scout-product-cli.js');
        try {
          await runScoutTargetsCommand([...ctx.positional, ...ctx.rawArgs.filter((a) => a.startsWith('--'))]);
        } catch (err) {
          console.error(chalk.red(formatScoutProductCliError(err)));
          process.exit(1);
        }
      },
    },
    {
      name: 'agents',
      description: 'List connected Scout-monitored agents',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runScoutAgentsCommand, formatScoutProductCliError } = await import('../commands/scout-product-cli.js');
        try {
          await runScoutAgentsCommand(ctx.rawArgs.filter((a) => a !== 'agents'));
        } catch (err) {
          console.error(chalk.red(formatScoutProductCliError(err)));
          process.exit(1);
        }
      },
    },
    {
      name: 'alerts',
      description: 'List or test Scout alert rules',
      usage: 'carina scout alerts <list|test> [rule-id]',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runScoutAlertsCommand, formatScoutProductCliError } = await import('../commands/scout-product-cli.js');
        try {
          await runScoutAlertsCommand([...ctx.positional, ...ctx.rawArgs.filter((a) => a.startsWith('--'))]);
        } catch (err) {
          console.error(chalk.red(formatScoutProductCliError(err)));
          process.exit(1);
        }
      },
    },
    {
      name: 'compliance',
      description: 'Show or export Scout compliance score',
      usage: 'carina scout compliance [export]',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runScoutComplianceCommand, formatScoutProductCliError } = await import('../commands/scout-product-cli.js');
        try {
          await runScoutComplianceCommand([...ctx.positional, ...ctx.rawArgs.filter((a) => a.startsWith('--'))]);
        } catch (err) {
          console.error(chalk.red(formatScoutProductCliError(err)));
          process.exit(1);
        }
      },
    },
  ],
};
