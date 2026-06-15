import { deleteMemory, listRecentMemories } from '../memory/store.js';
import { formatCostReport, getMonthlyReport } from '../brain/cost-tracker.js';
import { clearToolCache } from '../tools/cache.js';
import path from 'node:path';
import {
  handleModelCommand,
  type ModelCommandContext,
} from './model-command.js';

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
      action?: 'exit' | 'clear';
      attachment?: { path: string; filename: string };
    }
  | { handled: false };

export interface GatewayCommandContext {
  sessionId?: string;
  channel?: string;
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
      const reply = formatGatewaySummary(report, plain);
      return {
        handled: true,
        reply: `${reply}\n\nFull report saved to ${reportPath}`,
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

  return handleGatewayCommand(trimmed);
}

export function handleGatewayCommand(input: string, modelContext: ModelCommandContext = {}): CommandResult {
  const trimmed = input.trim();

  if (trimmed === '/exit') {
    return { handled: true, reply: 'Goodbye.', action: 'exit' };
  }

  if (trimmed === '/clear') {
    return { handled: true, reply: 'Session memory cleared.', action: 'clear' };
  }

  if (trimmed.startsWith('/provider') || trimmed.startsWith('/model')) {
    return handleModelCommand(trimmed, modelContext);
  }

  if (trimmed === '/help') {
    return {
      handled: true,
      reply: [
        'CARINA commands',
        '/help - show this message',
        '/model [provider] [model] - switch LLM provider',
        '/model list - list configured providers',
        '/provider [provider] [model] - alias for /model',
        '/memories - list episodic memories',
        '/memories delete <id> - delete a memory',
        '/usage --month - show model token usage and estimated cost',
        '/research <query> - run deep research and return a summary',
        '/compare <prompt> - query multiple configured providers in parallel',
        '/clear-cache [tool] - clear cached tool results',
        '/clear - fresh start (compact identity screen)',
        'Docs - full capabilities: https://carinaai.uk/docs/capabilities',
        '/exit - quit',
      ].join('\n'),
    };
  }

  return { handled: false };
}
