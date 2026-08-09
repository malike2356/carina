import type { SlashCommand } from './registry.js';
import {
  handleVaultChannelCommand,
  type ChannelAttachment,
} from '../../document-vault/channel/index.js';
import { documentVaultFlags } from '../../document-vault/flags.js';
import type { InboundMessage } from '../types.js';

function attachmentFromInbound(msg: InboundMessage): ChannelAttachment | null {
  const meta = msg.metadata ?? {};
  const b64 = meta.vaultFileBase64;
  if (!b64) return null;
  return {
    platform: 'telegram',
    channelUserId: meta.telegramUserId || msg.contactId,
    eventId: meta.telegramMessageId || meta.eventId || msg.threadId || '',
    filename: meta.vaultFilename || 'upload.bin',
    data: Buffer.from(b64, 'base64'),
    declaredMime: meta.vaultMime || '',
    caption: msg.content || '',
  };
}

export const vaultCommand: SlashCommand = {
  name: 'vault',
  description: 'Document Vault: list, search, create, import, export (/vault help)',
  async handler(msg) {
    if (!documentVaultFlags().channelOps) {
      return 'Document Vault channel ops are disabled.';
    }
    const channelUserId =
      msg.metadata?.telegramUserId
      || (msg.channel === 'telegram' ? String(msg.contactId) : '')
      || msg.contactId;
    const result = await handleVaultChannelCommand({
      text: msg.content || '',
      platform: msg.channel,
      channelUserId,
      workspaceId: msg.workspaceId,
      workerId: msg.workerId,
      attachment: attachmentFromInbound(msg),
    });
    if (result.attach) {
      return { text: result.message, attach: result.attach };
    }
    return result.message;
  },
};
