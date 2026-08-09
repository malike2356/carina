# Aiva Document Vault cutover and rollback runbook (715)

## Cutover posture (defaults after 715)

```bash
DOCUMENT_VAULT_V1_ENABLED=1
DOCUMENT_VAULT_COMPAT_ADAPTERS=1
DOCUMENT_VAULT_DUAL_WRITE=0
DOCUMENT_VAULT_MIGRATE_DRY_RUN=0
DOCUMENT_VAULT_RETIRE_LEGACY_STORES=0
DOCUMENT_VAULT_CHANNEL_OPS=1
DOCUMENT_VAULT_SEARCH_OPS=1
```

Primary UX: `https://admin.hireaiva.co.uk/documents` (also `app.carinaai.uk/documents`).

## Operator cutover checklist

1. Run hermetic suite: `pnpm exec vitest run src/document-vault/`
2. Generate conformance evidence: `pnpm exec vitest run src/document-vault/programme-close.test.ts`
3. Confirm evidence file: `docs/integrations/evidence/document-vault-conformance-715.json` has `summary.green=true`
4. Cloud: open `/documents`, create folder/file, trash/restore, optional Drive connect
5. Work chat: `vault-list` / `vault-search`
6. Keep `RETIRE_LEGACY_STORES=0` through soak (legacy `/api/documents` and host sqlite remain)

## Rollback (bounded)

```bash
DOCUMENT_VAULT_V1_ENABLED=0
DOCUMENT_VAULT_COMPAT_ADAPTERS=1
DOCUMENT_VAULT_RETIRE_LEGACY_STORES=0
```

Redeploy core/cloud with those envs. Compat adapters and legacy routes stay available. Do not delete vault tables during rollback.

## Soak criteria before retirement

- No elevated dead-letter / index lag alerts for 7 days
- Migration checksum reports match inventory expectations
- Rollback drill documented once
- Owner live Google runbook completed or explicitly deferred

Only then consider `DOCUMENT_VAULT_RETIRE_LEGACY_STORES=1` in a separate change.

## Script

`scripts/document-vault-cutover.sh` prints env recipe and runs programme-close tests from core.
