import { GenericAdapter } from './generic-adapter.js';

// Assumption: OpenClaw requests use goal/result fields and optional action tool calls.
export class OpenClawAdapter extends GenericAdapter {
  override readonly agentType = 'openclaw';

  constructor() {
    super({ prompt: 'goal', response: 'result', sessionId: 'run_id', toolCalls: 'actions' });
  }
}

export const openClawAdapter = new OpenClawAdapter();
