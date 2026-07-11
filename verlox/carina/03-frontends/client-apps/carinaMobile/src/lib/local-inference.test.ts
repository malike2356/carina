import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ChatMessage } from '@/api/types';
import {
  _resetLocalInferenceForTests,
  buildLocalPromptMessages,
  initLocalModel,
  isLocalModelReady,
  localChatStream,
} from './local-inference';

vi.mock('llama.rn', () => ({
  initLlama: vi.fn(async () => ({
    completion: vi.fn(async ({ messages }: { messages?: Array<{ role: string; content: string }> }) => ({
      text: `Reply to: ${messages?.at(-1)?.content ?? ''}`,
    })),
    release: vi.fn(async () => undefined),
  })),
}));

describe('local-inference', () => {
  beforeEach(() => {
    _resetLocalInferenceForTests();
  });

  it('builds Gemma-style prompt messages with system preamble', () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString(),
      },
    ];
    const built = buildLocalPromptMessages(history);
    expect(built[0]?.role).toBe('system');
    expect(built[0]?.content).toContain('running locally');
    expect(built[1]?.content).toBe('Hello');
  });

  it('streams word chunks after completion', async () => {
    const ok = await initLocalModel('/tmp/model.gguf');
    expect(ok).toBe(true);
    expect(isLocalModelReady()).toBe(true);

    const chunks: string[] = [];
    for await (const token of localChatStream([], undefined)) {
      chunks.push(token);
    }
    expect(chunks.join('')).toContain('Reply to:');
  });
});
