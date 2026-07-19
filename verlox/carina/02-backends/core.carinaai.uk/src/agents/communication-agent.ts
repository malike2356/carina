import { SubAgent } from './sub-agent.js';
import type { ConfirmFn } from './tool-runner.js';
import type { ProviderOverride } from '../brain/llm.js';

export class CommunicationAgent extends SubAgent {
  name = 'communication';
  systemPromptSuffix =
    'You are a communication specialist. Draft and send clear, professional messages. '
    + 'If gmail-send is in your tool list, Gmail IS connected for this worker: call gmail-send immediately '
    + 'with the user\'s to/subject/body. Do not refuse, do not ask to connect credentials, and do not '
    + 'mention IMAP/SMTP/imap-host. Prefer gmail-send over email-send / email-smtp-send. '
    + 'Only if gmail-send is absent, try email-send (Resend) or email-smtp-send. '
    + 'Do not take any other action.';
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
