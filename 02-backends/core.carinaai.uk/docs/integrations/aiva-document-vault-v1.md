# Aiva Document Vault v1 (inventory and consolidation)

**Status:** Phase 707 complete (inventory, contract, flags, read-only reports). Canonical service lands in 708.

## Authority

`shared/workspace-governance/AIVA-KEPRIX-DOCUMENT-VAULT.md`

## Contract pack

`contracts/aiva-document-vault.v1/`

- `contract.json`: versioned service contract
- `ownership-matrix.json`: who owns metadata, content, revisions, mappings, jobs, indexes, audit
- `migration-manifest.json`: record-type mapping, duplicate/orphan/conflict detectors, rollback criteria
- `inventory.json`: every current store and caller path
- `fixtures/synthetic/inventory-snapshot.json`: repeatable dry-run report input

## Code

`src/document-vault/`

- Feature flags: `DOCUMENT_VAULT_V1_ENABLED` (default off), `DOCUMENT_VAULT_COMPAT_ADAPTERS` (default on), `DOCUMENT_VAULT_DUAL_WRITE` (default off), `DOCUMENT_VAULT_MIGRATE_DRY_RUN` (default on), `DOCUMENT_VAULT_RETIRE_LEGACY_STORES` (default off)
- `buildDocumentVaultInventoryReport(snapshot)`: read-only duplicates, orphans, conflicts
- `buildDocumentVaultRollbackReport()`: whether legacy rollback is still safe

## Hard rules

- Do not create a fourth unrelated document store.
- Do not expose the host filesystem as Document Vault.
- Aiva sessions never use `sqlite.carina_documents`.
- Inventory and migration reports stay dry-run unless an owner explicitly changes flags after soak.

## Next

Prompt 708 builds the canonical tree, storage adapters, revisions, and idempotent migration from this manifest.
