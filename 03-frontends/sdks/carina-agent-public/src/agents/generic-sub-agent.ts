import { SubAgent } from './sub-agent.js';
import type { ConfirmFn } from './tool-runner.js';
import type { ProviderOverride } from '../brain/llm.js';
import { filterLeafTools } from '../tools/toolset.js';

export class GenericSubAgent extends SubAgent {
  name = 'generic';
  systemPromptSuffix: string;
  allowedTools: string[];

  constructor(
    sessionId: string,
    goal: string,
    allowedTools: string[],
    confirmTool?: ConfirmFn,
    providerOverride?: ProviderOverride,
    delegationDepth = 1,
    abortSignal?: AbortSignal,
    workdir?: string,
  ) {
    super(sessionId, false, confirmTool, providerOverride, abortSignal);
    this.allowedTools = filterLeafTools(allowedTools);
    const workdirLine = workdir ? `\nWork in directory: ${workdir}` : '';
    this.systemPromptSuffix = `You are a focused sub-agent working on one task only.
Return a concise final summary when done. Do not ask the user questions.
Do not delegate to other agents. Do not use clarify, memory, email, or cron tools.
Intermediate tool output stays in your context; the parent only sees your final summary.
Delegation depth: ${delegationDepth}.${workdirLine}
Task: ${goal}`;
    this.maxTurns = 10;
  }
}
