import { SubAgent } from './sub-agent.js';
import type { ConfirmFn } from './tool-runner.js';
import type { ProviderOverride } from '../brain/llm.js';

export class FileAgent extends SubAgent {
  name = 'file';
  systemPromptSuffix =
    'You are a file management specialist. Organise, summarise, and transform documents.';
  allowedTools = ['file-read', 'file-write'];

  constructor(sessionId: string, confirmTool?: ConfirmFn, providerOverride?: ProviderOverride) {
    super(sessionId, false, confirmTool, providerOverride);
  }
}
