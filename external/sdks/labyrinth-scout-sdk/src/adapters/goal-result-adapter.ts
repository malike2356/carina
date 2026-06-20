import { GenericAdapter } from './generic-adapter.js';

// Assumption: Goal/result pattern agents use goal/result fields and optional action tool calls.
export class GoalResultAdapter extends GenericAdapter {
  override readonly agentType = 'goal-result';

  constructor() {
    super({ prompt: 'goal', response: 'result', sessionId: 'run_id', toolCalls: 'actions' });
  }
}

export const goalResultAdapter = new GoalResultAdapter();
