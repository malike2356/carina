import {
  buildCapabilitySummaryForSurface,
  collectSurfaceRuntimeSnapshot,
  resolveSurface,
} from '../product/surface-capabilities.js';
import { config } from '../config/index.js';
import { formatCostReport, getMonthlyReport } from '../brain/cost-tracker.js';
import { clearToolCache } from '../tools/cache.js';
import path from 'node:path';
import {
  handleModelCommand,
  type ModelCommandContext,
} from './model-command.js';
import { formatGatewayStatusReply, formatMessengerHelp } from './session-control.js';
import {
  formatPlanModeAllowlistPreview,
  getPlanModeToolAllowlist,
} from '../security/plan-mode-allowlist.js';
import {
  resolvePlanMode,
  setSessionPlanMode,
} from '../security/plan-mode-state.js';
import { formatContactsCommandReply } from '../contacts/contacts-command.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import {
  buildWeeklyOwnerDigest,
  getOutreachControlState,
  listBookings,
  pauseOutreach,
  resumeOutreach,
  outreachControlSummary,
} from '../outreach/index.js';

import {
  formatGatewaySummary,
  runDeepResearch,
  writeResearchReportFile,
} from '../agents/deep-research.js';
import {
  defaultCompareProviders,
  formatCompareGateway,
  runCompare,
} from '../agents/compare.js';
import { deleteMemory, listRecentMemories } from '../memory/store.js';
import {
  formatThinkingStatus,
  parseThinkingLevel,
  setSessionThinkingLevel,
  toggleSessionFastMode,
} from '../agents/thinking-levels.js';
import { getTokenTracker } from '../agents/token-tracker.js';
import {
  getStandingOrdersStore,
  standingOrdersEnabled,
} from '../agents/standing-orders-store.js';
import type { QueueMode } from '../agents/command-queue-types.js';
import type { CommandQueue } from '../agents/command-queue.js';
import {
  claimLinkCode,
  generateLinkCode,
  getCrossChannelSharing,
  getSessionIdentityState,
  setCrossChannelSharing,
} from './session-identity-prefs.js';
import { getIdentityResolver, identityLinksEnabled } from './identity-resolver.js';
import { getChannelDocking } from './channel-docking.js';
import type { ChannelName } from './channels/channel-adapter.interface.js';

export type CommandResult =
  | {
      handled: true;
      reply: string;
      action?: 'exit' | 'clear' | 'new_session' | 'stop_turn';
      attachment?: { path: string; filename: string };
    }
  | { handled: false };

export interface GatewayCommandContext {
  sessionId?: string;
  channel?: string;
  channelUserId?: string;
  displayName?: string;
  canonicalUserId?: string;
  activeProvider?: string;
  activeModel?: string;
  commandQueue?: CommandQueue;
}

const PLAIN_TEXT_CHANNELS = new Set(['telegram', 'sms', 'signal', 'irc']);

type CommandIdentity = {
  canonicalUserId: string;
  channel: ChannelName;
  channelUserId: string;
  displayName?: string;
};

async function resolveCommandIdentity(
  context: GatewayCommandContext,
): Promise<CommandIdentity | { error: string }> {
  if (!identityLinksEnabled()) {
    return { error: 'Identity links are disabled (CARINA_IDENTITY_LINKS_ENABLED=false).' };
  }
  const state = context.sessionId ? getSessionIdentityState(context.sessionId) : undefined;
  const channel = (context.channel ?? state?.originChannel) as ChannelName | undefined;
  const channelUserId = context.channelUserId;
  if (!channel || !channelUserId) {
    return { error: 'Identity commands require an active channel session with a user id.' };
  }
  const canonicalUserId = state?.canonicalUserId
    ?? context.canonicalUserId
    ?? await getIdentityResolver().resolve(channel, channelUserId, context.displayName);
  return {
    canonicalUserId,
    channel,
    channelUserId,
    displayName: context.displayName,
  };
}

async function formatMemoriesList(sessionId?: string): Promise<string> {
  // Prefer session-scoped episodic rows; never dump the shared global table for a chat user.
  const memories = sessionId
    ? await listRecentMemories(20, { sessionId })
    : [];
  if (memories.length === 0) {
    return sessionId
      ? 'No episodic memories stored for this session yet.'
      : 'No session is active; open a chat before listing memories.';
  }
  return memories
    .map((m, i) => {
      const preview = m.content.slice(0, 80).replace(/\n/g, ' ');
      return `${i + 1}. [${m.id.slice(0, 8)}] ${m.role}: ${preview}`;
    })
    .join('\n');
}

export async function handleGatewayCommandAsync(
  input: string,
  context: GatewayCommandContext = {},
): Promise<CommandResult> {
  const trimmed = input.trim();

  const standingOrdersMatch = trimmed.match(/^\/standing-orders(?:\s+(add|list|remove|toggle|expire)\s*(.*))?$/i);
  if (standingOrdersMatch) {
    if (!standingOrdersEnabled()) {
      return { handled: true, reply: 'Standing orders are disabled (CARINA_STANDING_ORDERS_ENABLED=false).' };
    }
    const sub = (standingOrdersMatch[1] ?? 'list').toLowerCase();
    const rest = (standingOrdersMatch[2] ?? '').trim();
    const store = getStandingOrdersStore();
    const agentId = '*';

    if (sub === 'add') {
      if (!rest || rest.length < 3) {
        return { handled: true, reply: 'Usage: /standing-orders add <directive text>' };
      }
      if (rest.length > 2000) {
        return { handled: true, reply: 'Directive too long (max 2000 characters).' };
      }
      const order = await store.add({
        agentId,
        directive: rest,
        priority: 0,
        enabled: true,
        source: 'user',
      });
      return { handled: true, reply: `Standing order #${order.id.slice(0, 8)} added.` };
    }

    if (sub === 'list') {
      const orders = await store.list(agentId);
      if (orders.length === 0) return { handled: true, reply: 'No standing orders set.' };
      return {
        handled: true,
        reply: orders.map((order) =>
          `[${order.id.slice(0, 8)}] ${order.enabled ? 'on' : 'off'} ${order.directive}`,
        ).join('\n'),
      };
    }

    if (sub === 'remove') {
      const id = rest.split(/\s+/)[0];
      if (!id) return { handled: true, reply: 'Usage: /standing-orders remove <id>' };
      const removed = await store.remove(id);
      return { handled: true, reply: removed ? `Order ${id} removed.` : `Order ${id} not found.` };
    }

    if (sub === 'toggle') {
      const id = rest.split(/\s+/)[0];
      if (!id) return { handled: true, reply: 'Usage: /standing-orders toggle <id>' };
      const order = await store.get(id);
      if (!order) return { handled: true, reply: `Order ${id} not found.` };
      await store.update(id, { enabled: !order.enabled });
      return { handled: true, reply: `Order ${id} ${order.enabled ? 'disabled' : 'enabled'}.` };
    }

    if (sub === 'expire') {
      const [id, iso] = rest.split(/\s+/);
      if (!id || !iso) return { handled: true, reply: 'Usage: /standing-orders expire <id> <ISO timestamp>' };
      const expiresAt = new Date(iso).getTime();
      if (Number.isNaN(expiresAt)) {
        return { handled: true, reply: 'Invalid date. Use ISO 8601 format.' };
      }
      await store.update(id, { metadata: { expiresAt } });
      return { handled: true, reply: `Order ${id} expires at ${new Date(expiresAt).toISOString()}.` };
    }

    return { handled: true, reply: 'Usage: /standing-orders <add|list|remove|toggle|expire>' };
  }

  if (trimmed.startsWith('/contacts')) {
    return {
      handled: true,
      reply: await formatContactsCommandReply(trimmed),
    };
  }

  const compareMatch = trimmed.match(/^\/compare\s+(.+)$/i);
  if (compareMatch?.[1]) {
    try {
      const providers = defaultCompareProviders();
      if (providers.length === 0) {
        return { handled: true, reply: 'No configured providers for compare. Add API keys first.' };
      }
      const result = await runCompare({
        prompt: compareMatch[1].trim(),
        providers,
      });
      const plain = PLAIN_TEXT_CHANNELS.has(context.channel ?? '');
      const body = formatCompareGateway(result, plain);
      return {
        handled: true,
        reply: `Prompt: ${result.prompt}\n\n${body}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { handled: true, reply: `Compare failed: ${msg}` };
    }
  }

  const researchMatch = trimmed.match(/^\/research\s+(.+)$/i);
  if (researchMatch?.[1]) {
    try {
      const report = await runDeepResearch({
        query: researchMatch[1].trim(),
        sessionId: context.sessionId ?? 'gateway-research',
        onProgress: () => {},
      });
      const plain = PLAIN_TEXT_CHANNELS.has(context.channel ?? '');
      const reportPath = await writeResearchReportFile(report, 'markdown');
      const { saveResearchReport } = await import('../research/research-store.js');
      const saved = await saveResearchReport(report, { query: researchMatch[1].trim(), format: 'both' });
      const reply = formatGatewaySummary(report, plain);
      return {
        handled: true,
        reply: `${reply}\n\nFull report: ${reportPath}\nShare id: ${saved.shareId}`,
        attachment: { path: reportPath, filename: path.basename(reportPath) },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { handled: true, reply: `Research failed: ${msg}` };
    }
  }

  if (trimmed === '/capabilities') {
    const surface = resolveSurface({
      platform: context.channel ?? 'cli',
      hostedMode: process.env.HOSTED_MODE === 'true',
      coreProxy: process.env.CARINA_USE_CORE_PROXY === 'true',
    });
    return {
      handled: true,
      reply: buildCapabilitySummaryForSurface(surface, collectSurfaceRuntimeSnapshot()),
    };
  }

  if (trimmed === '/memories') {
    return { handled: true, reply: await formatMemoriesList(context.sessionId) };
  }

  if (trimmed === '/status') {
    const provider = context.activeProvider ?? 'unknown';
    return {
      handled: true,
      reply: formatGatewayStatusReply({
        sessionId: context.sessionId,
        channel: context.channel,
        activeProvider: provider,
        activeModel: context.activeModel,
      }),
    };
  }

  const planMatch = trimmed.match(/^\/plan(?:\s+(on|off|status))?$/i);
  if (planMatch) {
    const action = (planMatch[1] ?? 'status').toLowerCase();
    const sessionId = context.sessionId;
    if (!sessionId) {
      return { handled: true, reply: 'Plan mode requires an active session.' };
    }
    if (action === 'on') {
      setSessionPlanMode(sessionId, true);
      return {
        handled: true,
        reply: `Plan mode ON. Only read-only tools available (${getPlanModeToolAllowlist().size} allowlisted). Use /plan off to exit.`,
      };
    }
    if (action === 'off') {
      setSessionPlanMode(sessionId, false);
      return { handled: true, reply: 'Plan mode OFF. Normal tool access restored.' };
    }
    const active = resolvePlanMode({ sessionId });
    return {
      handled: true,
      reply: active
        ? `Plan mode: ON\nAllowlisted tools (${getPlanModeToolAllowlist().size}): ${formatPlanModeAllowlistPreview()}`
        : `Plan mode: OFF\nUse /plan on to enter fail-safe exploration mode.`,
    };
  }

  if (trimmed === '/stop') {
    return { handled: true, reply: 'Stopping current turn...', action: 'stop_turn' };
  }

  if (trimmed === '/usage' || trimmed === '/usage --month') {
    return { handled: true, reply: formatCostReport(await getMonthlyReport()) };
  }

  const thinkMatch = trimmed.match(/^\/think(?:\s+(status|off|minimal|low|medium|high|xhigh|max|adaptive))?$/i);
  if (thinkMatch) {
    const sessionId = context.sessionId;
    if (!sessionId) {
      return { handled: true, reply: 'Thinking level requires an active session.' };
    }
    const action = (thinkMatch[1] ?? 'status').toLowerCase();
    if (action === 'status') {
      return { handled: true, reply: formatThinkingStatus(sessionId) };
    }
    const level = parseThinkingLevel(action);
    if (!level) {
      return { handled: true, reply: 'Usage: /think off|minimal|low|medium|high|xhigh|max|adaptive|status' };
    }
    setSessionThinkingLevel(sessionId, level);
    return { handled: true, reply: `Thinking level set to ${level}.` };
  }

  if (trimmed === '/fast') {
    const sessionId = context.sessionId;
    if (!sessionId) {
      return { handled: true, reply: 'Fast mode requires an active session.' };
    }
    const level = toggleSessionFastMode(sessionId);
    return {
      handled: true,
      reply: level === 'off'
        ? 'Fast mode ON (thinking off until you /think again).'
        : 'Fast mode OFF. Normal thinking level restored.',
    };
  }

  const tokensMatch = trimmed.match(/^\/tokens(?:\s+(all|reset))?$/i);
  if (tokensMatch) {
    const action = (tokensMatch[1] ?? '').toLowerCase();
    const sessionId = context.sessionId;
    if (action === 'all') {
      const rows = getTokenTracker().getAll();
      if (rows.length === 0) return { handled: true, reply: 'No session token usage recorded yet.' };
      return {
        handled: true,
        reply: rows
          .slice(0, 10)
          .map((row) => `${row.sessionId.slice(0, 8)}: ${row.totalTokens} tokens (~$${row.estimatedCost.toFixed(2)})`)
          .join('\n'),
      };
    }
    if (action === 'reset') {
      if (!sessionId) return { handled: true, reply: 'No active session to reset.' };
      getTokenTracker().reset(sessionId);
      return { handled: true, reply: 'Session token counter reset.' };
    }
    if (!sessionId) return { handled: true, reply: 'No active session token usage.' };
    return { handled: true, reply: getTokenTracker().formatSessionSummary(sessionId) };
  }

  const queueMatch = trimmed.match(/^\/queue(?:\s+(steer|followup|collect|interrupt|status|config))?$/i);
  if (queueMatch) {
    const sessionId = context.sessionId;
    const queue = context.commandQueue;
    if (!queue) {
      return { handled: true, reply: 'Command queue is not available on this surface.' };
    }
    const sub = (queueMatch[1] ?? 'status').toLowerCase();
    if (sub === 'config') {
      const cfg = sessionId ? queue.getSessionConfig(sessionId) : queue.getSessionConfig('default');
      return {
        handled: true,
        reply: [
          `maxConcurrent: ${cfg.maxConcurrent}`,
          `debounceMs: ${cfg.debounceMs}`,
          `cap: ${cfg.cap}`,
          `drop: ${cfg.drop}`,
          `defaultMode: ${cfg.defaultMode}`,
        ].join('\n'),
      };
    }
    if (sub === 'status') {
      const status = queue.status();
      const mode = sessionId ? queue.getDefaultMode(sessionId) : 'steer';
      return {
        handled: true,
        reply: `Queue: ${mode} mode, ${status.totalEntries} pending, ${status.activeLanes} active lane(s).`,
      };
    }
    if (!sessionId) {
      return { handled: true, reply: 'Queue mode requires an active session.' };
    }
    queue.setSessionConfig(sessionId, { defaultMode: sub as QueueMode });
    return { handled: true, reply: `Queue mode set to "${sub}". Applies to your next message.` };
  }

  const outreachMatch = trimmed.match(/^\/outreach(?:\s+(pause|resume|status|summary|booked))?(?:\s+(.*))?$/i);
  if (outreachMatch) {
    const action = (outreachMatch[1] ?? 'status').toLowerCase();
    const reason = (outreachMatch[2] ?? '').trim();
    const sessionId = context.sessionId;
    if (!sessionId) {
      return { handled: true, reply: 'Outreach control requires an active worker session.' };
    }
    const workerCtx = getWorkerSessionContext(sessionId);
    if (!workerCtx?.worker.workspaceId) {
      return { handled: true, reply: 'Outreach control needs a worker workspace.' };
    }
    const workspaceId = workerCtx.worker.workspaceId;
    if (action === 'pause') {
      const state = pauseOutreach(workspaceId, reason || undefined, workerCtx.worker.id);
      return { handled: true, reply: outreachControlSummary(state) };
    }
    if (action === 'resume') {
      const state = resumeOutreach(workspaceId, workerCtx.worker.id);
      return { handled: true, reply: outreachControlSummary(state) };
    }
    if (action === 'booked') {
      const upcoming = listBookings(workspaceId, { status: 'confirmed' })
        .filter((booking) => new Date(booking.startsAt).getTime() >= Date.now());
      return {
        handled: true,
        reply: `Booked calls: ${upcoming.length}`,
      };
    }
    const state = getOutreachControlState(workspaceId);
    const digest = buildWeeklyOwnerDigest(workspaceId);
    return {
      handled: true,
      reply: [
        outreachControlSummary(state),
        `Sent / follow-up digest: ${digest.followUpsDue} due, ${digest.staleLeads.length} stale lead(s).`,
        `Bookings: ${listBookings(workspaceId, { status: 'confirmed' }).filter((booking) => new Date(booking.startsAt).getTime() >= Date.now()).length}`,
      ].join('\n'),
    };
  }

  const clearCacheMatch = trimmed.match(/^\/clear-cache(?:\s+([a-z0-9_-]+))?$/i);
  if (clearCacheMatch) {
    const toolName = clearCacheMatch[1];
    const deleted = await clearToolCache(toolName);
    const scope = toolName ? ` for ${toolName}` : '';
    return { handled: true, reply: `Cleared ${deleted} cached tool result${deleted === 1 ? '' : 's'}${scope}.` };
  }

  const deleteMatch = trimmed.match(/^\/memories\s+delete\s+(\S+)$/i);
  if (deleteMatch) {
    const idPrefix = deleteMatch[1];
    const sessionId = context.sessionId;
    if (!sessionId) {
      return { handled: true, reply: 'Open an active session before deleting memories.' };
    }
    const memories = await listRecentMemories(50, { sessionId });
    const match = memories.find((m) => m.id.startsWith(idPrefix) || m.id === idPrefix);
    if (!match) return { handled: true, reply: `No memory found for id prefix: ${idPrefix}` };
    await deleteMemory(match.id);
    return { handled: true, reply: `Deleted memory ${match.id.slice(0, 8)}...` };
  }

  if (trimmed === '/link' || trimmed.startsWith('/link ')) {
    const linkMatch = trimmed.match(/^\/link(?:\s+(code|claim)\s*(.*))?$/i);
    const identity = await resolveCommandIdentity(context);
    if ('error' in identity) {
      return { handled: true, reply: identity.error };
    }
    const resolver = getIdentityResolver();
    const sub = (linkMatch?.[1] ?? '').toLowerCase();
    const rest = (linkMatch?.[2] ?? '').trim();

    if (sub === 'code') {
      const code = generateLinkCode({
        userId: identity.canonicalUserId,
        channel: identity.channel,
        channelUserId: identity.channelUserId,
        displayName: identity.displayName,
      });
      return {
        handled: true,
        reply: [
          `Link code: ${code}`,
          'Valid for 5 minutes.',
          `On your other channel, send: /link claim ${code}`,
        ].join('\n'),
      };
    }

    if (sub === 'claim') {
      const code = rest.split(/\s+/)[0];
      if (!code) {
        return { handled: true, reply: 'Usage: /link claim <code>' };
      }
      const claimed = claimLinkCode(code, {
        channel: identity.channel,
        channelUserId: identity.channelUserId,
        displayName: identity.displayName,
      });
      if ('error' in claimed) {
        return { handled: true, reply: claimed.error };
      }
      await resolver.link(
        claimed.userId,
        identity.channel,
        identity.channelUserId,
        identity.displayName,
      );
      const identities = await resolver.getIdentities(claimed.userId);
      const channels = identities.map((row) => row.channel).join(', ');
      return {
        handled: true,
        reply: [
          'Channels linked.',
          `Canonical user: ${claimed.userId.slice(0, 12)}...`,
          `Linked channels: ${channels || identity.channel}`,
          getCrossChannelSharing(claimed.userId)
            ? 'Cross-channel session sharing is on (default). Use /identity share off to keep sessions per channel.'
            : 'Cross-channel sharing is off. Use /identity share on to share one session across linked channels.',
        ].join('\n'),
      };
    }

    const identities = await resolver.getIdentities(identity.canonicalUserId);
    if (identities.length === 0) {
      return { handled: true, reply: 'No linked identities yet for this channel user.' };
    }
    const lines = identities.map((row) => {
      const label = row.displayName ?? row.channelUserId;
      const primary = row.isPrimary ? ' (primary)' : '';
      return `- ${row.channel}: ${label}${primary}`;
    });
    return {
      handled: true,
      reply: [
        `Canonical user: ${identity.canonicalUserId.slice(0, 12)}...`,
        'Linked identities:',
        ...lines,
        '',
        'Commands:',
        '/link code - generate a link code on this channel',
        '/link claim <code> - attach this channel to the same user (run on the other channel)',
        '/identity share on|off - toggle shared sessions across linked channels',
        '/dock list|to <channel>|back|status - move reply stream between channels',
      ].join('\n'),
    };
  }

  const identityShareMatch = trimmed.match(/^\/identity\s+share\s+(on|off)$/i);
  if (identityShareMatch) {
    const identity = await resolveCommandIdentity(context);
    if ('error' in identity) {
      return { handled: true, reply: identity.error };
    }
    const enabled = identityShareMatch[1].toLowerCase() === 'on';
    setCrossChannelSharing(identity.canonicalUserId, enabled);
    return {
      handled: true,
      reply: enabled
        ? 'Cross-channel session sharing enabled. Linked channels share one conversation thread.'
        : 'Cross-channel session sharing disabled. Each channel keeps its own session even when linked.',
    };
  }

  if (trimmed === '/dock' || trimmed.startsWith('/dock ')) {
    const dockMatch = trimmed.match(/^\/dock(?:\s+(list|to|back|status)\s*(.*))?$/i);
    const identity = await resolveCommandIdentity(context);
    if ('error' in identity) {
      return { handled: true, reply: identity.error };
    }
    if (!context.sessionId) {
      return { handled: true, reply: 'Docking requires an active session. Send a message first, then use /dock.' };
    }
    const docking = getChannelDocking();
    const sub = (dockMatch?.[1] ?? 'status').toLowerCase();
    const rest = (dockMatch?.[2] ?? '').trim();
    const state = getSessionIdentityState(context.sessionId);

    if (sub === 'list') {
      const channels = await docking.listDockableChannels(
        identity.canonicalUserId,
        identity.channel,
      );
      if (channels.length === 0) {
        return {
          handled: true,
          reply: 'No other linked channels available. Use /link to connect another channel first.',
        };
      }
      return {
        handled: true,
        reply: [
          'Dockable channels:',
          ...channels.map((channel) => `- ${channel}`),
          '',
          'Use /dock to <channel> to move replies there.',
        ].join('\n'),
      };
    }

    if (sub === 'to') {
      const target = rest.split(/\s+/)[0]?.toLowerCase();
      if (!target) {
        return { handled: true, reply: 'Usage: /dock to <channel>' };
      }
      const result = await docking.dock(context.sessionId, identity.canonicalUserId, target as ChannelName);
      if (!result.success) {
        return { handled: true, reply: result.error };
      }
      return {
        handled: true,
        reply: `Replies now go to ${result.dockedTo}. Use /dock back to return to ${result.dockedFrom}.`,
      };
    }

    if (sub === 'back') {
      const result = await docking.undock(context.sessionId);
      if (!result.success) {
        return { handled: true, reply: result.error };
      }
      return {
        handled: true,
        reply: `Replies returned to ${result.dockedTo}.`,
      };
    }

    const replyChannel = state?.replyChannel ?? identity.channel;
    const docked = state?.dockedFrom ? `yes (from ${state.dockedFrom})` : 'no';
    return {
      handled: true,
      reply: [
        `Reply channel: ${replyChannel}`,
        `Docked: ${docked}`,
        state?.originChannel ? `Session origin: ${state.originChannel}` : '',
      ].filter(Boolean).join('\n'),
    };
  }

  return handleGatewayCommand(trimmed, {}, context);
}

export function handleGatewayCommand(
  input: string,
  modelContext: ModelCommandContext = {},
  gatewayContext: GatewayCommandContext = {},
): CommandResult {
  const trimmed = input.trim();

  if (trimmed === '/exit') {
    return { handled: true, reply: 'Goodbye.', action: 'exit' };
  }

  if (trimmed === '/clear') {
    return { handled: true, reply: 'Session memory cleared.', action: 'clear' };
  }

  if (trimmed.startsWith('/contacts')) {
    return {
      handled: true,
      reply: 'Contacts module: ' + new URL('/contacts', config.product.appUrl).toString()
        + '\nUse /contacts search <name> to search your synced contacts, or open the module to edit entries.',
    };
  }

  if (trimmed === '/new' || trimmed === '/reset') {
    return {
      handled: true,
      reply: 'Starting a fresh conversation.',
      action: 'new_session',
    };
  }

  if (trimmed.startsWith('/provider') || trimmed.startsWith('/model')) {
    return handleModelCommand(trimmed, modelContext);
  }

  if (trimmed === '/help') {
    const fullHelp = [
      'CARINA commands',
      '/help - show this message',
      '/capabilities - honest capability list for this channel',
      '/model [provider] [model] - switch LLM provider',
      '/model list - list configured providers',
      '/provider [provider] [model] - alias for /model',
      '/status - session, provider, and continuity mode',
      '/contacts [search <name>|open] - search synced contacts or open the Contacts module',
      '/plan on|off|status - fail-safe read-only tool mode',
      '/new, /reset - fresh conversation',
      '/stop - interrupt the current reply',
      '/memories - list episodic memories',
      '/memories delete <id> - delete a memory',
      '/usage --month - show model token usage and estimated cost',
      '/research <query> - run deep research and return a summary',
      '/compare <prompt> - query multiple configured providers in parallel',
      '/think off|minimal|low|medium|high|xhigh|max|adaptive - set thinking level',
      '/think status - show current thinking level',
      '/fast - toggle fast mode (thinking off temporarily)',
      '/tokens - show current session token usage and cost',
      '/tokens all - show all tracked sessions',
      '/tokens reset - reset counter for current session',
      '/queue steer|followup|collect|interrupt - set message queue mode',
      '/queue status - show queue depth and mode',
      '/queue config - show queue configuration',
      '/standing-orders add|list|remove|toggle|expire - persistent directives',
      '/link [code|claim <code>] - link identities across channels',
      '/identity share on|off - toggle shared sessions across linked channels',
      '/dock list|to <channel>|back|status - move reply stream between channels',
      '/clear-cache [tool] - clear cached tool results',
      '/clear - clear session memory (same thread)',
      `Docs - full capabilities: ${config.product.marketingUrl}/docs/capabilities`,
      '/exit - quit',
    ].join('\n');
    return {
      handled: true,
      reply: formatMessengerHelp(fullHelp, gatewayContext.channel),
    };
  }

  return { handled: false };
}
