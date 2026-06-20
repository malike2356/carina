import { deleteMemory, listRecentMemories } from '../memory/store.js';
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
  activeProvider?: string;
  activeModel?: string;
}

const PLAIN_TEXT_CHANNELS = new Set(['telegram', 'sms', 'signal', 'irc']);

async function formatMemoriesList(): Promise<string> {
  const memories = await listRecentMemories(20);
  if (memories.length === 0) return 'No episodic memories stored yet.';
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

  if (trimmed === '/memories') {
    return { handled: true, reply: await formatMemoriesList() };
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
    const memories = await listRecentMemories(50);
    const match = memories.find((m) => m.id.startsWith(idPrefix) || m.id === idPrefix);
    if (!match) return { handled: true, reply: `No memory found for id prefix: ${idPrefix}` };
    await deleteMemory(match.id);
    return { handled: true, reply: `Deleted memory ${match.id.slice(0, 8)}...` };
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
      '/model [provider] [model] - switch LLM provider',
      '/model list - list configured providers',
      '/provider [provider] [model] - alias for /model',
      '/status - session, provider, and continuity mode',
      '/plan on|off|status - fail-safe read-only tool mode',
      '/new, /reset - fresh conversation',
      '/stop - interrupt the current reply',
      '/memories - list episodic memories',
      '/memories delete <id> - delete a memory',
      '/usage --month - show model token usage and estimated cost',
      '/research <query> - run deep research and return a summary',
      '/compare <prompt> - query multiple configured providers in parallel',
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
