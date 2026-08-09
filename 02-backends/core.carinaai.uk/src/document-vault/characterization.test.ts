import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { documentsManageTool } from '../tools/documents-manage.js';
import { isAivaSessionId } from '../security/tenant-isolation.js';
import {
  assertContractVersionAligned,
  assertSnapshotTenantIsolation,
  buildDocumentVaultInventoryReport,
  buildDocumentVaultRollbackReport,
  carinaRepoRootFromContract,
  documentVaultFlags,
  documentVaultRollbackSafe,
  loadDocumentVaultContractManifest,
  loadDocumentVaultInventory,
  loadDocumentVaultMigrationManifest,
  loadDocumentVaultOwnershipMatrix,
  loadSyntheticInventorySnapshot,
  DOCUMENT_VAULT_CONTRACT_VERSION,
} from './index.js';

const REQUIRED_STORE_IDS = [
  'cloud_documents',
  'cloud_files_union',
  'host_carina_documents',
  'aiva_knowledge_base',
  'workspace_ops',
  'google_drive_tools',
  'chat_uploads',
  'channel_attachments',
  'host_file_tools',
] as const;

const REQUIRED_CALLER_IDS = [
  'ui_documents',
  'ui_document_editor',
  'ui_files',
  'ui_research_save',
  'tool_workspace_document_create',
  'tool_documents_manage',
  'tool_google_drive',
  'mandatory_tools_vault_hints',
  'workspace_ops_api',
  'chat_attachments',
  'tenant_isolation_helpers',
] as const;

describe('Document Vault v1 characterization (707)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('loads versioned contract, ownership matrix, and migration manifest', () => {
    assertContractVersionAligned();
    const contract = loadDocumentVaultContractManifest();
    expect(contract.version).toBe(DOCUMENT_VAULT_CONTRACT_VERSION);
    expect(contract.authority).toContain('AIVA-KEPRIX-DOCUMENT-VAULT.md');
    expect(contract.phase).toMatch(/70[789]|71[0-5]/);

    const ownership = loadDocumentVaultOwnershipMatrix();
    expect(ownership.target).toBeTruthy();
    expect(Array.isArray(ownership.currentOwners)).toBe(true);
    expect(Array.isArray(ownership.hardRules)).toBe(true);

    const migration = loadDocumentVaultMigrationManifest();
    expect(migration.modeDefault).toBe('dry_run');
    expect(Array.isArray(migration.recordTypes)).toBe(true);
    expect((migration.recordTypes as unknown[]).length).toBeGreaterThanOrEqual(8);
  });

  it('inventory covers every known store and caller with on-disk paths', () => {
    const inventory = loadDocumentVaultInventory();
    const repoRoot = carinaRepoRootFromContract();
    const storeIds = new Set(inventory.stores.map((s) => s.id));
    for (const id of REQUIRED_STORE_IDS) {
      expect(storeIds.has(id)).toBe(true);
    }
    const callerIds = new Set(inventory.callers.map((c) => c.id));
    for (const id of REQUIRED_CALLER_IDS) {
      expect(callerIds.has(id)).toBe(true);
    }

    for (const store of inventory.stores) {
      expect(store.paths.length).toBeGreaterThan(0);
      for (const rel of store.paths) {
        const full = path.join(repoRoot, rel);
        expect(existsSync(full), `missing store path ${rel}`).toBe(true);
      }
    }
    for (const caller of inventory.callers) {
      const full = path.join(repoRoot, caller.path);
      expect(existsSync(full), `missing caller path ${caller.path}`).toBe(true);
      expect(caller.tenantBoundary.length).toBeGreaterThan(0);
    }

    const host = inventory.stores.find((s) => s.id === 'host_carina_documents');
    const hostFs = inventory.stores.find((s) => s.id === 'host_file_tools');
    expect(host?.inVaultScope).toBe(false);
    expect(hostFs?.inVaultScope).toBe(false);
  });

  it('does not plan a fourth content store or host FS vault root', () => {
    const contract = loadDocumentVaultContractManifest();
    expect(contract.outOfScope).toEqual(
      expect.arrayContaining(['host-filesystem-browser', 'file-read', 'file-write']),
    );
    const ownership = loadDocumentVaultOwnershipMatrix() as {
      hardRules: string[];
      target: { metadataService: string };
    };
    expect(ownership.hardRules.some((r) => /fourth/i.test(r))).toBe(true);
    expect(ownership.hardRules.some((r) => /host filesystem/i.test(r))).toBe(true);
    expect(ownership.target.metadataService).toContain('document-vault.service');
  });

  it('feature flags default to cutover-on with bounded rollback', () => {
    delete process.env.DOCUMENT_VAULT_V1_ENABLED;
    delete process.env.DOCUMENT_VAULT_COMPAT_ADAPTERS;
    delete process.env.DOCUMENT_VAULT_DUAL_WRITE;
    delete process.env.DOCUMENT_VAULT_MIGRATE_DRY_RUN;
    delete process.env.DOCUMENT_VAULT_RETIRE_LEGACY_STORES;

    const flags = documentVaultFlags();
    expect(flags.v1Enabled).toBe(true);
    expect(flags.compatAdapters).toBe(true);
    expect(flags.dualWrite).toBe(false);
    expect(flags.migrateDryRun).toBe(false);
    expect(flags.retireLegacyStores).toBe(false);
    expect(documentVaultRollbackSafe(flags)).toBe(true);

    process.env.DOCUMENT_VAULT_RETIRE_LEGACY_STORES = 'true';
    expect(documentVaultRollbackSafe()).toBe(false);
  });

  it('builds read-only duplicate, orphan, conflict, and rollback reports', () => {
    const snapshot = loadSyntheticInventorySnapshot();
    assertSnapshotTenantIsolation(snapshot);
    const report = buildDocumentVaultInventoryReport(snapshot);
    expect(report.readOnly).toBe(true);
    expect(report.mutatesProduction).toBe(false);
    expect(report.duplicates.some((d) => d.class === 'title_checksum_cross_store')).toBe(true);
    expect(report.duplicates.some((d) => d.class === 'uuid_namespace_collision')).toBe(true);
    expect(report.duplicates.some((d) => d.class === 'drive_file_multi_map')).toBe(true);
    expect(report.orphans.some((o) => o.class === 'ops_mapping_missing_local')).toBe(true);
    expect(report.orphans.some((o) => o.class === 'upload_fs_orphan')).toBe(true);
    expect(report.orphans.some((o) => o.class === 'rag_citation_missing_document')).toBe(true);
    expect(report.conflicts.some((c) => c.class === 'ops_sync_conflict')).toBe(true);
    expect(report.metrics.duplicate_count).toBeGreaterThan(0);

    const rollback = buildDocumentVaultRollbackReport();
    expect(rollback.readOnly).toBe(true);
    expect(rollback.mutatesProduction).toBe(false);
    expect(rollback.criteria.length).toBeGreaterThan(0);
    expect(rollback.safe).toBe(true);
  });

  it('keeps Aiva sessions off the host documents store (tenant boundary)', async () => {
    expect(isAivaSessionId('aiva-ws1-worker-web-1')).toBe(true);
    const blocked = await documentsManageTool.execute({
      action: 'list',
      _sessionId: 'aiva-ws1-worker-web-1',
    }) as { error?: string };
    expect(blocked.error).toMatch(/workspace session|workspace-document/i);

    const hostBlocked = await documentsManageTool.execute({
      action: 'get',
      id: 'any',
      _sessionId: 'aiva-ws1-worker-web-1',
    }) as { error?: string };
    expect(hostBlocked.error).toMatch(/host documents store|workspace-document|vault-create-file|vault-list/i);
  });

  it('refuses cross-workspace id collisions in snapshots', () => {
    expect(() =>
      assertSnapshotTenantIsolation({
        workspaces: [
          {
            workspaceId: 'a',
            cloudDocuments: [
              {
                id: 'shared',
                title: 'x',
                content: '1',
                checksum: 'c1',
              },
            ],
            knowledgeDocuments: [],
            opsMappings: [],
            uploadFiles: [],
            ragCitations: [],
          },
          {
            workspaceId: 'b',
            cloudDocuments: [
              {
                id: 'shared',
                title: 'y',
                content: '2',
                checksum: 'c2',
              },
            ],
            knowledgeDocuments: [],
            opsMappings: [],
            uploadFiles: [],
            ragCitations: [],
          },
        ],
      }),
    ).toThrow(/across workspaces/i);
  });
});
