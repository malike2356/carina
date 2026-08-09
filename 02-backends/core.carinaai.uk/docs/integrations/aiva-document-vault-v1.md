# Aiva Document Vault v1

**Status:** Programme complete through 715 (cutover). `admin.hireaiva.co.uk/documents` is the primary Document Vault.

## Authority

`shared/workspace-governance/AIVA-KEPRIX-DOCUMENT-VAULT.md`

## Contract pack

`contracts/aiva-document-vault.v1/` including `format-capability-matrix.json`

## What users get

- Folders and files with revisions, trash/restore, favorites, drag-and-drop moves
- Editors for markdown, HTML, plain text, CSV spreadsheets
- Import/export and deterministic PDF artifacts (unsupported conversions are rejected with clear errors)
- Soft Wall approvals for permanent delete, classified export, conflict overwrite
- Opt-in content indexing (`index_policy`; root `inherit` means `no_index`)
- Optional Google Drive sync (outbound push + inbound changes wakeup; conflicts preserve both)
- Work chat `vault-*` tools and Telegram `/vault` (same workspace binding; public audience blocked)

## Scope modes and sync authority

| Mode | Meaning |
| --- | --- |
| `content_authority=workspace` | Vault is authoritative; Google is a projection when connected |
| `content_authority=google` | Google-native item; vault stores mapping + searchable cache |
| Sync modes | Outbound-only, inbound-only, or two-way (chosen at Drive connect) |

Conflicts never last-write-wins. Preserve both versions and resolve via Soft Wall.

## Canonical service (core)

`src/document-vault/`

- Tree CRUD, revisions, trash, quotas, migration (708)
- Format engines (709), Google sync surfaces via cloud (711)
- Agent tools + Soft Wall (712), channel/Telegram (713), search/ops (714)
- Conformance: `src/document-vault/conformance.ts` + evidence under `docs/integrations/evidence/`

## Cloud explorer

`03-frontends/client-apps/app.carinaai.uk`

- Primary UI: `/documents` (`DocumentVaultExplorer`)
- `/files` redirects to `/documents`; window id `files` opens the vault explorer
- APIs: `/api/vault/items`, `/api/vault/search`, `/api/vault/ops/diagnostics`, Google routes under `/api/vault/google/*`
- Legacy `/api/documents` and `/api/files` remain compatibility-only until soak retires them

## Flags (715 cutover defaults)

| Flag | Default | Rollback |
| --- | --- | --- |
| `DOCUMENT_VAULT_V1_ENABLED` | `true` | Set `false` to prefer legacy adapters |
| `DOCUMENT_VAULT_COMPAT_ADAPTERS` | `true` | Keep `true` during soak |
| `DOCUMENT_VAULT_DUAL_WRITE` | `false` | Leave off |
| `DOCUMENT_VAULT_MIGRATE_DRY_RUN` | `false` | Set `true` for inventory-only |
| `DOCUMENT_VAULT_RETIRE_LEGACY_STORES` | `false` | Do not enable until soak evidence |

## Tests

```bash
cd 02-backends/core.carinaai.uk
pnpm exec vitest run src/document-vault/ src/tools/document-vault-tools.test.ts

cd 03-frontends/client-apps/app.carinaai.uk
pnpm exec vitest run src/lib/document-vault/
```

## Ops docs

- Search/ops: `aiva-document-vault-search-ops.md`
- Cutover/rollback runbook: `aiva-document-vault-cutover-runbook.md`
- Live Google owner run: `aiva-document-vault-live-google-runbook.md`
- Evidence: `evidence/document-vault-conformance-715.json`, `AIVA-DOCUMENT-VAULT-715-EVIDENCE.md`
