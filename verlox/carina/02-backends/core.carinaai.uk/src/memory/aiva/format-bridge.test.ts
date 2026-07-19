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
});
