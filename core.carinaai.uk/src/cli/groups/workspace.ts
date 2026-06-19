import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import { CARINA_HOME } from '../../config/paths.js';
import {
  createAgentDefinition,
  deleteAgentDefinition,
  getActiveAgentDefinition,
  listAgentDefinitions,
  loadAgentsConfig,
  saveAgentsConfig,
  setActiveAgentId,
} from '../../workspaces/agent-registry.js';
import type { CommandGroup, GroupContext } from '../group-command.js';

async function exportWorkspaceSessions(agentId: string, json: boolean): Promise<void> {
  const sessionsDir = path.join(CARINA_HOME, 'sessions');
  const rows: Array<Record<string, unknown>> = [];
  try {
    const files = await fs.readdir(sessionsDir);
    for (const file of files.filter((f) => f.endsWith('.json'))) {
      const raw = await fs.readFile(path.join(sessionsDir, file), 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!agentId || String(parsed.agentId ?? '') === agentId) {
        rows.push(parsed);
      }
    }
  } catch {
    // no sessions dir
  }
  if (json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  console.log(chalk.bold(`\nExported ${rows.length} session file(s)\n`));
  for (const row of rows.slice(0, 20)) {
    console.log(`  ${String(row.id ?? '').slice(0, 8)}  ${String(row.updatedAt ?? '')}`);
  }
  console.log('');
}

export const workspaceGroup: CommandGroup = {
  name: 'workspace',
  aliases: ['ws'],
  summary: 'Manage agent workspaces (named agent profiles)',
  loadEnv: true,
  subcommands: [
    {
      name: 'list',
      aliases: ['ls'],
      description: 'List all workspaces',
      options: ['--json  Output as JSON'],
      examples: ['carina workspace list', 'carina ws ls --json'],
      handler: async (ctx: GroupContext) => {
        const active = getActiveAgentDefinition();
        const agents = listAgentDefinitions();
        if (ctx.json) {
          console.log(JSON.stringify({ activeId: active.id, workspaces: agents }, null, 2));
          return;
        }
        console.log(chalk.bold('\nWorkspaces\n'));
        for (const a of agents) {
          const mark = a.id === active.id ? chalk.green('*') : ' ';
          console.log(`  ${mark} ${a.id.padEnd(14)} ${a.name}${a.default ? chalk.gray(' (default)') : ''}`);
        }
        console.log('');
      },
    },
    {
      name: 'create',
      aliases: ['new'],
      description: 'Create a workspace',
      usage: 'carina workspace create <id> [name]',
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        const name = ctx.positional.slice(1).join(' ') || id;
        if (!id) {
          console.error('Usage: carina workspace create <id> [name]');
          process.exit(1);
        }
        const agent = await createAgentDefinition({ id, name });
        if (ctx.json) {
          console.log(JSON.stringify(agent, null, 2));
          return;
        }
        console.log(chalk.green(`Created workspace ${agent.id} (${agent.name})`));
      },
    },
    {
      name: 'switch',
      aliases: ['use'],
      description: 'Switch to a workspace',
      usage: 'carina workspace switch <id>',
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        if (!id) {
          console.error('Usage: carina workspace switch <id>');
          process.exit(1);
        }
        const agent = setActiveAgentId(id);
        if (ctx.json) {
          console.log(JSON.stringify(agent, null, 2));
          return;
        }
        console.log(chalk.green(`Active workspace: ${agent.id} (${agent.name})`));
      },
    },
    {
      name: 'rename',
      aliases: ['mv'],
      description: 'Rename a workspace',
      usage: 'carina workspace rename <id> <new-name>',
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        const newName = ctx.positional.slice(1).join(' ');
        if (!id || !newName) {
          console.error('Usage: carina workspace rename <id> <new-name>');
          process.exit(1);
        }
        const config = loadAgentsConfig();
        const agent = config.agents.find((a) => a.id === id);
        if (!agent) {
          console.error(`Unknown workspace: ${id}`);
          process.exit(1);
        }
        agent.name = newName;
        await saveAgentsConfig(config);
        if (ctx.json) {
          console.log(JSON.stringify(agent, null, 2));
          return;
        }
        console.log(chalk.green(`Renamed ${id} to "${newName}"`));
      },
    },
    {
      name: 'delete',
      aliases: ['rm'],
      description: 'Delete a workspace',
      usage: 'carina workspace delete <id>',
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        if (!id) {
          console.error('Usage: carina workspace delete <id>');
          process.exit(1);
        }
        const ok = await deleteAgentDefinition(id);
        if (!ok) {
          console.error(`Unknown workspace: ${id}`);
          process.exit(1);
        }
        if (ctx.json) {
          console.log(JSON.stringify({ deleted: id }, null, 2));
          return;
        }
        console.log(chalk.green(`Deleted workspace ${id}`));
      },
    },
    {
      name: 'current',
      aliases: ['.'],
      description: 'Show current workspace',
      options: ['--json  Output as JSON'],
      handler: async (ctx: GroupContext) => {
        const agent = getActiveAgentDefinition();
        if (ctx.json) {
          console.log(JSON.stringify(agent, null, 2));
          return;
        }
        console.log(`${agent.id}  ${agent.name}`);
        console.log(chalk.gray(`  workspace: ${agent.workspace}`));
      },
    },
    {
      name: 'export',
      description: 'Export workspace sessions to JSON',
      usage: 'carina workspace export [workspace-id]',
      options: ['--json  Output as JSON (default for export)'],
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0] ?? getActiveAgentDefinition().id;
        await exportWorkspaceSessions(id, true);
      },
    },
  ],
};

export async function createSessionFile(source = 'cli'): Promise<{ id: string; path: string }> {
  const id = uuidv4();
  const sessionsDir = path.join(CARINA_HOME, 'sessions');
  await fs.mkdir(sessionsDir, { recursive: true });
  const filePath = path.join(sessionsDir, `${id}.json`);
  const payload = {
    id,
    source,
    agentId: getActiveAgentDefinition().id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return { id, path: filePath };
}
