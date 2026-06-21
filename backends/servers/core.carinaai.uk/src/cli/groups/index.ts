import type { CliCommand } from '../types.js';
import {
  dispatchGroup,
  expandCliArgv,
  type CommandGroup,
} from '../group-command.js';
import { workspaceGroup } from './workspace.js';
import { sessionGroup } from './session.js';
import { modelGroup, memoryGroup, taskGroup } from './model-memory-task.js';
import { skillGroup, agentGroup } from './skill-agent.js';
import { webhookGroup, mcpGroup, scoutGroup } from './webhook-mcp-scout.js';
import { obsidianGroup } from './obsidian.js';
import {
  hubGroup,
  channelGroup,
  certGroup,
  configGroup,
  doctorGroup,
} from './hub-channel-cert-config-doctor.js';

export const COMMAND_GROUPS: CommandGroup[] = [
  workspaceGroup,
  sessionGroup,
  modelGroup,
  memoryGroup,
  taskGroup,
  skillGroup,
  agentGroup,
  webhookGroup,
  mcpGroup,
  scoutGroup,
  obsidianGroup,
  hubGroup,
  channelGroup,
  certGroup,
  configGroup,
  doctorGroup,
];

const GROUP_BY_NAME = new Map<string, CommandGroup>();
for (const group of COMMAND_GROUPS) {
  GROUP_BY_NAME.set(group.name, group);
  for (const alias of group.aliases ?? []) {
    GROUP_BY_NAME.set(alias, group);
  }
}

export function resolveCommandGroup(name: string): CommandGroup | undefined {
  return GROUP_BY_NAME.get(name);
}

export function isGroupCommandName(name: string): boolean {
  return GROUP_BY_NAME.has(name);
}

export async function runCommandGroup(name: string, args: string[]): Promise<void> {
  const group = resolveCommandGroup(name);
  if (!group) {
    console.error(`Unknown command group: ${name}`);
    process.exit(1);
  }
  if (group.name === 'doctor') {
    const { runDoctor } = await import('../commands/doctor.js');
    const flags = [...args];
    if (flags.includes('--fix') && !flags.includes('--repair')) flags.push('--repair');
    await runDoctor(flags);
    return;
  }
  await dispatchGroup(group, args, (await import('../registry.js')).readPackageInfo());
}

export function buildGroupCliCommands(): CliCommand[] {
  const existingTopLevel = new Set(['model', 'memory', 'mcp', 'scout', 'obsidian', 'hub', 'config', 'doctor']);
  return COMMAND_GROUPS.filter((group) => !existingTopLevel.has(group.name)).map((group) => ({
    name: group.name,
    summary: group.summary,
    usage: `carina ${group.name} <command>`,
    aliases: group.aliases,
    loadEnv: group.loadEnv,
    handler: async (args: string[]) => {
      await runCommandGroup(group.name, args);
    },
  }));
}

export function expandArgvForGroups(argv: string[]): string[] {
  return expandCliArgv(argv);
}

export function groupSubcommandNames(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const group of COMMAND_GROUPS) {
    out[group.name] = group.subcommands.map((s) => s.name);
  }
  return out;
}

export function allGroupAliasEntries(): Array<{ alias: string; target: string }> {
  const entries: Array<{ alias: string; target: string }> = [];
  for (const group of COMMAND_GROUPS) {
    for (const alias of group.aliases ?? []) {
      entries.push({ alias, target: group.name });
    }
    for (const sub of group.subcommands) {
      for (const subAlias of sub.aliases ?? []) {
        entries.push({ alias: `${group.aliases?.[0] ?? group.name} ${subAlias}`, target: `${group.name} ${sub.name}` });
      }
    }
  }
  return entries;
}
