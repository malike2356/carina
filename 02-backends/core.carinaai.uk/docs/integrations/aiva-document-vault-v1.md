# Aiva Document Vault v1

**Status:** 707-711 complete through Google Drive OAuth/sync. Agent tools are 712.

## Authority

`shared/workspace-governance/AIVA-KEPRIX-DOCUMENT-VAULT.md`

## Contract pack

`contracts/aiva-document-vault.v1/` including `format-capability-matrix.json`

## Canonical service (core)

`src/document-vault/`

- Tree CRUD, revisions, trash, quotas, migration (708)
- Format engines (709): capability matrix, sniff/sanitize, import/export, deterministic PDF artifacts, conversion jobs
- Storage adapters reject arbitrary host paths
- Workspace Google OAuth base scopes use `drive.file` only; full `drive` is incremental (711)

## Cloud explorer + Drive sync (710-711)

`03-frontends/client-apps/app.carinaai.uk`

- Postgres `document_vault_*` including `0007_document-vault-google.sql` (connections, notifications, conflict fields)
- Store: `src/lib/document-vault/pg-store.ts`
- Google: `src/lib/document-vault/google/` (scopes, drive-api, reconcile, watch, encrypted grants)
- APIs: `/api/vault/items`, `/api/vault/google/connection`, `/api/vault/google/oauth/callback`, `/api/vault/google/sync`, `/api/vault/google/webhook`, `/api/vault/google/conflicts/[id]/resolve`
- UI: explorer + Drive panel (mode consent, connect, reconcile, renew watch, disconnect, keep-local / keep-Google)
- Webhook is wakeup-only; opaque HMAC channel token; Shared Drives disabled

## Tests

```bash
cd 02-backends/core.carinaai.uk
pnpm exec vitest run src/document-vault/ src/integrations/google-workspace-oauth.test.ts

cd 03-frontends/client-apps/app.carinaai.uk
pnpm exec vitest run src/lib/document-vault/
```

## Next

712 Aiva vault tools, policy, and approvals.
