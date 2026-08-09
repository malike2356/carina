import type { WorkerRoleTemplate } from './role-templates.js';
import {
  SOCIAL_CAPABILITY_PERSONA_BLOCK,
  templateHasSocialPresenceCapability,
} from './worker-capability-context.js';

export const SUB_AGENT_AUTONOMY_BLOCK = [
  'You may plan and execute multiple steps internally before sending your final reply.',
  'When a task requires research, then drafting, then scheduling - or any sequence of steps - complete all steps before responding to the client.',
  'The client receives one result, not a running commentary on your process.',
  'Do not narrate your internal steps unless the client specifically asks for a breakdown.',
].join('\n');

/** Mandatory empty-tool honesty for Aiva workers (contacts, Drive, RAG, APIs). */
export const ZERO_HALLUCINATION_PROTOCOL_BLOCK = [
  '## MANDATORY TOOL DISCIPLINE & ZERO-HALLUCINATION PROTOCOL',
  '1. Empty Tool Response Rule: If any tool (Contacts, Google Drive, database search, RAG, or API) returns 0 results, empty arrays, status empty, or failure, you MUST state explicitly: "I searched and found no matching records."',
  '2. Never Fabricate: Under no circumstances invent contact details, names, phone numbers, transaction amounts, file contents, or prior conversation context when tool output is empty.',
  '3. Graceful Failure: If a tool errors or returns ambiguous data, stop and ask the user for clarification rather than guessing or continuing with simulated data.',
].join('\n');

/** Marker used so the agent runtime can skip Carina profile personality for Aiva sessions. */
export const AIVA_WORKER_IDENTITY_MARKER = 'AIVA_WORKER_IDENTITY';

/**
 * Prefer the short display name when hire UI stored "Name - Role title" as the worker name.
 */
export function publicWorkerName(rawName: string): string {
  const trimmed = rawName.trim();
  if (!trimmed) return 'your AI worker';
  const beforeRole = trimmed.split(/\s+[--;]\s+/)[0]?.trim();
  return beforeRole || trimmed;
}

/**
 * Highest-priority identity for Aiva employee sessions.
 * Overrides the base Carina OS system prompt ("You are Carina...") for this turn.
 */
export function buildWorkerIdentityOverride(
  workerName: string,
  roleDescription?: string,
): string {
  const displayName = publicWorkerName(workerName);
  const role = roleDescription?.trim();
  const lines = [
    `${AIVA_WORKER_IDENTITY_MARKER}:`,
    `You are ${displayName}, an AI employee in this workspace.`,
    'You are NOT Carina. Never introduce yourself as Carina, claim to be Carina, or "correct" people who address you by your worker name.',
    'Carina is only the underlying agent platform that runs you. Your public identity to the employer and contacts is your worker name only.',
    `If someone greets you as ${displayName}, or by a shorter form of that name, respond as ${displayName}.`,
  ];
  if (role) {
    lines.push(`Your role: ${role}`);
  }
  return lines.join('\n');
}

export function withWorkerIdentityOverride(
  workerName: string,
  personaPrompt: string,
  roleDescription?: string,
): string {
  const override = buildWorkerIdentityOverride(workerName, roleDescription);
  const body = personaPrompt.trim();
  if (!body) return override;
  if (body.includes(AIVA_WORKER_IDENTITY_MARKER)) return body;
  return `${override}\n\n${body}`;
}

export function buildPersonaPrompt(
  workerName: string,
  template: WorkerRoleTemplate,
  customDescription?: string,
): string {
  const displayName = publicWorkerName(workerName);
  const blocks: string[] = [
    buildWorkerIdentityOverride(displayName, customDescription),
    `Your name is ${displayName}.`,
    template.personaBlocks.role,
    'Your capabilities:',
    template.personaBlocks.capabilities.map((c) => `- ${c}`).join('\n'),
    'Boundaries you must never cross:',
    template.personaBlocks.boundaries.map((b) => `- ${b}`).join('\n'),
    `Tone: ${template.personaBlocks.tone}`,
    SUB_AGENT_AUTONOMY_BLOCK,
  ];
  if (templateHasSocialPresenceCapability(template)) {
    blocks.push(SOCIAL_CAPABILITY_PERSONA_BLOCK);
  }
  blocks.push(
    ZERO_HALLUCINATION_PROTOCOL_BLOCK,
    template.personaBlocks.escalationGuidance,
    'When you need to escalate, include exactly this marker at the end of your response: [ESCALATE]',
    'When you escalate, the client will be told you are checking on it. Do not tell them anything different.',
  );
  if (customDescription) {
    blocks.push(`Additional context from your employer: ${customDescription}`);
  }
  return blocks.join('\n\n');
}

export function buildCustomPersonaPrompt(workerName: string, roleDescription: string): string {
  const displayName = publicWorkerName(workerName);
  return [
    buildWorkerIdentityOverride(displayName, roleDescription),
    `Your name is ${displayName}.`,
    `Your role: ${roleDescription}`,
    SUB_AGENT_AUTONOMY_BLOCK,
    ZERO_HALLUCINATION_PROTOCOL_BLOCK,
    'When you are uncertain how to handle a task, or when it involves legal, financial, or emotional complexity, include [ESCALATE] at the end of your response.',
    'When you escalate, say to the client: "I am checking on this and will get back to you shortly." Do not say anything else about the escalation.',
  ].join('\n\n');
}
