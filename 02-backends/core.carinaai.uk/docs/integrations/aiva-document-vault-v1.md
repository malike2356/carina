# Aiva Document Vault v1

**Status:** Phase 707 inventory complete. Phase 708 canonical service + migrations complete. UI cutover is 710.

## Authority

`shared/workspace-governance/AIVA-KEPRIX-DOCUMENT-VAULT.md`

## Contract pack

`contracts/aiva-document-vault.v1/`

## Canonical service (708)

`src/document-vault/`

- `DocumentVaultService`: tenant-scoped tree CRUD, list pagination, rename, move, copy, trash, restore, permanent delete (approval), revisions, audit, quotas
- Storage: `LocalSandboxContentStore` and `ObjectStorageContentStore` (no arbitrary host paths)
- Migration: `migrateLegacyDocumentsToVault` from 707 manifest (`cloud_documents`, `aiva_knowledge_documents`), idempotent, checksum reconcile, rollback of applied mappings
- SQLite schema for local/tests; Postgres DDL:
  - `src/infrastructure/migrations/043-document-vault.sql`
  - cloud `src/db/migrations/0006_document-vault.sql`

## Feature flags

- `DOCUMENT_VAULT_V1_ENABLED` (default off until API/UI cutover)
- `DOCUMENT_VAULT_COMPAT_ADAPTERS` (default on)
- `DOCUMENT_VAULT_DUAL_WRITE` (default off)
- `DOCUMENT_VAULT_MIGRATE_DRY_RUN` (default on)
- `DOCUMENT_VAULT_RETIRE_LEGACY_STORES` (default off)
- `DOCUMENT_VAULT_STORAGE_MODE` = `sandbox` | `object`

## Hard rules

- Do not create a fourth unrelated document store.
- Do not expose the host filesystem as Document Vault.
- Aiva sessions never use `sqlite.carina_documents`.
- Host operator documents are out of migration scope.
- Permanent delete and destructive bulk require approval unless privileged.

## Tests

```bash
cd 02-backends/core.carinaai.uk
pnpm exec vitest run src/document-vault/
```

## Next

709 format engines; 710 explorer UI wired to this service.
