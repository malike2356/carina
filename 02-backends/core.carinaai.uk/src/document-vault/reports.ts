import type {
  ConflictFinding,
  DuplicateFinding,
  InventoryReport,
  OrphanFinding,
  VaultInventorySnapshot,
  WorkspaceInventorySnapshot,
} from './types.js';
import { documentVaultFlags } from './flags.js';
import { loadDocumentVaultMigrationManifest } from './inventory.js';

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findDuplicates(ws: WorkspaceInventorySnapshot): DuplicateFinding[] {
  const findings: DuplicateFinding[] = [];
  const cloudByKey = new Map<string, string>();
  for (const doc of ws.cloudDocuments) {
    cloudByKey.set(`${normalizeTitle(doc.title)}|${doc.checksum}`, doc.id);
  }
  for (const doc of ws.knowledgeDocuments) {
    const key = `${normalizeTitle(doc.title)}|${doc.checksum}`;
    const cloudId = cloudByKey.get(key);
    if (cloudId) {
      findings.push({
        workspaceId: ws.workspaceId,
        class: 'title_checksum_cross_store',
        keys: [cloudId, doc.id],
        detail: `Cloud document ${cloudId} and knowledge ${doc.id} share title+checksum`,
      });
    }
  }

  const idHits = new Map<string, string[]>();
  for (const doc of ws.cloudDocuments) {
    idHits.set(doc.id, [...(idHits.get(doc.id) ?? []), 'cloud_documents']);
  }
  for (const doc of ws.knowledgeDocuments) {
    idHits.set(doc.id, [...(idHits.get(doc.id) ?? []), 'aiva_knowledge_base']);
  }
  for (const [id, stores] of idHits) {
    if (stores.length > 1) {
      findings.push({
        workspaceId: ws.workspaceId,
        class: 'uuid_namespace_collision',
        keys: [id, ...stores],
        detail: `ID ${id} appears in ${stores.join(' and ')}`,
      });
    }
  }

  const driveHits = new Map<string, string[]>();
  for (const mapping of ws.opsMappings) {
    const list = driveHits.get(mapping.driveFileId) ?? [];
    list.push(mapping.aivaDocumentId);
    driveHits.set(mapping.driveFileId, list);
  }
  for (const [driveFileId, docs] of driveHits) {
    if (new Set(docs).size > 1) {
      findings.push({
        workspaceId: ws.workspaceId,
        class: 'drive_file_multi_map',
        keys: [driveFileId, ...docs],
        detail: `Drive file ${driveFileId} maps to multiple local ids`,
      });
    }
  }

  return findings;
}

function findOrphans(ws: WorkspaceInventorySnapshot): OrphanFinding[] {
  const findings: OrphanFinding[] = [];
  const knowledgeIds = new Set(ws.knowledgeDocuments.map((d) => d.id));
  const cloudIds = new Set(ws.cloudDocuments.map((d) => d.id));
  const localIds = new Set([...knowledgeIds, ...cloudIds]);

  for (const mapping of ws.opsMappings) {
    if (!localIds.has(mapping.aivaDocumentId)) {
      findings.push({
        workspaceId: ws.workspaceId,
        class: 'ops_mapping_missing_local',
        ref: mapping.aivaDocumentId,
        detail: `Mapping for Drive ${mapping.driveFileId} points at missing local ${mapping.aivaDocumentId}`,
      });
    }
  }

  for (const file of ws.uploadFiles) {
    if (!file.referenced) {
      findings.push({
        workspaceId: ws.workspaceId,
        class: 'upload_fs_orphan',
        ref: file.path,
        detail: 'Upload path has no DB reference',
      });
    }
  }

  for (const cite of ws.ragCitations) {
    if (!localIds.has(cite.documentId)) {
      findings.push({
        workspaceId: ws.workspaceId,
        class: 'rag_citation_missing_document',
        ref: cite.documentId,
        detail: 'RAG citation targets missing document id',
      });
    }
  }

  return findings;
}

function findConflicts(ws: WorkspaceInventorySnapshot): ConflictFinding[] {
  const findings: ConflictFinding[] = [];
  for (const mapping of ws.opsMappings) {
    if (mapping.status === 'conflict') {
      findings.push({
        workspaceId: ws.workspaceId,
        class: 'ops_sync_conflict',
        ref: mapping.driveFileId,
        detail: `Ops mapping ${mapping.aivaDocumentId} is in conflict`,
      });
    }
  }
  return findings;
}

/**
 * Read-only inventory reports. Never mutate production data.
 * Callers must pass an in-memory or exported snapshot; live DB scrape belongs to ops tooling with dry-run flag.
 */
export function buildDocumentVaultInventoryReport(
  snapshot: VaultInventorySnapshot,
): InventoryReport {
  const flags = documentVaultFlags();
  if (!flags.migrateDryRun && flags.retireLegacyStores) {
    throw new Error(
      'Refusing inventory report while DOCUMENT_VAULT_MIGRATE_DRY_RUN=false and legacy retirement is enabled',
    );
  }

  const duplicates: DuplicateFinding[] = [];
  const orphans: OrphanFinding[] = [];
  const conflicts: ConflictFinding[] = [];

  for (const ws of snapshot.workspaces) {
    duplicates.push(...findDuplicates(ws));
    orphans.push(...findOrphans(ws));
    conflicts.push(...findConflicts(ws));
  }

  return {
    readOnly: true,
    mutatesProduction: false,
    duplicates,
    orphans,
    conflicts,
    metrics: {
      workspace_count: snapshot.workspaces.length,
      duplicate_count: duplicates.length,
      orphan_count: orphans.length,
      conflict_count: conflicts.length,
    },
  };
}

export type RollbackReport = {
  readOnly: true;
  mutatesProduction: false;
  safe: boolean;
  criteria: string[];
  blockers: string[];
  notes?: string[];
};

export function buildDocumentVaultRollbackReport(
  flags = documentVaultFlags(),
): RollbackReport {
  const manifest = loadDocumentVaultMigrationManifest() as {
    rollbackCriteria?: string[];
  };
  const criteria = manifest.rollbackCriteria ?? [];
  const blockers: string[] = [];
  if (flags.retireLegacyStores) {
    blockers.push('DOCUMENT_VAULT_RETIRE_LEGACY_STORES=true');
  }
  if (!flags.compatAdapters) {
    blockers.push('DOCUMENT_VAULT_COMPAT_ADAPTERS=false');
  }
  // Cutover defaults (V1 on, migrate dry-run off) remain rollback-safe while compat adapters stay enabled.
  const notes: string[] = [];
  if (!flags.migrateDryRun && flags.v1Enabled) {
    notes.push('Cutover live: V1 enabled with migrate dry-run off; keep COMPAT_ADAPTERS=1 through soak');
  }
  return {
    readOnly: true,
    mutatesProduction: false,
    safe: blockers.length === 0,
    criteria,
    blockers,
    notes,
  };
}

/** Tenant boundary check for snapshot tooling: never mix workspaces. */
export function assertSnapshotTenantIsolation(snapshot: VaultInventorySnapshot): void {
  const seen = new Set<string>();
  for (const ws of snapshot.workspaces) {
    if (seen.has(ws.workspaceId)) {
      throw new Error(`Duplicate workspace snapshot: ${ws.workspaceId}`);
    }
    seen.add(ws.workspaceId);
    for (const doc of ws.cloudDocuments) {
      if (!doc.id) throw new Error(`Missing document id in ${ws.workspaceId}`);
    }
  }
  const foreignLeak = snapshot.workspaces.some((ws) =>
    ws.cloudDocuments.some((doc) =>
      snapshot.workspaces.some(
        (other) =>
          other.workspaceId !== ws.workspaceId
          && other.cloudDocuments.some((d) => d.id === doc.id),
      ),
    ),
  );
  if (foreignLeak) {
    throw new Error('Document id collision across workspaces in snapshot');
  }
}
