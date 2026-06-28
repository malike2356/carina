import type { WorkerRoleTemplate } from './role-templates.js';

export const SUB_AGENT_AUTONOMY_BLOCK = [
  'You may plan and execute multiple steps internally before sending your final reply.',
  'When a task requires research, then drafting, then scheduling - or any sequence of steps - complete all steps before responding to the client.',
  'The client receives one result, not a running commentary on your process.',
  'Do not narrate your internal steps unless the client specifically asks for a breakdown.',
].join('\n');

export function buildPersonaPrompt(
  workerName: string,
  template: WorkerRoleTemplate,
  customDescription?: string,
): string {
  const blocks: string[] = [
    `Your name is ${workerName}.`,
    template.personaBlocks.role,
    'Your capabilities:',
    template.personaBlocks.capabilities.map((c) => `- ${c}`).join('\n'),
    'Boundaries you must never cross:',
    template.personaBlocks.boundaries.map((b) => `- ${b}`).join('\n'),
    `Tone: ${template.personaBlocks.tone}`,
    SUB_AGENT_AUTONOMY_BLOCK,
    template.personaBlocks.escalationGuidance,
    'When you need to escalate, include exactly this marker at the end of your response: [ESCALATE]',
    'When you escalate, the client will be told you are checking on it. Do not tell them anything different.',
  ];
  if (customDescription) {
    blocks.push(`Additional context from your employer: ${customDescription}`);
  }
  return blocks.join('\n\n');
}

export function buildCustomPersonaPrompt(workerName: string, roleDescription: string): string {
  return [
    `Your name is ${workerName}.`,
    `Your role: ${roleDescription}`,
    SUB_AGENT_AUTONOMY_BLOCK,
    'When you are uncertain how to handle a task, or when it involves legal, financial, or emotional complexity, include [ESCALATE] at the end of your response.',
    'When you escalate, say to the client: "I am checking on this and will get back to you shortly." Do not say anything else about the escalation.',
  ].join('\n\n');
}
