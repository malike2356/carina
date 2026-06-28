import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';

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
  source: ChannelName;
  timestamp: Date;
  chatType?: 'private' | 'group';
  mentioned?: boolean;
  chatId?: string;
  chatTitle?: string;
  senderName?: string;
  channelUserId?: string;
  canonicalUserId?: string;
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
  successCount?: number;
  failureCount?: number;
  tags?: string[];
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

export interface Worker {
  id: string;
  workspaceId: string;
  name: string;
  roleDescription: string;
  templateId: string | null;
  personaPrompt: string;
  skillPacks: string[];
  channels: string[];
  language: string;
  status: 'active' | 'paused' | 'dismissed';
  escalationThreshold: number;
  propreneurTenantSlug?: string | null;
  propreneurBridgeKeyRef?: string | null;
  workerConfig?: WorkerConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkerSummaryConfig {
  enabled?: boolean;
  deliveryTime?: string;
  /** Cron expression (Europe/London); defaults to AIVA_DAILY_SUMMARY_CRON or 0 7 * * * */
  summarySchedule?: string;
  deliveryChannel?: string;
  includeAudio?: boolean;
  sections?: string[];
}

export interface WorkerWidgetConfig {
  welcomeMessage?: string;
  accentColor?: string;
}

export interface WorkerConfig {
  summary?: WorkerSummaryConfig;
  widget?: WorkerWidgetConfig;
}

export interface ActivityEntry {
  id: string;
  workerId: string;
  actionType: 'message_received' | 'message_sent' | 'task_completed' | 'escalated' | 'skill_used' | 'automation_run' | 'summary_sent' | 'va_reply';
  summary: string;
  inputText?: string;
  outputText?: string;
  escalated: boolean;
  attestationTx?: string | null;
  channel?: string;
  contactId?: string;
  createdAt: Date;
}

export interface AuditEntry extends ActivityEntry {
  attestationTx: string | null;
}

export interface Escalation {
  id: string;
  workerId: string;
  workspaceId: string;
  channel: string;
  channelId: string;
  originalInput: string;
  workerDraft?: string;
  holdingMessage: string;
  status: 'open' | 'assigned' | 'resolved';
  assignedTo?: string;
  resolvedAt?: Date;
  resolutionText?: string;
  createdAt: Date;
}

export interface WorkerAutomation {
  id: string;
  workerId: string;
  workspaceId: string;
  name: string;
  description: string;
  cronExpression: string;
  scheduleLabel: string;
  triggerType: 'cron' | 'event';
  triggerEvent?: string;
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
}

export interface CreateWorkerParams {
  name: string;
  roleDescription: string;
  templateId?: string | null;
  personaPrompt: string;
  skillPacks: string[];
  channels: string[];
  language?: string;
  escalationThreshold?: number;
}

export interface UpdateWorkerParams {
  name?: string;
  roleDescription?: string;
  personaPrompt?: string;
  language?: string;
  skillPacks?: string[];
  channels?: string[];
}

export interface CreateEscalationParams {
  workerId: string;
  workspaceId: string;
  channel: string;
  channelId: string;
  originalInput: string;
  workerDraft?: string;
  holdingMessage: string;
}

export interface CreateAutomationParams {
  name: string;
  description: string;
  cronExpression: string;
  scheduleLabel: string;
}

export interface WorkerContext {
  worker: Worker;
  personaPrompt: string;
}
