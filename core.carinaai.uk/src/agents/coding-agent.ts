import { SubAgent } from './sub-agent.js';
import type { ConfirmFn } from './tool-runner.js';
import type { ProviderOverride } from '../brain/llm.js';

export class CodingAgent extends SubAgent {
  name = 'coding';
  systemPromptSuffix =
    'You are a coding specialist. Write correct, tested code. Read existing files before modifying them. Explain what you built.';
  allowedTools = ['file-read', 'file-write', 'code-exec', 'shell-exec'];

  constructor(sessionId: string, confirmTool?: ConfirmFn, providerOverride?: ProviderOverride) {
    super(sessionId, false, confirmTool, providerOverride);
  }
}
