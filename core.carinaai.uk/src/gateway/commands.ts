import { llm } from '../brain/llm.js';
import { deleteMemory, listRecentMemories } from '../memory/store.js';

export type CommandResult =
  | { handled: true; reply: string }
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

export function handleGatewayCommand(input: string): CommandResult {
  const trimmed = input.trim();

  if (trimmed.startsWith('/provider')) {
    const parts = trimmed.split(/\s+/);
    if (parts[1]) {
      try {
        llm.use(parts[1]);
        return { handled: true, reply: `Provider switched to: ${parts[1]}` };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { handled: true, reply: msg };
      }
    }
    return {
      handled: true,
      reply: `Available providers: ${llm.list().join(', ')}\nUsage: /provider deepseek`,
    };
  }

  if (trimmed === '/help') {
    return {
      handled: true,
      reply: [
        'Commands:',
        '/provider [name] - switch LLM provider',
        '/provider - list providers',
        '/memories - list episodic memories',
        '/memories delete <id> - delete a memory',
        '/clear - reset session memory',
        '/help - show this message',
      ].join('\n'),
    };
  }

  return { handled: false };
}
