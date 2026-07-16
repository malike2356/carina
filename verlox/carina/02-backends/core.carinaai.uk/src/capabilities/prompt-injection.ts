import type { CapabilityManifest } from './capability-manifest.js';

const MAX_PROMPT_CHARS = 2200;

function formatCategorySummary(categories: Record<string, number>): string {
  const parts = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, count]) => `${cat} (${count})`);
  return parts.length > 0 ? parts.join(', ') : 'general';
}

function formatChannelList(entries: CapabilityManifest['channels']['connected']): string {
  if (entries.length === 0) return '- No channels connected yet';
  return entries.map((c) => `- ${c.name}: active`).join('\n');
}

function formatSkillList(skills: CapabilityManifest['skills']['active']): string {
  if (skills.length === 0) return '- No skill packs active';
  return skills
    .slice(0, 6)
    .map((s) => `- ${s.name}: ${s.description.slice(0, 60)}`)
    .join('\n');
}

function formatExtensionList(extensions: CapabilityManifest['extensions']['active']): string {
  if (extensions.length === 0) return '- No extensions active';
  return extensions
    .slice(0, 4)
    .map((e) => `- ${e.name}: ${e.description}`)
    .join('\n');
}

export function buildCapabilityPromptBlock(manifest: CapabilityManifest): string {
  const { summary, tools, channels, skills, knowledge, credentials, platform, scout, extensions } = manifest;

  const missingCredTools = tools.active.filter((t) => t.credentialStatus === 'missing');
  const missingCredNote = missingCredTools.length > 0
    ? `Tools waiting on credentials: ${missingCredTools.slice(0, 4).map((t) => t.name).join(', ')}.`
    : '';

  const availableChannelNames = channels.available.slice(0, 4).map((c) => c.name).join(', ');
  const setupHint = channels.available[0]
    ? `Want more channels? ${channels.available[0].name} takes about ${channels.available[0].setupTime} to set up.`
    : '';

  const block = [
    '## YOUR CAPABILITIES (authoritative for "what can you do?" questions)',
    '',
    `You have ${summary.totalToolsActive} tools active this session (of ${summary.totalToolsAvailable} in the full catalog).`,
    `Active categories: ${formatCategorySummary(tools.categories)}.`,
    '',
    '### Connected channels',
    formatChannelList(channels.connected),
    availableChannelNames ? `\nAvailable to connect: ${availableChannelNames}.` : '',
    '',
    '### Active skill packs',
    formatSkillList(skills.active),
    '',
    '### Knowledge base',
    knowledge.documentCount > 0
      ? `You have ${knowledge.documentCount} indexed document sources covering: ${knowledge.domains.join(', ') || 'general'}.`
      : 'No uploaded documents indexed yet. Ask the operator to upload FAQs, policies, or guides.',
    '',
    '### Extensions',
    formatExtensionList(extensions.active),
    '',
    '### Credential status',
    credentials.configured.length > 0 ? `Ready: ${credentials.configured.slice(0, 8).join(', ')}.` : '',
    credentials.missing.length > 0
      ? `Missing: ${credentials.missing.slice(0, 6).join(', ')}; affected integrations may not work until connected.`
      : '',
    missingCredNote,
    '',
    '### Platform',
    `${platform.tierLabel} plan. ${platform.slotLimit === null ? 'Unlimited' : `Up to ${platform.slotLimit}`} AI workers. ${platform.slotsUsed} in use.`,
    '',
    '### Scout protection',
    scout.connected
      ? `Active (${scout.profile} profile). Policies: ${scout.activePolicies.join(', ') || 'governance'}.`
      : 'Scout not connected; advanced governance may be unavailable.',
    '',
    '### Answering capability questions',
    'When asked "what can you do?":',
    '1. Summarise active tools by category in plain language (no raw tool names unless asked).',
    `2. Report ${summary.totalToolsActive} active tools, not the full ${summary.totalToolsAvailable} catalog.`,
    channels.connected.length > 0
      ? `3. Mention connected channels: ${channels.connected.map((c) => c.name).join(', ')}.`
      : '3. Mention that channels can be connected from workspace settings.',
    credentials.missing.length > 0
      ? '4. Say which integrations need credentials before they will work.'
      : '4. Offer one concrete next capability if something is not set up yet.',
    setupHint ? `5. ${setupHint}` : '',
  ]
    .filter((line) => line !== '')
    .join('\n');

  if (block.length <= MAX_PROMPT_CHARS) return block.trim();
  return `${block.slice(0, MAX_PROMPT_CHARS - 3).trim()}...`;
}

export function buildCapabilitySummary(manifest: CapabilityManifest): CapabilityManifest['summary'] {
  return manifest.summary;
}

export function buildCapabilityMissing(manifest: CapabilityManifest): {
  missingCredentials: string[];
  disconnectedChannels: CapabilityManifest['channels']['available'];
  inactiveTools: Array<{ tool: string; reason: string }>;
} {
  return {
    missingCredentials: manifest.credentials.missing,
    disconnectedChannels: manifest.channels.available,
    inactiveTools: Object.entries(manifest.tools.inactiveReason).map(([tool, reason]) => ({
      tool,
      reason,
    })),
  };
}
