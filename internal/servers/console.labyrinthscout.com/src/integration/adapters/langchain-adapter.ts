import { asString, isRecord, type NormalizedRequest, type NormalizedResponse } from '../agent-adapter.interface.js';
import { GenericAdapter } from './generic-adapter.js';

export class LangChainAdapter extends GenericAdapter {
  override readonly agentType = 'langchain';

  constructor() {
    super({ prompt: 'input', response: 'output', sessionId: 'config.configurable.session_id', toolCalls: 'intermediate_steps' });
  }

  override parseRequest(raw: unknown): NormalizedRequest {
    const request = super.parseRequest(raw);
    const input = isRecord(raw) ? raw.input ?? raw.question ?? raw.messages : undefined;
    return { ...request, prompt: asString(input ?? request.prompt) };
  }

  override parseResponse(raw: unknown): NormalizedResponse {
    const response = super.parseResponse(raw);
    return { ...response, content: isRecord(raw) ? asString(raw.output ?? raw.result ?? response.content) : response.content };
  }
}

export const langChainAdapter = new LangChainAdapter();
