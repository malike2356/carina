import { SubAgent } from './sub-agent.js';
import type { ConfirmFn } from './tool-runner.js';
import type { ProviderOverride } from '../brain/llm.js';
import { buildSubagentTaskSuffix } from './subagent-prompt.js';
import { filterLeafTools } from '../tools/toolset.js';
import { subagentMaxTurns } from './subagent-policy.js';
import type { SubagentRole as DelegationRole } from './delegation-context.js';

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
    role: DelegationRole = 'leaf',
  ) {
    super(sessionId, false, confirmTool, providerOverride, abortSignal);
    this.allowedTools = filterLeafTools(allowedTools);
    this.systemPromptSuffix = buildSubagentTaskSuffix({
      goal,
      role,
      delegationDepth,
      workdir,
    });
    this.maxTurns = subagentMaxTurns();
  }
}
