import { GenericAdapter } from './generic-adapter.js';

// Assumption: Compatible agents expose a task/session JSON API using input/output fields.
export class ExternalAgentAdapter extends GenericAdapter {
  override readonly agentType = 'compat-agent';

  constructor() {
    super({ prompt: 'input', response: 'output', sessionId: 'session_id', toolCalls: 'tool_calls' });
  }
}

export const externalAgentAdapter = new ExternalAgentAdapter();
