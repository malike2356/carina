export type Role = 'user' | 'assistant' | 'system' | 'tool_result';

export interface Message {
  role: Role;
  content: string;
  timestamp: Date;
  toolCallId?: string;
  toolName?: string;
  result?: unknown;
  toolCalls?: ToolCall[];
}

export interface CarinaMessage {
  id: string;
  sessionId: string;
  content: string;
  source: 'cli' | 'telegram' | 'whatsapp' | 'web';
  timestamp: Date;
}

export interface CarinaResponse {
  content: string;
  toolsUsed: string[];
  tokensUsed: number;
  provider: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
  requiresConfirmation?: boolean;
  dangerous?: boolean;
  needsConfirmation?: (params: Record<string, unknown>) => Promise<boolean> | boolean;
}

export interface ToolCall {
  type: 'tool_call';
  toolName: string;
  toolCallId: string;
  params: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  trigger: string[];
  steps: string;
  toolsUsed: string[];
  createdAt: Date;
  usageCount: number;
}

export interface Memory {
  id: string;
  sessionId: string;
  role?: Role;
  content: string;
  embedding?: number[];
  createdAt: Date;
}

export interface LLMProvider {
  name: string;
  chat: (messages: Message[], tools?: Tool[]) => Promise<CarinaResponse>;
  stream: (messages: Message[], tools?: Tool[]) => AsyncGenerator<string | ToolCall>;
}

export type SubAgentType = 'research' | 'coding' | 'communication' | 'file' | 'direct';

export interface TaskPlanStep {
  description: string;
  agentType: SubAgentType;
  dependsOn: number[];
}

export interface TaskPlan {
  singleAgent: boolean;
  steps: TaskPlanStep[];
}

export interface AgentOptions {
  allowedTools?: string[];
  systemPromptSuffix?: string;
  maxTurns?: number;
  persistMemory?: boolean;
  confirmTool?: (
    toolName: string,
    params: Record<string, unknown>,
    reason: string,
  ) => Promise<boolean>;
  forceConfirm?: boolean;
}
