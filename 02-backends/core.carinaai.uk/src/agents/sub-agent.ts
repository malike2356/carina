import { CarinaAgent, type TurnResult } from './carina.js';
import type { ConfirmFn } from './tool-runner.js';
import type { ProviderOverride } from '../brain/llm.js';
import { subagentMaxTurns } from './subagent-policy.js';

export abstract class SubAgent {
  abstract name: string;
  abstract systemPromptSuffix: string;
  abstract allowedTools: string[];
  requiresConfirmation = false;

  protected sessionId: string;
  protected memoryReady: boolean;
  protected confirmTool?: ConfirmFn;
  protected maxTurns = subagentMaxTurns();
  protected providerOverride?: ProviderOverride;
  protected abortSignal?: AbortSignal;

  constructor(
    sessionId: string,
    memoryReady: boolean,
    confirmTool?: ConfirmFn,
    providerOverride?: ProviderOverride,
    abortSignal?: AbortSignal,
  ) {
    this.sessionId = sessionId;
    this.memoryReady = false;
    this.confirmTool = confirmTool;
    this.providerOverride = providerOverride;
    this.abortSignal = abortSignal;
  }

  protected createAgent(): CarinaAgent {
    return new CarinaAgent(this.sessionId, this.memoryReady, this.confirmTool, {
      allowedTools: this.allowedTools,
      systemPromptSuffix: this.systemPromptSuffix,
      maxTurns: this.maxTurns,
      persistMemory: false,
      forceConfirm: this.requiresConfirmation,
      providerOverride: this.providerOverride,
      abortSignal: this.abortSignal,
    });
  }

  async run(task: string, context?: string): Promise<string> {
    if (this.abortSignal?.aborted) {
      return 'Subagent cancelled before start.';
    }
    const agent = this.createAgent();
    const result: TurnResult = await agent.runTurn(task, context);
    if (this.abortSignal?.aborted) {
      return 'Subagent cancelled during execution.';
    }
    return result.text;
  }
}
