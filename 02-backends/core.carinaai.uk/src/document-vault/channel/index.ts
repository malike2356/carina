export {
  CHANNEL_MATRIX,
  channelMaxAttachBytes,
  channelSupportsFiles,
  type ChannelAttachment,
  type ChannelReceipt,
} from './contract.js';
export {
  bindChannelIdentity,
  ensureWorkerChannelBinding,
  resolveChannelBinding,
  revokeChannelBinding,
  type ChannelVaultContext,
} from './binding.js';
export { quarantineAttachment } from './quarantine.js';
export { importChannelAttachment } from './import-pipeline.js';
export { consumeDeliveryToken, planExportDelivery } from './export-delivery.js';
export {
  VAULT_SLASH_USAGE,
  handleVaultChannelCommand,
  looksLikeVaultImportCaption,
  parseVaultNl,
  type VaultCommandResult,
} from './commands.js';
