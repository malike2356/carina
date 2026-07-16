import { getLogLines } from '../log-buffer.js';
import { renderTimelineLines, type RuntimeTimelineEvent } from '../runtime-events/timeline-store.js';

export interface DebugStateInput {
  sessionId?: string;
  model?: string;
  provider?: string;
  overlay: string;
  transportMode: string;
  connected: boolean;
  terminalColumns: number;
  terminalRows: number;
  messageCount: number;
  tokenCount: number;
  lastCommand?: string;
  events: RuntimeTimelineEvent[];
}

export interface DebugState {
  lines: string[];
  copyable: string;
}

export function buildDebugState(input: DebugStateInput): DebugState {
  const recentLogs = getLogLines().slice(-8).map(sanitizeDebugLine);
  const eventLines = renderTimelineLines(input.events.slice(-8), 100).map(sanitizeDebugLine);
  const lines = [
    'Debug overlay',
    `Session: ${shortId(input.sessionId)}`,
    `Model: ${sanitizeDebugLine([input.provider, input.model].filter(Boolean).join('/') || 'unknown')}`,
    `Overlay: ${sanitizeDebugLine(input.overlay)}`,
    `Transport: ${sanitizeDebugLine(input.transportMode)} ${input.connected ? 'connected' : 'offline'}`,
    `Terminal: ${input.terminalColumns}x${input.terminalRows}`,
    `Messages: ${input.messageCount}`,
    `Tokens: ${input.tokenCount}`,
    `Last command: ${sanitizeDebugLine(input.lastCommand ?? 'none')}`,
    'Recent events:',
    ...(eventLines.length > 0 ? eventLines : ['none']),
    'Recent errors:',
    ...(recentLogs.length > 0 ? recentLogs : ['none']),
  ];
  return {
    lines,
    copyable: lines.join('\n'),
  };
}

export function sanitizeDebugLine(line: string): string {
  return line
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\b(?:sk|pk|rk|whsec|xoxb|ghp|github_pat)_[A-Za-z0-9_=-]{8,}\b/g, '[secret]')
    .replace(/\b(token|secret|password|api[_-]?key)=\S+/gi, '$1=[redacted]');
}

function shortId(id: string | undefined): string {
  if (!id) return 'none';
  if (/^[0-9a-f-]{36}$/i.test(id)) return `${id.slice(0, 8)}...`;
  return sanitizeDebugLine(id.slice(0, 16));
}
