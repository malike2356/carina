import { SubAgent } from './sub-agent.js';
import type { ConfirmFn } from './tool-runner.js';
import type { ProviderOverride } from '../brain/llm.js';

export class ResearchAgent extends SubAgent {
  name = 'research';
  systemPromptSuffix =
    'You are a research specialist. Gather, verify, and summarise information from multiple sources. Cite your sources. Do not write code.';
  allowedTools = ['web-search', 'http-request', 'file-read'];

  constructor(
    sessionId: string,
    confirmTool?: ConfirmFn,
    providerOverride?: ProviderOverride,
    abortSignal?: AbortSignal,
  ) {
    super(sessionId, false, confirmTool, providerOverride, abortSignal);
  }
}
