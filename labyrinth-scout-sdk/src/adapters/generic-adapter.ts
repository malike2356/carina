import { asString, isRecord, type IAgentAdapter, type NormalizedRequest, type NormalizedResponse, type ToolCall } from '../agent-adapter.interface.js';

export interface GenericFieldMap {
  prompt?: string;
  response?: string;
  sessionId?: string;
  toolCalls?: string;
}

function readPath(source: unknown, path?: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((current, part) => {
    if (!isRecord(current)) return undefined;
    return current[part];
  }, source);
}

export class GenericAdapter implements IAgentAdapter {
  readonly agentType: string = 'generic';

  constructor(private readonly fields: GenericFieldMap = {
    prompt: 'prompt',
    response: 'response',
    sessionId: 'session_id',
    toolCalls: 'tool_calls',
  }) {}

  parseRequest(raw: unknown): NormalizedRequest {
    const prompt = asString(readPath(raw, this.fields.prompt) ?? (isRecord(raw) ? raw.message ?? raw.input : raw));
    const sessionId = readPath(raw, this.fields.sessionId);
    return {
      agentType: this.agentType,
      ...(typeof sessionId === 'string' ? { sessionId } : {}),
      prompt,
      messages: prompt ? [{ role: 'user', content: prompt }] : [],
      toolCalls: this.extractToolCalls(raw),
      raw,
    };
  }

  parseResponse(raw: unknown): NormalizedResponse {
    return {
      agentType: this.agentType,
      content: asString(readPath(raw, this.fields.response) ?? raw),
      toolCalls: this.extractToolCalls(raw),
      raw,
    };
  }

  formatResponse(response: NormalizedResponse): unknown {
    return response.raw;
  }

  extractToolCalls(raw: unknown): ToolCall[] {
    const value = readPath(raw, this.fields.toolCalls) ?? (isRecord(raw) ? raw.tools : undefined);
    if (!Array.isArray(value)) return [];
    return value.filter(isRecord).map((call) => ({
      name: asString(call.name ?? call.tool ?? 'tool'),
      arguments: isRecord(call.arguments) ? call.arguments : isRecord(call.args) ? call.args : {},
    }));
  }
}

export const genericAdapter = new GenericAdapter();
