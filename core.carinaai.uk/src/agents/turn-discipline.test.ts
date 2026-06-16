import { describe, expect, it } from 'vitest';
import type { Message } from '../types/index.js';
import {
  augmentFailedToolResult,
  buildFailureHandlingBlock,
  buildSilentTurnPreventionNudge,
  buildTurnDisciplineBlock,
  buildTurnEndingBlock,
  getRecentToolFailures,
  isSilentOrWeakResponse,
  isToolResultFailure,
} from './turn-discipline.js';

describe('buildTurnEndingBlock', () => {
  it('defines DONE, BLOCKED, and KEEP GOING', () => {
    const block = buildTurnEndingBlock();
    expect(block).toContain('(1) DONE:');
    expect(block).toContain('(2) BLOCKED:');
    expect(block).toContain('(3) KEEP GOING:');
    expect(block).toContain('Only end the turn after DONE or BLOCKED');
  });
});

describe('buildFailureHandlingBlock', () => {
  it('forbids silence and fabricated success after failures', () => {
    const block = buildFailureHandlingBlock();
    expect(block).toContain('DO NOT go silent');
    expect(block).toContain('DO NOT pretend it succeeded');
    expect(block).toContain('mid-task information');
    expect(block).toContain('Take one step forward after every failure');
  });
});

describe('buildTurnDisciplineBlock', () => {
  it('includes turn ending and failure handling guidance', () => {
    const block = buildTurnDisciplineBlock();
    expect(block).toContain('How to end a turn:');
    expect(block).toContain('After a tool fails:');
    expect(block).toContain('Bias toward action:');
  });
});

describe('isToolResultFailure', () => {
  it('detects common failure shapes', () => {
    expect(isToolResultFailure({ error: 'timeout' })).toBe(true);
    expect(isToolResultFailure({ status: 'failed' })).toBe(true);
    expect(isToolResultFailure({ ok: false })).toBe(true);
    expect(isToolResultFailure({ code: 'SANDBOX_POLICY_BLOCKED' })).toBe(true);
    expect(isToolResultFailure({ status: 'added', id: '1' })).toBe(false);
    expect(isToolResultFailure({ status: 'awaiting_clarification' })).toBe(false);
  });
});

describe('augmentFailedToolResult', () => {
  it('adds follow-up guidance to failed tool results', () => {
    const augmented = augmentFailedToolResult({ error: 'permission denied' }, 'shell-exec');
    expect(augmented).toMatchObject({
      error: 'permission denied',
      _turnDiscipline: expect.stringContaining('shell-exec failed'),
    });
  });

  it('leaves successful results unchanged', () => {
    const result = { ok: true, stdout: 'done' };
    expect(augmentFailedToolResult(result, 'shell-exec')).toBe(result);
  });
});

describe('getRecentToolFailures', () => {
  it('collects failures since the latest user message', () => {
    const messages: Message[] = [
      { role: 'user', content: 'run tests', timestamp: new Date() },
      {
        role: 'tool_result',
        content: '',
        toolName: 'shell-exec',
        result: { error: 'exit 1' },
        timestamp: new Date(),
      },
      {
        role: 'tool_result',
        content: '',
        toolName: 'file-read',
        result: { content: 'ok' },
        timestamp: new Date(),
      },
    ];
    expect(getRecentToolFailures(messages)).toEqual([
      { toolName: 'shell-exec', summary: 'exit 1' },
    ]);
  });
});

describe('silent turn prevention', () => {
  it('detects empty or very short assistant replies', () => {
    expect(isSilentOrWeakResponse('')).toBe(true);
    expect(isSilentOrWeakResponse('ok')).toBe(true);
    expect(isSilentOrWeakResponse('Tests failed with exit code 1. Retrying with verbose output.')).toBe(false);
  });

  it('builds a nudge that demands follow-up', () => {
    const nudge = buildSilentTurnPreventionNudge([
      { toolName: 'shell-exec', summary: 'command not found' },
    ]);
    expect(nudge).toContain('ended the turn without DONE or BLOCKED');
    expect(nudge).toContain('shell-exec: command not found');
    expect(nudge).toContain('Do not fabricate success');
  });
});
