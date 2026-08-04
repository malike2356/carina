import { describe, expect, it } from 'vitest';
import { ChatStreamError } from './chat-errors';
import { normalizeCoreEvent } from './carina-chat';

describe('normalizeCoreEvent', () => {
  it('uses core error content instead of stringifying the error object', () => {
    expect(() =>
      normalizeCoreEvent({
        type: 'error',
        content: '[unknown] Connection is closed.',
        error: { message: 'Connection is closed.' },
      }),
    ).toThrow(new ChatStreamError('[unknown] Connection is closed.', 'CHAT_FAILED'));
  });

  it('falls back to a nested core error message', () => {
    expect(() =>
      normalizeCoreEvent({
        type: 'error',
        error: { message: 'Connection is closed.' },
      }),
    ).toThrow(new ChatStreamError('Connection is closed.', 'CHAT_FAILED'));
  });
});
