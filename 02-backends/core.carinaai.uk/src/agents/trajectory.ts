import type { Message, ToolCall } from '../types/index.js';
import { loadTrajectoryConfig, type TrajectoryCompressionConfig } from './trajectory-config.js';
import { summarizeToolResult } from './trajectory-summarize.js';
import { isEvidenceTool } from '../memory/tool-working-set.js';

export interface TrajectoryCompressionStats {
  beforeChars: number;
  afterChars: number;
  compressedToolResults: number;
  truncatedToolResults: number;
}

function resultToText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result === undefined || result === null) return '';
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

export function estimateTrajectoryChars(messages: Message[]): number {
  let total = 0;
  for (const m of messages) {
    total += m.content.length;
    total += resultToText(m.result).length;
    if (m.toolCalls?.length) {
      total += JSON.stringify(m.toolCalls).length;
    }
  }
  return total;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function truncateToolResult(
  result: unknown,
  maxChars = loadTrajectoryConfig().maxToolResultChars,
): unknown {
  const record = asRecord(result);
  if (record) {
    const copy: Record<string, unknown> = { ...record };
    let changed = false;
    for (const key of ['stdout', 'stderr', 'content', 'body', 'text', 'output', 'data', 'snapshot']) {
      const val = copy[key];
      if (typeof val === 'string' && val.length > maxChars) {
        copy[key] = `${val.slice(0, maxChars)}...[truncated ${val.length - maxChars} chars]`;
        changed = true;
      }
    }
    if (changed) return copy;
  }

  const str = resultToText(result);
  if (str.length <= maxChars) return result;
  const truncated = `${str.slice(0, maxChars)}...[truncated ${str.length - maxChars} chars]`;
  try {
    return JSON.parse(truncated);
  } catch {
    return truncated;
  }
}

function stableParamsSignature(params: Record<string, unknown>): string {
  const keys = Object.keys(params).sort();
  const normalized: Record<string, unknown> = {};
  for (const key of keys) normalized[key] = params[key];
  return JSON.stringify(normalized);
}

export function isStaleToolCall(call: ToolCall, recentCalls: ToolCall[]): boolean {
  const signature = `${call.toolName}:${stableParamsSignature(call.params)}`;
  const duplicates = recentCalls.filter(
    (c) => `${c.toolName}:${stableParamsSignature(c.params)}` === signature,
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

function findAssistantForTool(messages: Message[], toolCallId: string): Message | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant' || !m.toolCalls?.length) continue;
    if (m.toolCalls.some((c) => c.toolCallId === toolCallId)) return m;
  }
  return undefined;
}

function compressToolMessage(
  message: Message,
  level: 'truncate' | 'summary' | 'minimal',
  cfg: TrajectoryCompressionConfig,
  assistant?: Message,
): Message {
  const toolName = message.toolName ?? 'tool';
  const params = assistant?.toolCalls?.find((c) => c.toolCallId === message.toolCallId)?.params;

  if (level === 'truncate') {
    return {
      ...message,
      result: truncateToolResult(message.result, cfg.maxToolResultChars),
    };
  }

  if (level === 'summary') {
    const summary = summarizeToolResult(toolName, message.result, params, cfg.summaryMaxChars);
    return {
      ...message,
      result: summary,
      content: `[compressed ${toolName}] ${summary}`,
    };
  }

  const record = message.result && typeof message.result === 'object'
    ? message.result as Record<string, unknown>
    : null;
  const err = record?.error ? ` error=${String(record.error).slice(0, 120)}` : '';
  const minimal = `[${toolName}]${err || ' ok'}`;
  return {
    ...message,
    result: minimal,
    content: minimal,
  };
}

function compressAssistantMessage(message: Message): Message {
  if (!message.toolCalls?.length) return message;
  const tools = message.toolCalls.map((c) => c.toolName).join(', ');
  const note = message.content.trim()
    ? `${message.content.trim()}\n[tools: ${tools}]`
    : `[tools: ${tools}]`;
  return {
    ...message,
    content: note.length > 500 ? `${note.slice(0, 500)}...` : note,
  };
}

export function compressTrajectory(
  messages: Message[],
  overrides: Partial<TrajectoryCompressionConfig> = {},
): Message[] {
  return compressTrajectoryWithStats(messages, overrides).messages;
}

export function compressTrajectoryWithStats(
  messages: Message[],
  overrides: Partial<TrajectoryCompressionConfig> = {},
): { messages: Message[]; stats: TrajectoryCompressionStats } {
  const cfg = { ...loadTrajectoryConfig(), ...overrides };
  const stats: TrajectoryCompressionStats = {
    beforeChars: estimateTrajectoryChars(messages),
    afterChars: 0,
    compressedToolResults: 0,
    truncatedToolResults: 0,
  };

  if (!cfg.enabled || messages.length === 0) {
    stats.afterChars = stats.beforeChars;
    return { messages, stats };
  }

  let working = messages.map((m) => ({ ...m }));

  // Always cap oversized individual tool payloads.
  // Evidence tools (Drive/Gmail reads) keep a larger window so mid-turn "read all"
  // does not collapse CV bodies into tiny summaries.
  working = working.map((m) => {
    if (m.role !== 'tool_result') return m;
    const maxChars = isEvidenceTool(m.toolName)
      ? Math.max(cfg.maxToolResultChars, 12_000)
      : cfg.maxToolResultChars;
    const raw = resultToText(m.result);
    if (raw.length <= maxChars) return m;
    stats.truncatedToolResults++;
    return compressToolMessage(m, 'truncate', { ...cfg, maxToolResultChars: maxChars });
  });

  const toolIndices = working
    .map((m, idx) => (m.role === 'tool_result' ? idx : -1))
    .filter((idx) => idx >= 0);

  if (toolIndices.length < cfg.compressAfterToolResults && estimateTrajectoryChars(working) <= cfg.maxTrajectoryChars) {
    stats.afterChars = estimateTrajectoryChars(working);
    return { messages: working, stats };
  }

  const protectedIds = new Set(
    toolIndices
      .slice(-cfg.keepRecentToolRounds)
      .map((idx) => working[idx].toolCallId)
      .filter(Boolean) as string[],
  );

  const compressIds = new Set(
    toolIndices
      .slice(0, Math.max(0, toolIndices.length - cfg.keepRecentToolRounds))
      .map((idx) => working[idx].toolCallId)
      .filter(Boolean) as string[],
  );

  const assistantCompressed = new Set<string>();

  for (let i = 0; i < working.length; i++) {
    const m = working[i];
    if (m.role !== 'tool_result' || !m.toolCallId || !compressIds.has(m.toolCallId)) continue;
    if (protectedIds.has(m.toolCallId)) continue;
    // Keep evidence tool bodies as truncated text, not 600-char summaries.
    if (isEvidenceTool(m.toolName)) {
      const maxChars = Math.max(cfg.maxToolResultChars, 8_000);
      const raw = resultToText(m.result);
      if (raw.length > maxChars) {
        working[i] = compressToolMessage(m, 'truncate', { ...cfg, maxToolResultChars: maxChars });
        stats.truncatedToolResults++;
      }
      continue;
    }

    const assistant = findAssistantForTool(working, m.toolCallId);
    working[i] = compressToolMessage(m, 'summary', cfg, assistant);
    stats.compressedToolResults++;

    if (assistant && !assistantCompressed.has(m.toolCallId)) {
      assistantCompressed.add(m.toolCallId);
      const aIdx = working.indexOf(assistant);
      if (aIdx >= 0) working[aIdx] = compressAssistantMessage(assistant);
    }
  }

  // Budget pass: apply heavier compression oldest-first until under limit.
  let guard = 0;
  while (estimateTrajectoryChars(working) > cfg.maxTrajectoryChars && guard < 50) {
    guard++;
    const idx = toolIndices.find((ti) => {
      const id = working[ti].toolCallId;
      return id && compressIds.has(id) && !protectedIds.has(id);
    });
    if (idx === undefined) break;

    const m = working[idx];
    if (!m.toolCallId) break;
    const assistant = findAssistantForTool(working, m.toolCallId);
    const current = resultToText(m.result);
    if (current.length <= 80) {
      compressIds.delete(m.toolCallId);
      continue;
    }
    working[idx] = compressToolMessage(m, 'minimal', cfg, assistant);
  }

  stats.afterChars = estimateTrajectoryChars(working);
  return { messages: working, stats };
}
