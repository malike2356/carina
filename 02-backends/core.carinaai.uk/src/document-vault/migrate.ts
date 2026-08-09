import { documentVaultFlags } from './flags.js';
import { sha256Hex } from './model.js';
import { DocumentVaultService, type ActorContext } from './service.js';

export type LegacyCloudDocument = {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  format?: string;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type LegacyKnowledgeDocument = {
  id: string;
  workspaceId: string;
  workerId?: string;
  title: string;
  content: string;
  enabled?: boolean;
};

export type LegacyMigrationBatch = {
  workspaceId: string;
  cloudDocuments?: LegacyCloudDocument[];
  knowledgeDocuments?: LegacyKnowledgeDocument[];
};

export type MigrationResult = {
  mode: 'dry_run' | 'apply';
  imported: number;
  skipped: number;
  checksumOk: number;
  checksumMismatch: number;
  rolledBack: boolean;
  details: string[];
};

/**
 * Idempotent migration from 707 manifest record types cloud_documents and
 * aiva_knowledge_documents. Preserves legacy IDs via vault item id + legacy_mappings.
 * Never migrates host_carina_documents.
 */
export async function migrateLegacyDocumentsToVault(
  vault: DocumentVaultService,
  batch: LegacyMigrationBatch,
  options: {
    dryRun?: boolean;
    actor?: ActorContext;
    /** When true, remove vault items created in this apply for the workspace (routing rollback aid). */
    rollbackApplied?: boolean;
  } = {},
): Promise<MigrationResult> {
  const flags = documentVaultFlags();
  const dryRun = options.dryRun ?? flags.migrateDryRun;
  const mode = dryRun ? 'dry_run' : 'apply';
  const actor = options.actor ?? { actorId: 'migration-708' };
  const details: string[] = [];
  let imported = 0;
  let skipped = 0;
  let checksumOk = 0;
  let checksumMismatch = 0;

  if (options.rollbackApplied) {
    if (dryRun) {
      details.push('rollback requested but dry_run=true; no rows removed');
      return {
        mode,
        imported: 0,
        skipped: 0,
        checksumOk: 0,
        checksumMismatch: 0,
        rolledBack: false,
        details,
      };
    }
    const cloud = batch.cloudDocuments ?? [];
    const knowledge = batch.knowledgeDocuments ?? [];
    let removed = 0;
    for (const doc of cloud) {
      const mapping = vault.getLegacyMapping(batch.workspaceId, 'cloud_documents', doc.id);
      if (!mapping) continue;
      try {
        vault.permanentDelete(batch.workspaceId, mapping.itemId, { actor: { ...actor, privileged: true } });
        removed += 1;
      } catch {
        details.push(`rollback skip ${doc.id}`);
      }
    }
    for (const doc of knowledge) {
      const mapping = vault.getLegacyMapping(batch.workspaceId, 'aiva_knowledge_documents', doc.id);
      if (!mapping) continue;
      try {
        vault.permanentDelete(batch.workspaceId, mapping.itemId, { actor: { ...actor, privileged: true } });
        removed += 1;
      } catch {
        details.push(`rollback skip knowledge ${doc.id}`);
      }
    }
    vault.recordMigrationRun({
      workspaceId: batch.workspaceId,
      mode: 'rollback',
      source: 'legacy_batch',
      status: 'ok',
      imported: 0,
      skipped: removed,
      checksumOk: 0,
      detail: { removed },
    });
    return {
      mode: 'apply',
      imported: 0,
      skipped: removed,
      checksumOk: 0,
      checksumMismatch: 0,
      rolledBack: true,
      details,
    };
  }

  async function importOne(
    source: 'cloud_documents' | 'aiva_knowledge_documents',
    doc: { id: string; title: string; content: string; format?: string; archived?: boolean },
  ): Promise<void> {
    const checksum = sha256Hex(doc.content);
    const existing = vault.getLegacyMapping(batch.workspaceId, source, doc.id);
    if (existing) {
      skipped += 1;
      if (existing.checksum === checksum) checksumOk += 1;
      else {
        checksumMismatch += 1;
        details.push(`${source}:${doc.id} already mapped with different checksum`);
      }
      return;
    }

    if (dryRun) {
      imported += 1;
      checksumOk += 1;
      details.push(`dry_run would import ${source}:${doc.id}`);
      return;
    }

    const kind = DocumentVaultService.kindFromLegacyFormat(doc.format);
    const item = await vault.createItem(
      {
        workspaceId: batch.workspaceId,
        parentId: null,
        kind,
        name: doc.title || 'Untitled',
        content: doc.content,
        id: doc.id.toLowerCase(),
        contentAuthority: 'workspace',
        indexPolicy: 'index',
      },
      actor,
    );
    if (doc.archived) {
      vault.trash(batch.workspaceId, item.id, actor);
    }
    vault.upsertLegacyMapping({
      workspaceId: batch.workspaceId,
      legacySource: source,
      legacyId: doc.id,
      itemId: item.id,
      checksum,
    });
    imported += 1;
    checksumOk += 1;
  }

  for (const doc of batch.cloudDocuments ?? []) {
    if (doc.workspaceId !== batch.workspaceId) {
      details.push(`cross-tenant cloud doc skipped: ${doc.id}`);
      skipped += 1;
      continue;
    }
    await importOne('cloud_documents', doc);
  }

  for (const doc of batch.knowledgeDocuments ?? []) {
    if (doc.workspaceId !== batch.workspaceId) {
      details.push(`cross-tenant knowledge doc skipped: ${doc.id}`);
      skipped += 1;
      continue;
    }
    await importOne('aiva_knowledge_documents', {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      format: 'plain',
    });
  }

  vault.recordMigrationRun({
    workspaceId: batch.workspaceId,
    mode,
    source: 'legacy_batch',
    status: checksumMismatch > 0 ? 'checksum_warnings' : 'ok',
    imported,
    skipped,
    checksumOk,
    detail: { checksumMismatch, details: details.slice(0, 20) },
  });

  return {
    mode,
    imported,
    skipped,
    checksumOk,
    checksumMismatch,
    rolledBack: false,
    details,
  };
}
