# Aiva Document Vault v1

**Status:** 707 inventory, 708 canonical service, 709 format engines complete. UI cutover is 710.

## Authority

`shared/workspace-governance/AIVA-KEPRIX-DOCUMENT-VAULT.md`

## Contract pack

`contracts/aiva-document-vault.v1/` including `format-capability-matrix.json`

## Canonical service

`src/document-vault/`

- Tree CRUD, revisions, trash, quotas, migration (708)
- Format engines (709): capability matrix, sniff/sanitize, import/export, deterministic PDF artifacts, conversion jobs
- Storage adapters reject arbitrary host paths

## Format engines (709)

- `getDocumentVaultFormatCapabilities()` for API/UI gating
- `importBytesIntoVault` / `exportVaultItem` / `generatePdfArtifact`
- Lossy conversions keep `.original` binaries where needed
- Generated PDFs are artifacts linked to the source revision; uploaded PDFs stay originals
- Archives, executables, spoofed PDFs, and oversized uploads fail closed

## Feature flags

- `DOCUMENT_VAULT_V1_ENABLED` (default off until API/UI cutover)
- `DOCUMENT_VAULT_COMPAT_ADAPTERS` (default on)
- `DOCUMENT_VAULT_DUAL_WRITE` (default off)
- `DOCUMENT_VAULT_MIGRATE_DRY_RUN` (default on)
- `DOCUMENT_VAULT_RETIRE_LEGACY_STORES` (default off)
- `DOCUMENT_VAULT_STORAGE_MODE` = `sandbox` | `object`

## Tests

```bash
cd 02-backends/core.carinaai.uk
pnpm exec vitest run src/document-vault/
```

## Next

710 document explorer UI wired to this service and format matrix.
