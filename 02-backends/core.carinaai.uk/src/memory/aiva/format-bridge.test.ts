import { describe, expect, it } from 'vitest';

describe('formatBridgeHistoryForPrompt', () => {
  it('formats and truncates history', async () => {
    const { formatBridgeHistoryForPrompt } = await import('./conversation-bridge.js');
    const text = formatBridgeHistoryForPrompt([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ]);
    expect(text).toContain('user: hello');
    expect(text).toContain('assistant: hi there');
    expect(text).toMatch(/Recent conversation history/);
  });

  it('prepends summary and reserves budget', async () => {
    const { formatBridgeHistoryForPrompt } = await import('./conversation-bridge.js');
    const text = formatBridgeHistoryForPrompt(
      [
        { role: 'user', content: 'latest' },
        { role: 'assistant', content: 'ok' },
      ],
      12_000,
      { summaryPrefix: '## Conversation summary (earlier)\n\n1. User wants masters certificate\n\n---' },
    );
    expect(text).toContain('Conversation summary');
    expect(text).toContain('masters certificate');
    expect(text).toContain('user: latest');
  });
});
