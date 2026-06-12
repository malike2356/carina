export interface AgentMessage {
  role: string;
  content: string;
}

export interface ToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface NormalizedRequest {
  agentType: string;
  sessionId?: string;
  prompt: string;
  messages: AgentMessage[];
  toolCalls: ToolCall[];
  raw: unknown;
  stream?: boolean;
}

export interface NormalizedResponse {
  agentType: string;
  content: string;
  toolCalls: ToolCall[];
  raw: unknown;
  stream?: boolean;
}

export interface AdapterContext {
  path?: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export interface ScoutDecision {
  blocked: boolean;
  reason?: string;
  decision?: import('../security/policy-decisions.js').PolicyDecisionKind;
  policyDecision?: import('../security/policy-decisions.js').PolicyDecision;
  filteredContent?: string;
  code?: string;
  request: NormalizedRequest;
}

export interface IAgentAdapter {
  readonly agentType: string;
  parseRequest(raw: unknown, context?: AdapterContext): NormalizedRequest;
  parseResponse(raw: unknown, context?: AdapterContext): NormalizedResponse;
  formatResponse(response: NormalizedResponse, context?: AdapterContext): unknown;
  extractToolCalls(raw: unknown): ToolCall[];
  resolveUpstreamPath?(path: string): string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return JSON.stringify(value);
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
