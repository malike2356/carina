import { SubAgent } from './sub-agent.js';
import type { ConfirmFn } from './tool-runner.js';
import type { ProviderOverride } from '../brain/llm.js';

export class CommunicationAgent extends SubAgent {
  name = 'communication';
  systemPromptSuffix =
    'You are a communication specialist. Draft and send clear, professional messages. '
    + 'Prefer gmail-send when Gmail is connected for this worker. '
    + 'Otherwise use email-send (Resend) or email-smtp-send. '
    + 'Do not claim IMAP is required for outbound send. Do not take any other action.';
  allowedTools = [
    'weather-forecast',
    'gmail-send',
    'gmail-list',
    'gmail-get',
    'email-send',
    'email-smtp-send',
    'http-request',
  ];
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
