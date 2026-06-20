import chalk from 'chalk';
import {
  addBinding,
  createAgentDefinition,
  deleteAgentDefinition,
  ensureAgentsConfig,
  getActiveAgentId,
  getAgentDefinition,
  listAgentDefinitions,
  listBindings,
  removeBinding,
  setActiveAgentId,
} from '../../workspaces/index.js';
import { buildRouteExplanation, ROUTING_PRECEDENCE } from '../../workspaces/routing-explain.js';
import type { ChannelName } from '../../gateway/channels/channel-adapter.interface.js';
import type { RoutingContext } from '../../workspaces/types.js';

export async function runAgentsCommand(args: string[]): Promise<void> {
  await ensureAgentsConfig();
  const json = args.includes('--json');
  const explain = args.includes('--explain');
  const filtered = args.filter((a) => a !== '--json' && a !== '--explain');
  const action = filtered[0] ?? 'list';
  const sub = filtered[1];
  const rest = filtered.slice(2);

  if (action === 'context') {
    const {
      getSpawnContext,
      getActiveChildCount,
    } = await import('../../agents/delegation-context.js');
    const { MAX_SPAWN_DEPTH, MAX_CONCURRENT_CHILDREN } = await import('../../agents/agent-roles.js');
    const sessionId = sub ?? process.env.CARINA_SESSION_ID ?? 'cli-default';
    const ctx = getSpawnContext(sessionId);
    console.log(chalk.bold('\nAgent spawn context\n'));
    console.log(`  Role:            ${ctx.role}`);
    console.log(`  Depth:           ${ctx.depth}/${MAX_SPAWN_DEPTH}`);
    console.log(`  Parent:          ${ctx.parentAgentId ?? 'none (top-level)'}`);
    console.log(`  Active children: ${getActiveChildCount(sessionId)}/${MAX_CONCURRENT_CHILDREN}`);
    console.log('');
    return;
  }

  if (action === 'list') {
    const showBindings = filtered.includes('--bindings') || sub === '--bindings';
    const agents = listAgentDefinitions();
    const active = getActiveAgentId();
    console.log(chalk.bold('\nAgent workspaces\n'));
    for (const agent of agents) {
      const mark = active === agent.id || (!active && agent.default) ? chalk.green('*') : ' ';
      console.log(`  ${mark} ${agent.id.padEnd(14)} ${agent.name}`);
      console.log(chalk.gray(`      workspace: ${agent.workspace}`));
      if (agent.provider) {
        console.log(chalk.gray(`      model: ${agent.provider}${agent.model ? `/${agent.model}` : ''}`));
      }
    }
    if (showBindings) {
      const bindings = listBindings();
      console.log(chalk.bold(`\nBindings (${bindings.length})\n`));
      bindings.forEach((b, i) => {
        const m = b.match;
        const parts = [
          m.channel ? `channel=${m.channel}` : '',
          m.accountId ? `account=${m.accountId}` : '',
          m.peer ? `peer=${m.peer.kind}:${m.peer.id}` : '',
          m.guildId ? `guild=${m.guildId}` : '',
          m.teamId ? `team=${m.teamId}` : '',
        ].filter(Boolean).join(' ');
        console.log(`  [${i}] ${b.agentId}  ${parts || '(fallback)'}${b.label ? `  (${b.label})` : ''}`);
      });
    }
    console.log('');
    return;
  }

  if (action === 'add' || action === 'create') {
    const id = sub;
    const name = rest[0] ?? id;
    if (!id) {
      console.error('Usage: carina agents add <id> [display name]');
      process.exit(1);
    }
    const agent = await createAgentDefinition({ id, name });
    console.log(chalk.green(`Agent created: ${agent.id}`));
    console.log(`  workspace: ${agent.workspace}`);
    return;
  }

  if (action === 'show') {
    const id = sub;
    if (!id) {
      console.error('Usage: carina agents show <id>');
      process.exit(1);
    }
    const agent = getAgentDefinition(id);
    if (!agent) {
      console.error(`Unknown agent: ${id}`);
      process.exit(1);
    }
    console.log(JSON.stringify(agent, null, 2));
    return;
  }

  if (action === 'remove' || action === 'delete') {
    const id = sub;
    if (!id) {
      console.error('Usage: carina agents remove <id>');
      process.exit(1);
    }
    if (id === 'main') {
      console.error('Cannot remove the main agent');
      process.exit(1);
    }
    const ok = await deleteAgentDefinition(id);
    console.log(ok ? chalk.green(`Removed agent ${id}`) : chalk.red(`Agent not found: ${id}`));
    return;
  }

  if (action === 'use') {
    const id = sub;
    if (!id) {
      console.error('Usage: carina agents use <id>');
      process.exit(1);
    }
    const agent = setActiveAgentId(id);
    console.log(chalk.green(`Active CLI agent: ${agent.id}`));
    console.log(`  workspace: ${agent.workspace}`);
    return;
  }

  if (action === 'bind') {
    await runBindCommand(sub ?? 'list', rest);
    return;
  }

  if (action === 'route') {
    const ctx = parseRouteArgs(filtered.slice(1));
    const details = buildRouteExplanation(ctx);
    if (json) {
      console.log(JSON.stringify({
        context: details.context,
        agentId: details.result.agent.id,
        agentName: details.result.agent.name,
        tier: details.result.tier,
        source: details.result.source,
        binding: details.result.binding ?? null,
        description: details.description,
      }, null, 2));
      return;
    }
    console.log(chalk.bold('\nRoute preview\n'));
    console.log(`  ${details.description}`);
    console.log(`  -> ${details.result.agent.id} (${details.result.agent.name})`);
    console.log(chalk.gray(`  tier=${details.result.tier}  source=${details.result.source}`));
    if (details.result.binding?.label) {
      console.log(chalk.gray(`  binding=${details.result.binding.label}`));
    }
    if (explain) {
      console.log(chalk.bold('\nPrecedence (highest wins)\n'));
      for (const line of ROUTING_PRECEDENCE) {
        console.log(chalk.gray(`  - ${line}`));
      }
      console.log('');
    }
    return;
  }

  console.error('Usage: carina agents <list|add|show|remove|use|bind|route|context> [args]');
  process.exit(1);
}

async function runBindCommand(action: string, args: string[]): Promise<void> {
  if (action === 'list') {
    const bindings = listBindings();
    if (bindings.length === 0) {
      console.log('No bindings.');
      return;
    }
    bindings.forEach((b, i) => {
      console.log(`[${i}] ${b.agentId}  ${JSON.stringify(b.match)}`);
    });
    return;
  }

  if (action === 'add') {
    const agentId = args[0];
    const channel = args[1] as ChannelName | undefined;
    if (!agentId || !channel) {
      console.error('Usage: carina agents bind add <agentId> <channel> [--account ID] [--peer kind:id]');
      process.exit(1);
    }
    const match: RoutingContext = { channel };
    const accountIdx = args.indexOf('--account');
    if (accountIdx >= 0) match.accountId = args[accountIdx + 1];
    const peerIdx = args.indexOf('--peer');
    if (peerIdx >= 0) {
      const raw = args[peerIdx + 1] ?? '';
      const [kind, id] = raw.split(':');
      if (kind && id) {
        match.peerKind = kind as RoutingContext['peerKind'];
        match.peerId = id;
      }
    }
    await addBinding({
      agentId,
      match: {
        channel: match.channel,
        accountId: match.accountId,
        peer: match.peerKind && match.peerId
          ? { kind: match.peerKind, id: match.peerId }
          : undefined,
      },
    });
    console.log(chalk.green(`Binding added: ${agentId} <- ${channel}`));
    return;
  }

  if (action === 'remove') {
    const index = Number(args[0]);
    if (!Number.isFinite(index)) {
      console.error('Usage: carina agents bind remove <index>');
      process.exit(1);
    }
    const ok = await removeBinding(index);
    console.log(ok ? chalk.green(`Removed binding [${index}]`) : chalk.red('Invalid binding index'));
    return;
  }

  console.error('Usage: carina agents bind <list|add|remove> [args]');
  process.exit(1);
}

function parseRouteArgs(args: string[]): RoutingContext {
  const ctx: RoutingContext = { channel: 'web' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--channel' && args[i + 1]) ctx.channel = args[++i] as ChannelName;
    else if (arg === '--account' && args[i + 1]) ctx.accountId = args[++i];
    else if (arg === '--peer' && args[i + 1]) {
      const [kind, id] = args[++i]!.split(':');
      if (kind && id) {
        ctx.peerKind = kind as RoutingContext['peerKind'];
        ctx.peerId = id;
      }
    } else if (arg === '--guild' && args[i + 1]) ctx.guildId = args[++i];
    else if (arg === '--team' && args[i + 1]) ctx.teamId = args[++i];
  }
  return ctx;
}
