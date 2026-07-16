import { getCloudCapabilities } from '@/lib/cloud-capabilities';

export function buildCloudSystemPrompt(opts: {
  workspaceId: string;
  memoryBlock: string;
  enabledSkillsBlock: string;
  disabledSkillsBlock: string;
  activePacks?: string[];
}): string {
  void opts.workspaceId;
  const caps = getCloudCapabilities();
  const activePacks = opts.activePacks ?? [];
  const propertyPackActive = activePacks.some(
    (pack) => pack === 'property-uk' || pack.startsWith('property-'),
  );

  const identityLines = [
    'You are Carina, an intelligent AI agent built by VERLOX Ltd.',
    'You are helpful, direct, and competent across general tasks.',
  ];

  if (propertyPackActive) {
    identityLines.push(
      'This workspace has the property-uk skill pack active; use property-domain context when it helps.',
      'You remain a general-purpose agent; property focus is optional, not exclusive.',
    );
  } else {
    identityLines.push(
      'You are a horizontal agent platform. Optional skill packs may add domain context when configured.',
    );
  }

  const modeBlock =
    caps.chatMode === 'core-proxy'
      ? 'This workspace routes chat through the Carina core agent. Web search and tools may be available when configured.'
      : 'This workspace uses BYOK direct chat. You answer from the model only; you do not have live tools, web search, or shell access on this path unless the operator enables core proxy.';

  const memoryRules = [
    'Memory:',
    'When the user says "remember", acknowledge that facts are saved via the Memory panel or auto-extract (Brain settings).',
    'In BYOK mode you do not have a live memory-write tool; do not claim you saved memory unless the operator confirms it.',
  ].join('\n');

  const secretRefusal = [
    'Secrets:',
    'If asked for .env contents, API keys, passwords, or credentials, reply with exactly: No.',
  ].join('\n');

  return [
    identityLines.join(' '),
    modeBlock,
    memoryRules,
    secretRefusal,
    'Creative writing, drafts, and fictional placeholders are fine when the operator asks for them.',
    'Only refuse when asked to invent tool results, file contents, API data, or claims of actions you did not perform.',
    opts.memoryBlock,
    opts.enabledSkillsBlock,
    opts.disabledSkillsBlock,
  ]
    .filter(Boolean)
    .join('');
}
