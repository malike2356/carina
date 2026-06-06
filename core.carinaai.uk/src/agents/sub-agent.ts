import { CarinaAgent, type TurnResult } from './carina.js';
import type { ConfirmFn } from './tool-runner.js';

export abstract class SubAgent {
  abstract name: string;
  abstract systemPromptSuffix: string;
  abstract allowedTools: string[];
  requiresConfirmation = false;

  protected sessionId: string;
  protected memoryReady: boolean;
  protected confirmTool?: ConfirmFn;
  protected maxTurns = 10;

  constructor(
    sessionId: string,
    memoryReady: boolean,
    confirmTool?: ConfirmFn,
  ) {
    this.sessionId = sessionId;
    this.memoryReady = false;
    this.confirmTool = confirmTool;
  }

  protected createAgent(): CarinaAgent {
    return new CarinaAgent(this.sessionId, this.memoryReady, this.confirmTool, {
      allowedTools: this.allowedTools,
      systemPromptSuffix: this.systemPromptSuffix,
      maxTurns: this.maxTurns,
      persistMemory: false,
      forceConfirm: this.requiresConfirmation,
    });
  }

  async run(task: string, context?: string): Promise<string> {
    const agent = this.createAgent();
    const result: TurnResult = await agent.runTurn(task, context);
    return result.text;
  }
}
