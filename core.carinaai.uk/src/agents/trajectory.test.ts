import { describe, expect, it } from 'vitest';
import {
  compressTrajectory,
  compressTrajectoryWithStats,
  estimateTrajectoryChars,
  isStaleToolCall,
  truncateToolResult,
} from './trajectory.js';
import { summarizeToolResult } from './trajectory-summarize.js';
import type { Message, ToolCall } from '../types/index.js';

describe('trajectory', () => {
  it('truncates large tool results', () => {
    const big = 'x'.repeat(5000);
    const out = truncateToolResult(big, 4000);
    expect(String(out)).toContain('[truncated');
  });

  it('detects stale duplicate tool calls with stable param ordering', () => {
    const call: ToolCall = {
      type: 'tool_call',
      toolName: 'file-read',
      toolCallId: '1',
      params: { path: '/tmp/a' },
    };
    const reversed: ToolCall = {
      ...call,
      toolCallId: '2',
      params: { path: '/tmp/a' },
    };
    expect(isStaleToolCall(call, [call, reversed])).toBe(true);
  });

  it('summarizes shell output with exit code and tail', () => {
    const summary = summarizeToolResult('shell-exec', {
      exit_code: 0,
      stdout: 'line1\nline2\nline3\n'.repeat(20),
    });
    expect(summary).toContain('exit=0');
    expect(summary).toContain('stdout tail');
  });

  it('compresses old tool results into structured summaries', () => {
    const messages: Message[] = [
      { role: 'user', content: 'hi', timestamp: new Date() },
    ];
    for (let i = 0; i < 10; i++) {
      messages.push({
        role: 'assistant',
        content: '',
        toolCalls: [{
          type: 'tool_call',
          toolName: 'shell-exec',
          toolCallId: `id-${i}`,
          params: { command: `echo ${i}` },
        }],
        timestamp: new Date(),
      });
      messages.push({
        role: 'tool_result',
        content: '',
        toolCallId: `id-${i}`,
        toolName: 'shell-exec',
        result: { exit_code: 0, stdout: 'y'.repeat(5000) },
        timestamp: new Date(),
      });
    }

    const { messages: compressed, stats } = compressTrajectoryWithStats(messages, {
      compressAfterToolResults: 6,
      keepRecentToolRounds: 3,
    });
    const old = compressed.find((m) => m.toolCallId === 'id-0');
    expect(stats.compressedToolResults).toBeGreaterThan(0);
    expect(String(old?.result)).toContain('exit=0');
    expect(estimateTrajectoryChars(compressed)).toBeLessThan(estimateTrajectoryChars(messages));
  });

  it('respects trajectory char budget with heavier compression', () => {
    const messages: Message[] = [
      { role: 'user', content: 'run checks', timestamp: new Date() },
    ];
    for (let i = 0; i < 12; i++) {
      messages.push({
        role: 'tool_result',
        content: '',
        toolCallId: `id-${i}`,
        toolName: 'file-read',
        result: { content: 'z'.repeat(8000), path: `/tmp/${i}.txt` },
        timestamp: new Date(),
      });
    }

    const compressed = compressTrajectory(messages, {
      maxTrajectoryChars: 20_000,
      compressAfterToolResults: 4,
      keepRecentToolRounds: 2,
    });
    expect(estimateTrajectoryChars(compressed)).toBeLessThanOrEqual(20_000);
  });

  it('can disable compression', () => {
    const messages: Message[] = [{
      role: 'tool_result',
      content: '',
      toolCallId: '1',
      toolName: 'shell-exec',
      result: 'a'.repeat(9000),
      timestamp: new Date(),
    }];
    const out = compressTrajectory(messages, { enabled: false });
    expect(out).toBe(messages);
  });
});
