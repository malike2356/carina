import { buildMandatoryToolsBlock } from '../tools/mandatory-tools.js';
import type { SubagentRole } from './delegation-context.js';
import { buildLeafRolePrompt, buildOrchestratorRolePrompt } from './role-enforcer.js';

export function buildSubagentSystemPromptParts(): string[] {
  return [
    [
      'Subagent mode (minimal context):',
      'You are a focused worker, not the main Carina session.',
      'Execute the delegated task with tools. Return one concise final summary.',
      'Do not greet, narrate plans, or ask the operator questions.',
      'Do not use memory, clarify, messaging, cron, kanban, or delegation tools unless you are an orchestrator with depth budget.',
      buildMandatoryToolsBlock(),
    ].join('\n'),
  ];
}

export function buildSubagentTaskSuffix(input: {
  goal: string;
  role: SubagentRole;
  delegationDepth: number;
  workdir?: string;
}): string {
  const workdirLine = input.workdir ? `\nWork in directory: ${input.workdir}` : '';
  const roleBlock = input.role === 'orchestrator'
    ? buildOrchestratorRolePrompt(input.delegationDepth)
    : buildLeafRolePrompt();
  return [
    'Delegated subagent task:',
    roleBlock,
    `Delegation depth: ${input.delegationDepth}.${workdirLine}`,
    'Intermediate tool output stays in your context; the parent only sees your final summary.',
    `Task: ${input.goal}`,
  ].join('\n');
}
