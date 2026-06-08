import { asString, isRecord, type IAgentAdapter, type NormalizedRequest, type NormalizedResponse, type ToolCall } from '../agent-adapter.interface.js';

export class CarinaAdapter implements IAgentAdapter {
  readonly agentType = 'carina';

  parseRequest(raw: unknown): NormalizedRequest {
    const body = isRecord(raw) ? raw : {};
    const prompt = asString(body.message ?? body.content ?? body.prompt);
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : typeof body.session_id === 'string' ? body.session_id : undefined;
    return {
      agentType: this.agentType,
      ...(sessionId ? { sessionId } : {}),
      prompt,
      messages: prompt ? [{ role: 'user', content: prompt }] : [],
      toolCalls: this.extractToolCalls(raw),
      raw,
      stream: false,
    };
  }

  parseResponse(raw: unknown): NormalizedResponse {
    const body = isRecord(raw) ? raw : {};
    return {
      agentType: this.agentType,
      content: asString(body.reply ?? body.response ?? body.content ?? raw),
      toolCalls: this.extractToolCalls(raw),
      raw,
      stream: false,
    };
  }

  formatResponse(response: NormalizedResponse): unknown {
    return response.raw;
  }

  extractToolCalls(raw: unknown): ToolCall[] {
    const body = isRecord(raw) ? raw : {};
    const events = Array.isArray(body.events) ? body.events : [];
    return events
      .filter(isRecord)
      .filter((event) => event.type === 'tool')
      .map((event) => ({ name: asString(event.name ?? event.tool ?? 'carina-tool'), arguments: isRecord(event.params) ? event.params : {} }));
  }
}

export const carinaAdapter = new CarinaAdapter();
