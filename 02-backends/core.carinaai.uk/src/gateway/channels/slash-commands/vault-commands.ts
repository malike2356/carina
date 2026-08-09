import type { SlashCommand } from './registry.js';
import { handleVaultChannelCommand } from '../../../document-vault/channel/index.js';
import { documentVaultFlags } from '../../../document-vault/flags.js';

export const vaultCommand: SlashCommand = {
  name: 'vault',
  description: 'Document Vault: list, search, create, import, export (/vault help)',
  async handler(msg) {
    if (!documentVaultFlags().channelOps) {
      return 'Document Vault channel ops are disabled.';
    }
    // Gateway slash path has no trusted Aiva worker workspace; require prior /vault bind.
    const result = await handleVaultChannelCommand({
      text: msg.text || '',
      platform: String(msg.channel || 'web'),
      channelUserId: msg.externalUserId || 'unknown',
    });
    return result.message;
  },
};
