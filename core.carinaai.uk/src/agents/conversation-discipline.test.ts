import { describe, expect, it } from 'vitest';
import {
  buildCasualMessageContext,
  buildConversationDisciplineBlock,
  extractUserMessageForClassification,
  isCasualMessage,
} from './conversation-discipline.js';

describe('isCasualMessage', () => {
  it('detects short social messages', () => {
    expect(isCasualMessage('thanks!')).toBe(true);
    expect(isCasualMessage('hey')).toBe(true);
    expect(isCasualMessage('lol')).toBe(true);
  });

  it('does not treat task requests as casual', () => {
    expect(isCasualMessage('run the tests')).toBe(false);
    expect(isCasualMessage('can you deploy this?')).toBe(false);
    expect(isCasualMessage('remember my API key')).toBe(false);
  });

  it('reads the user line from wrapped group context', () => {
    const wrapped = 'Group chat context (telegram):\n...\n\nMessage:\nthanks';
    expect(extractUserMessageForClassification(wrapped)).toBe('thanks');
    expect(isCasualMessage(wrapped)).toBe(true);
  });
});

describe('buildConversationDisciplineBlock', () => {
  it('covers casual and group chat rules', () => {
    const block = buildConversationDisciplineBlock();
    expect(block).toContain('Casual messages:');
    expect(block).toContain('Group chats:');
    expect(block).toContain('NO_RESPONSE_NEEDED');
  });
});

describe('buildCasualMessageContext', () => {
  it('tells the model to skip tools for casual input', () => {
    expect(buildCasualMessageContext()).toContain('no tools');
  });
});
