import { SubAgent } from './sub-agent.js';
import type { ConfirmFn } from './tool-runner.js';
import type { ProviderOverride } from '../brain/llm.js';

export class CommunicationAgent extends SubAgent {
  name = 'communication';
  systemPromptSuffix =
    'You are a communication specialist. Draft and send clear, professional messages. Do not take any other action.';
  allowedTools = ['email-send', 'http-request'];
  requiresConfirmation = true;

  constructor(
    sessionId: string,
    confirmTool?: ConfirmFn,
    providerOverride?: ProviderOverride,
    abortSignal?: AbortSignal,
  ) {
    super(sessionId, false, confirmTool, providerOverride, abortSignal);
  }
}
