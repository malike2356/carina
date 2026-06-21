import { GenericAdapter } from './generic-adapter.js';

// Assumption: Hermes agents expose a task/session JSON API using input/output fields.
export class HermesAdapter extends GenericAdapter {
  override readonly agentType = 'hermes';

  constructor() {
    super({ prompt: 'input', response: 'output', sessionId: 'session_id', toolCalls: 'tool_calls' });
  }
}

export const hermesAdapter = new HermesAdapter();
