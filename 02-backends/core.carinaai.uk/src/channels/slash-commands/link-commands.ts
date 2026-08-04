import type { SlashCommand } from './registry.js';
import type { InboundMessage } from '../types.js';
import {
  aivaContactIdentityEnabled,
  claimAivaLinkCode,
  generateAivaLinkCode,
  linkAivaChannelContact,
  listAivaContactIdentities,
  listChannelSyncConversations,
  resolveAivaCanonicalContact,
} from '../../memory/aiva/contact-identity.js';
import { hydrateCanonicalSessionFromLinkedChannels } from '../../memory/aiva/session-hydrate.js';

function argsAfterCommand(content: string): string {
  const parts = content.trim().split(/\s+/);
  return parts.slice(1).join(' ').trim();
}

export const linkCommand: SlashCommand = {
  name: 'link',
  description: 'Link this channel to the same person on another channel (explicit)',
  async handler(msg: InboundMessage) {
    if (!aivaContactIdentityEnabled()) {
      return 'Channel sync is disabled (AIVA_CONTACT_IDENTITY_ENABLED=false).';
    }

    const rest = argsAfterCommand(msg.content);
    const parts = rest.split(/\s+/).filter(Boolean);
    const sub = (parts[0] ?? '').toLowerCase();

    const resolved = await resolveAivaCanonicalContact({
      workspaceId: msg.workspaceId,
      workerId: msg.workerId,
      channel: msg.channel,
      channelContactId: msg.contactId,
      displayName: msg.contactName,
    });

    if (sub === 'code') {
      const code = generateAivaLinkCode({
        workspaceId: msg.workspaceId,
        workerId: msg.workerId,
        canonicalContactId: resolved.canonicalContactId,
        channel: msg.channel,
        channelContactId: msg.contactId,
        displayName: msg.contactName,
      });
      return [
        `Link code: ${code}`,
        'Valid for 5 minutes.',
        `On your other channel, send: /link claim ${code}`,
        'After claiming, both channels share one conversation and durable memory.',
      ].join('\n');
    }

    if (sub === 'claim') {
      const code = parts[1];
      if (!code) return 'Usage: /link claim <code>';
      const claimed = claimAivaLinkCode(code, {
        workspaceId: msg.workspaceId,
        workerId: msg.workerId,
        channel: msg.channel,
        channelContactId: msg.contactId,
      });
      if ('error' in claimed) return claimed.error;

      const identities = await linkAivaChannelContact({
        workspaceId: claimed.workspaceId,
        workerId: claimed.workerId,
        canonicalContactId: claimed.canonicalContactId,
        channel: msg.channel,
        channelContactId: msg.contactId,
        displayName: msg.contactName,
      });

      await hydrateCanonicalSessionFromLinkedChannels({
        workspaceId: claimed.workspaceId,
        workerId: claimed.workerId,
        canonicalContactId: claimed.canonicalContactId,
        sessionId: `aiva-${msg.workerId}-contact-${claimed.canonicalContactId}`,
      }).catch(() => ({ hydrated: 0 }));

      const channels = identities.map((row) => row.channel).join(', ');
      return [
        'Channels linked.',
        `Shared contact: ${claimed.canonicalContactId}`,
        `Linked channels: ${channels || msg.channel}`,
        'You can continue this chat from any linked channel. Use /chats to list recent threads.',
      ].join('\n');
    }

    const identities = await listAivaContactIdentities({
      workspaceId: msg.workspaceId,
      workerId: msg.workerId,
      canonicalContactId: resolved.canonicalContactId,
    });

    if (identities.length === 0) {
      return [
        'No channel links yet for this contact.',
        '',
        'Commands:',
        '/link code - generate a code on this channel',
        '/link claim <code> - attach this channel to the same person',
        '/chats - list pullable conversations for this contact',
      ].join('\n');
    }

    const lines = identities.map((row) => {
      const label = row.displayName ?? row.channelContactId;
      const primary = row.isPrimary ? ' (primary)' : '';
      return `- ${row.channel}: ${label}${primary}`;
    });

    return [
      `Shared contact: ${resolved.canonicalContactId}`,
      `Shared session: ${resolved.sessionId}`,
      'Linked identities:',
      ...lines,
      '',
      'Commands:',
      '/link code - generate a link code on this channel',
      '/link claim <code> - attach this channel to the same person',
      '/chats - list conversations you can continue here',
    ].join('\n');
  },
};

export const chatsCommand: SlashCommand = {
  name: 'chats',
  description: 'List conversations you can continue across linked channels',
  async handler(msg: InboundMessage) {
    if (!aivaContactIdentityEnabled()) {
      return 'Channel sync is disabled (AIVA_CONTACT_IDENTITY_ENABLED=false).';
    }

    const resolved = await resolveAivaCanonicalContact({
      workspaceId: msg.workspaceId,
      workerId: msg.workerId,
      channel: msg.channel,
      channelContactId: msg.contactId,
      displayName: msg.contactName,
    });

    const conversations = await listChannelSyncConversations({
      workspaceId: msg.workspaceId,
      workerId: msg.workerId,
      canonicalContactId: resolved.canonicalContactId,
      limit: 10,
    });

    const identities = await listAivaContactIdentities({
      workspaceId: msg.workspaceId,
      workerId: msg.workerId,
      canonicalContactId: resolved.canonicalContactId,
    });

    const lines = [
      `Shared contact: ${resolved.canonicalContactId}`,
      `Active session: ${resolved.sessionId}`,
      identities.length > 1
        ? `Linked channels: ${identities.map((i) => i.channel).join(', ')}`
        : 'Only this channel is linked. Use /link code on another channel, then /link claim here.',
      '',
      'Recent threads for this person:',
    ];

    for (const convo of conversations) {
      const when = convo.lastMessageAt ?? 'no messages yet';
      lines.push(
        `- [${convo.channel}] contact=${convo.contactId} msgs=${convo.messageCount} last=${when}`,
      );
    }

    lines.push('');
    lines.push(
      'Continuing on this channel uses the shared session automatically once channels are linked.',
    );
    return lines.join('\n');
  },
};
