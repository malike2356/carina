import fs from 'fs/promises';
import YAML from 'yaml';
import chalk from 'chalk';
import {
  getConfigValue,
  loadFromYaml,
  setConfigOrSecret,
} from '../config/loader.js';
import { CLI_CONFIG_PATH } from '../config/loader.js';
import type { CommandGroup, GroupContext } from '../group-command.js';

export const hubGroup: CommandGroup = {
  name: 'hub',
  summary: 'CarinaHub marketplace and authentication',
  loadEnv: true,
  legacyHandler: async (args) => {
    const { runHubCommand } = await import('../commands/hub-cli.js');
    await runHubCommand(args);
  },
  subcommands: [
    {
      name: 'status',
      description: 'Show CarinaHub connection status',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runHubCommand } = await import('../commands/hub-cli.js');
        await runHubCommand(['status', ...(ctx.json ? ['--json'] : [])]);
      },
    },
    {
      name: 'featured',
      description: 'List featured skills on the hub',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runHubCommand } = await import('../commands/hub-cli.js');
        await runHubCommand(['catalog', ...(ctx.json ? ['--json'] : [])]);
      },
    },
    {
      name: 'search',
      description: 'Search hub skills',
      usage: 'carina hub search <query>',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runHubCommand } = await import('../commands/hub-cli.js');
        await runHubCommand(['search', ...ctx.positional, ...(ctx.json ? ['--json'] : [])]);
      },
    },
    {
      name: 'stats',
      description: 'Show hub usage stats (installs, ratings)',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runHubCommand } = await import('../commands/hub-cli.js');
        await runHubCommand(['marketplace', ...(ctx.json ? ['--json'] : [])]);
      },
    },
    {
      name: 'auth',
      description: 'Authenticate with the hub',
      handler: async (ctx: GroupContext) => {
        const { runHubCommand } = await import('../commands/hub-cli.js');
        await runHubCommand(['start', ...ctx.positional]);
      },
    },
  ],
};

export const channelGroup: CommandGroup = {
  name: 'channel',
  aliases: ['ch'],
  summary: 'Configure messaging channels',
  loadEnv: true,
  subcommands: [
    {
      name: 'list',
      aliases: ['ls'],
      description: 'List configured channels',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runChannelsCommand } = await import('../commands/channels.js');
        await runChannelsCommand('list', ...(ctx.json ? ['--json'] : []));
      },
    },
    {
      name: 'add',
      aliases: ['new'],
      description: 'Add a channel (wizard)',
      usage: 'carina channel add <name>',
      handler: async (ctx: GroupContext) => {
        const name = ctx.positional[0];
        const { runChannelsCommand } = await import('../commands/channels.js');
        await runChannelsCommand('setup', ...(name ? [name] : []));
      },
    },
    {
      name: 'remove',
      aliases: ['rm'],
      description: 'Remove a channel',
      usage: 'carina channel remove <name>',
      handler: async (ctx: GroupContext) => {
        console.log(chalk.yellow('Channel removal is config-driven.'));
        console.log(chalk.gray('Disable env keys for the channel and run: carina gateway stop && carina gateway start'));
        if (ctx.json) {
          console.log(JSON.stringify({ removed: ctx.positional[0] ?? null, manual: true }, null, 2));
        }
      },
    },
    {
      name: 'test',
      description: 'Send a test message via a channel',
      usage: 'carina channel test <name>',
      handler: async (ctx: GroupContext) => {
        const { runChannelsCommand } = await import('../commands/channels.js');
        await runChannelsCommand('status', ...(ctx.positional[0] ? [ctx.positional[0]] : []), ...(ctx.json ? ['--json'] : []));
      },
    },
    {
      name: 'status',
      aliases: ['s'],
      description: 'Show connection status of all channels',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runChannelsCommand } = await import('../commands/channels.js');
        await runChannelsCommand('status', ...(ctx.positional[0] ? [ctx.positional[0]] : []), ...(ctx.json ? ['--json'] : []));
      },
    },
  ],
};

export const certGroup: CommandGroup = {
  name: 'cert',
  summary: 'Built-on-Carina certification',
  loadEnv: true,
  subcommands: [
    {
      name: 'status',
      description: 'Show certification status',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { runCertifyCommand } = await import('../commands/certify-cli.js');
        await runCertifyCommand([...(ctx.json ? ['--json'] : []), ...(ctx.positional[0] ? [ctx.positional[0]] : [])]);
      },
    },
    {
      name: 'generate',
      description: 'Generate certification token for embedding',
      usage: 'carina cert generate [project-path]',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const { evaluateBuiltOnCarina } = await import('../../certification/built-on-carina.js');
        const projectPath = ctx.positional[0] ?? process.cwd();
        const report = evaluateBuiltOnCarina(projectPath);
        const token = Buffer.from(JSON.stringify({
          level: report.level,
          score: report.score,
          passed: report.passed,
          generatedAt: report.generatedAt,
          projectPath: report.projectPath,
        })).toString('base64url');
        const payload = { token, report };
        if (ctx.json) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }
        console.log(token);
      },
    },
    {
      name: 'verify',
      description: 'Verify a certification token',
      usage: 'carina cert verify <token>',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const token = ctx.positional[0];
        if (!token) {
          console.error('Usage: carina cert verify <token>');
          process.exit(1);
        }
        try {
          const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
          if (ctx.json) {
            console.log(JSON.stringify({ valid: true, ...decoded }, null, 2));
            return;
          }
          console.log(chalk.green('Valid token'));
          console.log(JSON.stringify(decoded, null, 2));
        } catch {
          if (ctx.json) {
            console.log(JSON.stringify({ valid: false }, null, 2));
            process.exit(1);
          }
          console.error('Invalid certification token');
          process.exit(1);
        }
      },
    },
    {
      name: 'revoke',
      description: 'Revoke a certification token',
      usage: 'carina cert revoke <token>',
      handler: async (ctx: GroupContext) => {
        const msg = {
          revoked: ctx.positional[0] ?? null,
          note: 'Local tokens are self-contained; remove embedded badge from your site to revoke display.',
        };
        if (ctx.json) {
          console.log(JSON.stringify(msg, null, 2));
          return;
        }
        console.log(chalk.yellow(msg.note));
      },
    },
  ],
};

export const configGroup: CommandGroup = {
  name: 'config',
  aliases: ['cfg'],
  summary: 'Manage config.yaml and .env',
  loadEnv: true,
  legacyHandler: async (args) => {
    const { runConfigCommand } = await import('../commands/config-cli.js');
    await runConfigCommand(args);
  },
  subcommands: [
    {
      name: 'list',
      aliases: ['ls'],
      description: 'List all config keys and current values',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const data = await loadFromYaml();
        if (ctx.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }
        console.log(YAML.stringify(data));
      },
    },
    {
      name: 'get',
      description: 'Get a config value',
      usage: 'carina config get <path>',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const key = ctx.positional[0];
        if (!key) {
          console.error('Usage: carina config get <path>');
          process.exit(1);
        }
        const result = await getConfigValue(key);
        if (ctx.json) {
          console.log(JSON.stringify({ key, value: result ?? null }, null, 2));
          return;
        }
        if (typeof result === 'object') console.log(YAML.stringify(result));
        else console.log(result ?? '');
      },
    },
    {
      name: 'set',
      description: 'Set a config value',
      usage: 'carina config set <path> <value>',
      handler: async (ctx: GroupContext) => {
        const key = ctx.positional[0];
        const value = ctx.positional.slice(1).join(' ');
        if (!key || !value) {
          console.error('Usage: carina config set <path> <value>');
          process.exit(1);
        }
        const target = await setConfigOrSecret(key, value);
        if (ctx.json) {
          console.log(JSON.stringify({ key, value, target }, null, 2));
          return;
        }
        console.log(`Updated ${key} (${target === 'env' ? '.env' : 'config.yaml'})`);
      },
    },
    {
      name: 'reset',
      description: 'Reset a config key to default',
      usage: 'carina config reset <path>',
      handler: async (ctx: GroupContext) => {
        const { runConfigCommand } = await import('../commands/config-cli.js');
        await runConfigCommand(['unset', ctx.positional[0] ?? '']);
      },
    },
    {
      name: 'export',
      description: 'Export full config as JSON',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const data = await loadFromYaml();
        console.log(JSON.stringify(data, null, 2));
      },
    },
    {
      name: 'import',
      description: 'Import config from JSON file',
      usage: 'carina config import <file.json>',
      handler: async (ctx: GroupContext) => {
        const file = ctx.positional[0];
        if (!file) {
          console.error('Usage: carina config import <file.json>');
          process.exit(1);
        }
        const raw = await fs.readFile(file, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        await fs.writeFile(CLI_CONFIG_PATH, YAML.stringify(parsed), 'utf-8');
        if (ctx.json) {
          console.log(JSON.stringify({ imported: file, keys: Object.keys(parsed) }, null, 2));
          return;
        }
        console.log(chalk.green(`Imported config from ${file}`));
      },
    },
  ],
};

export const doctorGroup: CommandGroup = {
  name: 'doctor',
  summary: 'Run full diagnostics (provider keys, gateway, DB, permissions)',
  loadEnv: true,
  subcommands: [
    {
      name: 'run',
      description: 'Run diagnostics (default when no subcommand)',
      options: ['--json', '--fix', '--repair', '--deep'],
      handler: async (ctx: GroupContext) => {
        const { runDoctor } = await import('../commands/doctor.js');
        const flags = [...ctx.rawArgs];
        if (flags.includes('--fix') && !flags.includes('--repair')) flags.push('--repair');
        await runDoctor(flags);
      },
    },
  ],
};
