import type { Message, ToolCall } from '../types/index.js';

const MAX_TOOL_RESULT_CHARS = 4000;
const COMPRESS_AFTER_TURNS = 8;

export function truncateToolResult(result: unknown): unknown {
  const str = typeof result === 'string' ? result : JSON.stringify(result);
  if (str.length <= MAX_TOOL_RESULT_CHARS) return result;
  const truncated = `${str.slice(0, MAX_TOOL_RESULT_CHARS)}...[truncated ${str.length - MAX_TOOL_RESULT_CHARS} chars]`;
  try {
    return JSON.parse(truncated);
  } catch {
    return truncated;
  }
}

export function compressTrajectory(messages: Message[]): Message[] {
  const toolResults = messages.filter((m) => m.role === 'tool_result');
  if (toolResults.length < COMPRESS_AFTER_TURNS) return messages;

  const keepRecent = 4;
  const oldResults = toolResults.slice(0, -keepRecent);
  const oldIds = new Set(oldResults.map((m) => m.toolCallId).filter(Boolean));

  return messages.map((m) => {
    if (m.role !== 'tool_result' || !m.toolCallId || !oldIds.has(m.toolCallId)) return m;
    return {
      ...m,
      result: truncateToolResult(m.result),
      content: '[compressed tool result]',
    };
  });
}

export function isStaleToolCall(call: ToolCall, recentCalls: ToolCall[]): boolean {
  const signature = `${call.toolName}:${JSON.stringify(call.params)}`;
  const duplicates = recentCalls.filter(
    (c) => `${c.toolName}:${JSON.stringify(c.params)}` === signature,
  );
  return duplicates.length >= 2;
}

export function summarizeToolTrajectory(toolCallLog: string[]): string {
  if (toolCallLog.length === 0) return '';
  const counts = new Map<string, number>();
  for (const entry of toolCallLog) {
    const name = entry.split(':')[0];
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const lines = [...counts.entries()].map(([tool, count]) => `${tool} x${count}`);
  return `Tools used this turn: ${lines.join(', ')}`;
}
