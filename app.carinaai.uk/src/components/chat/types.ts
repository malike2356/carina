export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  status?: 'running' | 'done' | 'error';
}

export interface LiveToolCall extends Omit<ToolCall, 'status'> {
  status: 'running' | 'done' | 'error';
}

export interface ContextPin {
  id: string;
  label: string;
  pinType: 'note' | 'document' | 'text';
  content: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: ToolCall[];
  thinkingContent?: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  model: string;
  createdAt: string;
  streaming?: boolean;
}
