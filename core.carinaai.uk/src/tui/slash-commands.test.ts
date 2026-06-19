import { describe, expect, it, vi } from 'vitest';
import { formatTuiHelp, handleTuiSlashCommand } from './slash-commands.js';

vi.mock('../gateway/commands.js', () => ({
  handleGatewayCommandAsync: vi.fn(async (input: string) => {
    if (input.startsWith('/model')) {
      return { handled: true, reply: 'model ok' };
    }
    return { handled: false };
  }),
}));

describe('tui slash commands', () => {
  it('lists help text', () => {
    expect(formatTuiHelp()).toContain('/retry');
    expect(formatTuiHelp()).toContain('/tasks');
  });

  it('starts a new session on /new', async () => {
    const result = await handleTuiSlashCommand('/new', {
      sessionId: 'old',
      lastUserMessage: '',
      resetSession: () => 'new-session',
      abortTurn: () => {},
      switchView: () => {},
    });
    expect(result.handled).toBe(true);
    expect(result.newSessionId).toBe('new-session');
  });

  it('retries the last user message', async () => {
    const result = await handleTuiSlashCommand('/retry', {
      sessionId: 's1',
      lastUserMessage: 'deploy staging',
      resetSession: () => 's2',
      abortTurn: () => {},
      switchView: () => {},
    });
    expect(result.retryMessage).toBe('deploy staging');
  });

  it('delegates gateway slash commands', async () => {
    const result = await handleTuiSlashCommand('/model list', {
      sessionId: 's1',
      lastUserMessage: '',
      resetSession: () => 's2',
      abortTurn: () => {},
      switchView: () => {},
    });
    expect(result.reply).toBe('model ok');
  });
});
