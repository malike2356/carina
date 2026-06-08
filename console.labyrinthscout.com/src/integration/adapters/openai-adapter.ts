import {
  asString,
  isRecord,
  parseJsonObject,
  type AgentMessage,
  type AdapterContext,
  type IAgentAdapter,
  type NormalizedRequest,
  type NormalizedResponse,
  type ToolCall,
} from '../agent-adapter.interface.js';

function parseMessages(raw: unknown): AgentMessage[] {
  if (!isRecord(raw) || !Array.isArray(raw.messages)) return [];
  return raw.messages
    .filter(isRecord)
    .map((message) => ({
      role: asString(message.role),
      content: typeof message.content === 'string' ? message.content : asString(message.content),
    }))
    .filter((message) => message.role.length > 0 && message.content.length > 0);
}

function parseToolCall(raw: unknown): ToolCall | null {
  if (!isRecord(raw)) return null;
  const fn = isRecord(raw.function) ? raw.function : {};
  const name = asString(fn.name || raw.name);
  if (!name) return null;
  return {
    ...(typeof raw.id === 'string' ? { id: raw.id } : {}),
    name,
    arguments: parseJsonObject(fn.arguments ?? raw.arguments),
  };
}

export class OpenAiAdapter implements IAgentAdapter {
  readonly agentType = 'openai';

  parseRequest(raw: unknown): NormalizedRequest {
    const messages = parseMessages(raw);
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    return {
      agentType: this.agentType,
      prompt: lastUser?.content ?? messages.map((message) => message.content).join('\n'),
      messages,
      toolCalls: this.extractToolCalls(raw),
      raw,
      stream: isRecord(raw) ? Boolean(raw.stream) : false,
    };
  }

  parseResponse(raw: unknown): NormalizedResponse {
    const choices = isRecord(raw) && Array.isArray(raw.choices) ? raw.choices : [];
    const first = choices.find(isRecord);
    const message = isRecord(first?.message) ? first.message : {};
    return {
      agentType: this.agentType,
      content: typeof message.content === 'string' ? message.content : asString(raw),
      toolCalls: this.extractToolCalls(raw),
      raw,
      stream: false,
    };
  }

  formatResponse(response: NormalizedResponse): unknown {
    return response.raw;
  }

  extractToolCalls(raw: unknown): ToolCall[] {
    const calls: ToolCall[] = [];
    const maybeCalls = [
      ...(isRecord(raw) && Array.isArray(raw.tools) ? raw.tools : []),
      ...(isRecord(raw) && Array.isArray(raw.tool_calls) ? raw.tool_calls : []),
    ];
    if (isRecord(raw) && Array.isArray(raw.choices)) {
      for (const choice of raw.choices) {
        if (!isRecord(choice) || !isRecord(choice.message) || !Array.isArray(choice.message.tool_calls)) continue;
        maybeCalls.push(...choice.message.tool_calls);
      }
    }
    for (const call of maybeCalls) {
      const parsed = parseToolCall(call);
      if (parsed) calls.push(parsed);
    }
    return calls;
  }

  resolveUpstreamPath(path: string): string {
    return path || '/v1/chat/completions';
  }
}

export const openAiAdapter = new OpenAiAdapter();
