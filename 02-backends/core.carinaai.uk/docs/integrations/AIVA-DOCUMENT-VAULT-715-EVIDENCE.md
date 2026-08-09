# Aiva Document Vault 715 evidence

**Date:** 2026-08-09  
**Git tip (at write):** filled at ship time  
**Prompt:** `715-e2e-cutover-documentation-and-deploy`

## Conformance

- Matrix: `docs/integrations/evidence/document-vault-conformance-715.json`
- Summary: `green=true`, `failed=0`, `real=19`, `blocked_optional_credentials=1` (live Google owner run)
- Generator: `src/document-vault/conformance.ts` via `scripts/document-vault-cutover.sh`

## Local

```bash
cd 02-backends/core.carinaai.uk
bash scripts/document-vault-cutover.sh
pnpm exec vitest run src/document-vault/ src/tools/document-vault-tools.test.ts
pnpm exec tsc --noEmit
```

## Cutover defaults

- `DOCUMENT_VAULT_V1_ENABLED=1`
- `DOCUMENT_VAULT_COMPAT_ADAPTERS=1`
- `DOCUMENT_VAULT_DUAL_WRITE=0`
- `DOCUMENT_VAULT_MIGRATE_DRY_RUN=0`
- `DOCUMENT_VAULT_RETIRE_LEGACY_STORES=0` (soak; do not retire yet)

## Primary UX

- `admin.hireaiva.co.uk/documents` / `app.carinaai.uk/documents`
- `/files` redirects to `/documents`
- Window/launcher/capabilities point at Documents / vault explorer

## Legacy policy

| Surface | Status |
| --- | --- |
| Host sqlite documents | OUT_OF_SCOPE |
| Cloud `/api/documents`, `/api/files` | Compatibility-only until soak |
| `FilesPage` | Unmounted from window manager; file retained for soak |

## Honesty

- No false-live Google claim; see `aiva-document-vault-live-google-runbook.md`
- Live Telegram delivery remains credential-gated MANUAL

## Rollback

```bash
DOCUMENT_VAULT_V1_ENABLED=0
DOCUMENT_VAULT_COMPAT_ADAPTERS=1
DOCUMENT_VAULT_RETIRE_LEGACY_STORES=0
```

## Live ship (filled at deploy)

- Core revision:
- Cloud revision:
- `https://carinaai.uk/` HTTP:
- `https://core.carinaai.uk/health`:
- `https://app.carinaai.uk/api/health`:
- Authenticated `/documents` smoke:
