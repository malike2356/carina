import { atom } from 'nanostores';

export type MessageRole = 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  durationMs?: number;
  status: 'running' | 'done' | 'error';
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  thinkingContent?: string;
  timestamp: number;
  isStreaming?: boolean;
}

export const $messages = atom<ChatMessage[]>([]);
export const $streamingMessageId = atom<string | null>(null);
export const $isStreaming = atom(false);
export const $currentTurnId = atom<string | null>(null);
export const $streamRequest = atom<{
  sessionId: string;
  message: string;
  turnId: string;
  attachments?: import('../lib/composer-types.js').Attachment[];
} | null>(null);
export const $pendingApproval = atom<{
  toolName: string;
  params: unknown;
  reason: string;
  runId: string;
  level?: 'on-miss' | 'full';
} | null>(null);
