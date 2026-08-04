import { describe, expect, it, beforeEach } from 'vitest';
import {
  createClarifyTool,
  getPendingClarification,
  clearPendingClarification,
} from './clarify.js';

const SESSION = 'test-session';
const SESSION_B = 'other-session';

describe('clarify tool', () => {
  beforeEach(() => {
    clearPendingClarification(SESSION);
    clearPendingClarification(SESSION_B);
  });

  it('returns awaiting_clarification status with question and choices', async () => {
    const tool = createClarifyTool(SESSION);
    const result = await tool.execute({
      question: 'Which format do you want?',
      choices: ['PDF', 'Markdown'],
    }) as { status: string; question: string; choices: string[] };

    expect(result.status).toBe('awaiting_clarification');
    expect(result.question).toBe('Which format do you want?');
    expect(result.choices).toEqual(['PDF', 'Markdown']);
  });

  it('stores the pending clarification', async () => {
    const tool = createClarifyTool(SESSION);
    await tool.execute({ question: 'Pick one', choices: ['A', 'B'] });

    const pending = getPendingClarification(SESSION);
    expect(pending?.question).toBe('Pick one');
    expect(pending?.choices).toEqual(['A', 'B']);
    expect(pending?.sessionId).toBe(SESSION);
  });

  it('returns error when question is empty', async () => {
    const tool = createClarifyTool(SESSION);
    const result = await tool.execute({ question: '   ' }) as { error: string };
    expect(result.error).toBe('Question is required.');
  });

  it('caps choices at 4', async () => {
    const tool = createClarifyTool(SESSION);
    const result = await tool.execute({
      question: 'Pick one',
      choices: ['A', 'B', 'C', 'D', 'E', 'F'],
    }) as { choices: string[] };

    expect(result.choices).toHaveLength(4);
    expect(result.choices).toEqual(['A', 'B', 'C', 'D']);

    const pending = getPendingClarification(SESSION);
    expect(pending?.choices).toEqual(['A', 'B', 'C', 'D']);
  });

  it('clearPendingClarification removes the pending entry', async () => {
    const tool = createClarifyTool(SESSION);
    await tool.execute({ question: 'Test?' });
    expect(getPendingClarification(SESSION)).toBeDefined();

    clearPendingClarification(SESSION);
    expect(getPendingClarification(SESSION)).toBeUndefined();
  });

  it('sessions are isolated - different sessionId different pending state', async () => {
    const toolA = createClarifyTool(SESSION);
    const toolB = createClarifyTool(SESSION_B);
    await toolA.execute({ question: 'From A?' });
    await toolB.execute({ question: 'From B?' });

    expect(getPendingClarification(SESSION)?.question).toBe('From A?');
    expect(getPendingClarification(SESSION_B)?.question).toBe('From B?');
  });

  it('treats choices as empty when passed as a string', async () => {
    const tool = createClarifyTool(SESSION);
    const result = await tool.execute({
      question: 'Which format?',
      choices: 'PDF' as unknown as string[],
    }) as { status: string; choices?: string[] };

    expect(result.status).toBe('awaiting_clarification');
    expect(result.choices).toBeUndefined();
  });

  it('does not throw when choices is null', async () => {
    const tool = createClarifyTool(SESSION);
    const result = await tool.execute({
      question: 'Which format?',
      choices: null as unknown as string[],
    }) as { status: string; choices?: string[] };

    expect(result.status).toBe('awaiting_clarification');
    expect(result.choices).toBeUndefined();
  });

  it('returns error for empty params without throwing', async () => {
    const tool = createClarifyTool(SESSION);
    const result = await tool.execute({}) as { error: string };
    expect(result.error).toBe('Question is required.');
  });
});
