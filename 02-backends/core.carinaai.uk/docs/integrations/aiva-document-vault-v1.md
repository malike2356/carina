# Aiva Document Vault v1

**Status:** 707 inventory, 708 canonical service, 709 format engines, 710 explorer UI complete. Google Drive sync is 711.

## Authority

`shared/workspace-governance/AIVA-KEPRIX-DOCUMENT-VAULT.md`

## Contract pack

`contracts/aiva-document-vault.v1/` including `format-capability-matrix.json`

## Canonical service (core)

`src/document-vault/`

- Tree CRUD, revisions, trash, quotas, migration (708)
- Format engines (709): capability matrix, sniff/sanitize, import/export, deterministic PDF artifacts, conversion jobs
- Storage adapters reject arbitrary host paths

## Cloud explorer (710)

`03-frontends/client-apps/app.carinaai.uk`

- Postgres tables via drizzle `document_vault_*` (`migrations/0006_document-vault.sql`)
- Store: `src/lib/document-vault/pg-store.ts`
- API: `/api/vault/items` and `/api/vault/items/[id]`
- Compatibility: `/api/documents/[id]` resolves vault items after legacy docs
- UI: `DocumentVaultExplorer` on `/documents` (breadcrumbs, tree, list/grid, create/upload, multi-select, favorites, trash, DnD move with server validation and rollback)
- Editors: rich TipTap for HTML/rich docs; monospace for markdown, plain text, CSV spreadsheet, presentation outlines; revision conflict banner
- `/files` redirects to `/documents`
- Drive Ops remains at `/documents?tab=drive` until 711

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

cd 03-frontends/client-apps/app.carinaai.uk
pnpm exec vitest run src/lib/document-vault/
```

## Next

711 Google Drive OAuth, sync modes, conflict UX, and watch renewal.
