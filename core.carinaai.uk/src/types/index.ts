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
  agentId?: string;
  tenantId?: string;
  content: string;
  source:
    | 'cli'
    | 'telegram'
    | 'whatsapp'
    | 'web'
    | 'discord'
    | 'slack'
    | 'sms'
    | 'signal'
    | 'matrix'
    | 'mattermost'
    | 'dingtalk'
    | 'feishu'
    | 'wechat'
    | 'imessage'
    | 'email'
    | 'homeassistant'
    | 'api'
    | 'webhooks'
    | 'irc';
  timestamp: Date;
  chatType?: 'private' | 'group';
  mentioned?: boolean;
  chatId?: string;
  chatTitle?: string;
  senderName?: string;
  messageId?: string;
  replyToMessageId?: string;
}

export interface CarinaResponse {
  content: string;
  toolsUsed: string[];
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;
  tokensUsed: number;
  provider: string;
  toolCalls?: ToolCall[];
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
  chat: (messages: Message[], tools?: Tool[], model?: string) => Promise<CarinaResponse>;
  stream: (messages: Message[], tools?: Tool[], model?: string) => AsyncGenerator<string | ToolCall>;
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
  agentId?: string;
  workspaceDir?: string;
  allowedTools?: string[];
  /** Gateway channel or runtime surface (cli, telegram, web, ...). */
  platform?: string;
  systemPromptSuffix?: string;
  maxTurns?: number;
  persistMemory?: boolean;
  fastMode?: boolean;
  tenantId?: string;
  orgId?: string;
  providerOverride?: {
    name: string;
    model?: string;
  };
  confirmTool?: (
    toolName: string,
    params: Record<string, unknown>,
    reason: string,
  ) => Promise<boolean>;
  forceConfirm?: boolean;
  abortSignal?: AbortSignal;
}
