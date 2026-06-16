import { buildMandatoryToolsBlock } from '../tools/mandatory-tools.js';
import type { SubagentRole } from './delegation-context.js';

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
  const roleLine = input.role === 'orchestrator'
    ? 'Role: orchestrator. You may delegate sub-tasks with delegate-task when depth allows.'
    : 'Role: leaf. You cannot delegate further.';
  return [
    'Delegated subagent task:',
    roleLine,
    `Delegation depth: ${input.delegationDepth}.${workdirLine}`,
    'Intermediate tool output stays in your context; the parent only sees your final summary.',
    `Task: ${input.goal}`,
  ].join('\n');
}
