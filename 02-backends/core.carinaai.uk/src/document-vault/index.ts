export {
  DOCUMENT_VAULT_CONTRACT_VERSION,
} from './types.js';
export {
  documentVaultFlags,
  documentVaultRollbackSafe,
} from './flags.js';
export {
  assertContractVersionAligned,
  carinaRepoRootFromContract,
  DOCUMENT_VAULT_CONTRACT_ROOT,
  loadDocumentVaultContractManifest,
  loadDocumentVaultInventory,
  loadDocumentVaultMigrationManifest,
  loadDocumentVaultOwnershipMatrix,
  loadSyntheticInventorySnapshot,
} from './inventory.js';
export {
  assertSnapshotTenantIsolation,
  buildDocumentVaultInventoryReport,
  buildDocumentVaultRollbackReport,
} from './reports.js';
export {
  VAULT_ITEM_KINDS,
  defaultMimeForKind,
  kindFromFormatOrExtension,
  sanitizeVaultFileName,
  type VaultItemKind,
} from './kinds.js';
export {
  DocumentVaultService,
  VaultError,
  type ActorContext,
  type CreateItemInput,
} from './service.js';
export {
  migrateLegacyDocumentsToVault,
  type LegacyMigrationBatch,
  type MigrationResult,
} from './migrate.js';
export {
  LocalSandboxContentStore,
  ObjectStorageContentStore,
  createDefaultContentStore,
} from './content-store.js';
export type { VaultItem, VaultRevision } from './model.js';
