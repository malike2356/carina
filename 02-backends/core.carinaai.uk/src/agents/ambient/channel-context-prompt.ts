import { config } from '../../config/index.js';
import { queryChannelFacts } from './channel-memory-store.js';
import type { ChannelContextFactRecord } from './types.js';

export async function buildChannelContextSection(
  channelId: string,
  channelName: string,
  userMessage?: string,
): Promise<string> {
  const channelFacts = await queryChannelFacts({
    scope: `channel:${channelId}`,
    orderBy: 'extracted_at',
    order: 'DESC',
    limit: 15,
  });

  const crossFacts = config.ambient.crossChannel && userMessage
    ? await queryChannelFacts({
        scopeNot: `channel:${channelId}`,
        search: userMessage.slice(0, 120),
        limit: 5,
      })
    : [];

  if (channelFacts.length === 0 && crossFacts.length === 0) return '';

  const lines = ['', `## Channel Context (${channelName || channelId})`, ''];
  appendFactGroup(lines, 'Upcoming Deadlines', channelFacts, 'deadline', (f) =>
    `- ${f.summary}`);
  appendFactGroup(lines, 'Recent Decisions', channelFacts, 'decision', (f) =>
    `- ${f.summary}`);
  appendFactGroup(lines, 'Active Blockers', channelFacts, 'blocker', (f) =>
    `- ${f.summary}`);
  appendFactGroup(lines, 'Recent Status Updates', channelFacts, 'status_update', (f) =>
    `- ${f.summary}`, 5);

  const other = channelFacts.filter((f) =>
    !['deadline', 'decision', 'blocker', 'status_update'].includes(f.factType));
  if (other.length > 0) {
    lines.push('### Other Context');
    for (const o of other.slice(0, 5)) lines.push(`- ${o.summary}`);
    lines.push('');
  }

  if (crossFacts.length > 0) {
    lines.push('### Relevant Updates from Other Channels');
    lines.push('(Cross-channel context; verify before acting)');
    for (const f of crossFacts) {
      lines.push(`- [${f.scopeName || f.scope}] ${f.summary}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function appendFactGroup(
  lines: string[],
  title: string,
  facts: ChannelContextFactRecord[],
  factType: string,
  format: (f: ChannelContextFactRecord) => string,
  limit = facts.length,
): void {
  const group = facts.filter((f) => f.factType === factType).slice(0, limit);
  if (group.length === 0) return;
  lines.push(`### ${title}`);
  for (const item of group) lines.push(format(item));
  lines.push('');
}
