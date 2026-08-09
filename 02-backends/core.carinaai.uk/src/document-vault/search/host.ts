import type { VaultAuditEvent, VaultItem, VaultRevision } from '../model.js';

/** Narrow host surface so search/ops avoid circular imports with DocumentVaultService. */
export type VaultSearchHost = {
  getItem(workspaceId: string, itemId: string, options?: { includeTrashed?: boolean }): VaultItem;
  getItemOrNull(workspaceId: string, itemId: string, options?: { includeTrashed?: boolean }): VaultItem | null;
  readContent(workspaceId: string, itemId: string): Promise<Buffer>;
  enqueueJobIdempotent(input: {
    workspaceId: string;
    kind: string;
    itemId?: string | null;
    idempotencyKey: string;
    payload?: Record<string, unknown>;
  }): { id: string; idempotent?: boolean };
  upsertIndexEntry(input: {
    workspaceId: string;
    itemId: string;
    revision: number;
    sourceId: string;
    status: string;
    chunkCount?: number;
    contentChecksum?: string | null;
    error?: string | null;
  }): Record<string, unknown>;
  replaceIndexChunks(
    workspaceId: string,
    itemId: string,
    revision: number,
    chunks: string[],
  ): number;
  deleteIndexForItem(workspaceId: string, itemId: string): number;
  searchIndexChunks(
    workspaceId: string,
    query: string,
    limit?: number,
  ): Array<Record<string, unknown>>;
  listIndexEntries(workspaceId: string): Array<Record<string, unknown>>;
  scanOrphanIndexEntries(workspaceId: string): Array<Record<string, unknown>>;
  claimJob(workspaceId: string, workerId?: string): Record<string, unknown> | null;
  completeJob(
    workspaceId: string,
    jobId: string,
    result?: Record<string, unknown>,
  ): Record<string, unknown> | null;
  failJob(
    workspaceId: string,
    jobId: string,
    reason: string,
  ): Record<string, unknown> | null;
  retryJob(workspaceId: string, jobId: string): Record<string, unknown> | null;
  listJobs(workspaceId: string, status?: string): Array<Record<string, unknown>>;
  listAudit(workspaceId: string, limit?: number): VaultAuditEvent[];
  listRevisions(workspaceId: string, itemId: string): VaultRevision[];
  listProviderMappings?(workspaceId: string, itemId?: string): Array<Record<string, unknown>>;
  listAllItems?(workspaceId: string): VaultItem[];
  getDbPath?(): string | null;
};
