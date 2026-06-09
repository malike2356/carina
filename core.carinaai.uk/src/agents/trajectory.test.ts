import { describe, expect, it } from 'vitest';
import { compressTrajectory, isStaleToolCall, truncateToolResult } from './trajectory.js';
import type { Message, ToolCall } from '../types/index.js';

describe('trajectory', () => {
  it('truncates large tool results', () => {
    const big = 'x'.repeat(5000);
    const out = truncateToolResult(big);
    expect(String(out)).toContain('[truncated');
  });

  it('detects stale duplicate tool calls', () => {
    const call: ToolCall = {
      type: 'tool_call',
      toolName: 'file-read',
      toolCallId: '1',
      params: { path: '/tmp/a' },
    };
    const recent: ToolCall[] = [
      call,
      { ...call, toolCallId: '2' },
    ];
    expect(isStaleToolCall(call, recent)).toBe(true);
  });

  it('compresses old tool results when many exist', () => {
    const messages: Message[] = [
      { role: 'user', content: 'hi', timestamp: new Date() },
    ];
    for (let i = 0; i < 10; i++) {
      messages.push({
        role: 'tool_result',
        content: '',
        toolCallId: `id-${i}`,
        toolName: 'shell-exec',
        result: 'y'.repeat(5000),
        timestamp: new Date(),
      });
    }
    const compressed = compressTrajectory(messages);
    const old = compressed.find((m) => m.toolCallId === 'id-0');
    expect(old?.content).toBe('[compressed tool result]');
  });
});
