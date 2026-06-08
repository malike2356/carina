import { deleteMemory, listRecentMemories } from '../memory/store.js';
import { formatCostReport, getMonthlyReport } from '../brain/cost-tracker.js';
import {
  handleModelCommand,
  type ModelCommandContext,
} from './model-command.js';

export type CommandResult =
  | { handled: true; reply: string; action?: 'exit' | 'clear' }
  | { handled: false };

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

export async function handleGatewayCommandAsync(input: string): Promise<CommandResult> {
  const trimmed = input.trim();

  if (trimmed === '/memories') {
    return { handled: true, reply: await formatMemoriesList() };
  }

  if (trimmed === '/usage' || trimmed === '/usage --month') {
    return { handled: true, reply: formatCostReport(await getMonthlyReport()) };
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
        'Commands:',
        '/model [provider] [model] - switch LLM provider',
        '/model list - list configured providers',
        '/provider [provider] [model] - alias for /model',
        '/memories - list episodic memories',
        '/memories delete <id> - delete a memory',
        '/usage --month - show model token usage and estimated cost',
        '/clear - reset session memory',
        '/exit - quit the CLI',
        '/help - show this message',
      ].join('\n'),
    };
  }

  return { handled: false };
}
