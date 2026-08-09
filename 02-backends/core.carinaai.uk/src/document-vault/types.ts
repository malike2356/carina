/** Aiva Document Vault v1 contract types (prompt 707). */

export const DOCUMENT_VAULT_CONTRACT_VERSION = '1.0.0';

export type DocumentVaultStoreId =
  | 'cloud_documents'
  | 'cloud_files_union'
  | 'host_carina_documents'
  | 'aiva_knowledge_base'
  | 'workspace_ops'
  | 'google_drive_tools'
  | 'chat_uploads'
  | 'channel_attachments'
  | 'host_file_tools';

export type VaultInventoryStore = {
  id: DocumentVaultStoreId | string;
  label: string;
  backend: string;
  paths: string[];
  idScheme: string;
  tenantKey: string;
  revisions: boolean | string;
  trash: boolean | string;
  folders: boolean;
  googleMapping: boolean | string;
  inVaultScope: boolean;
};

export type VaultInventoryCaller = {
  id: string;
  storeIds: string[];
  path: string;
  tenantBoundary: string;
};

export type VaultInventoryManifest = {
  version: string;
  generatedForPrompt: string;
  stores: VaultInventoryStore[];
  callers: VaultInventoryCaller[];
  collisionClasses: string[];
};

export type SnapshotDocument = {
  id: string;
  title: string;
  content: string;
  checksum: string;
  archived?: boolean;
  workerId?: string;
  enabled?: boolean;
};

export type SnapshotOpsMapping = {
  bindingId: string;
  driveFileId: string;
  aivaDocumentId: string;
  status: string;
  contentHash: string;
};

export type SnapshotUploadFile = {
  path: string;
  referenced: boolean;
};

export type SnapshotRagCitation = {
  documentId: string;
};

export type WorkspaceInventorySnapshot = {
  workspaceId: string;
  cloudDocuments: SnapshotDocument[];
  knowledgeDocuments: SnapshotDocument[];
  opsMappings: SnapshotOpsMapping[];
  uploadFiles: SnapshotUploadFile[];
  ragCitations: SnapshotRagCitation[];
};

export type VaultInventorySnapshot = {
  workspaces: WorkspaceInventorySnapshot[];
};

export type DuplicateFinding = {
  workspaceId: string;
  class: string;
  keys: string[];
  detail: string;
};

export type OrphanFinding = {
  workspaceId: string;
  class: string;
  ref: string;
  detail: string;
};

export type ConflictFinding = {
  workspaceId: string;
  class: string;
  ref: string;
  detail: string;
};

export type InventoryReport = {
  readOnly: true;
  mutatesProduction: false;
  duplicates: DuplicateFinding[];
  orphans: OrphanFinding[];
  conflicts: ConflictFinding[];
  metrics: Record<string, number>;
};
