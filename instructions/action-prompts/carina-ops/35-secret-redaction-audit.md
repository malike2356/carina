# Carina Ops Sprint 6.6: Secret redaction audit

## Goal

Verify and harden redaction so secrets never appear in audit logs, workbench history, or API responses.

## Context

- Redaction stub in `product-audit.ts` prompt 10
- Vault and workbench are highest risk surfaces

## Dependencies

- `10-product-audit-log.md`
- `19-ops-vault-api.md`

## Files to create

- `core.carinaai.uk/src/hosted/redact.ts`
- `core.carinaai.uk/src/hosted/redact.test.ts`

## Files to modify

- `core.carinaai.uk/src/hosted/product-audit.ts`
- `core.carinaai.uk/src/hosted/workbench-service.ts`
- `core.carinaai.uk/src/hosted/vault-service.ts`
- `core.carinaai.uk/src/api/carina-ops-routes.ts` (response serializer)

## Step-by-step

1. Central `redactSecrets(obj: unknown): unknown`:

- Deep walk objects and arrays
- Replace values where key matches `/api[_-]?key|secret|password|token|authorization/i`
- Replace `sk-...` and `carina_...` patterns in string values

2. Apply `redactSecrets` in:

- `writeProductAudit` before insert
- Workbench run API response if including metadata
- Error handler JSON responses

3. Add regression tests with payloads containing:

```json
{ "apiKey": "sk-test", "nested": { "openai_api_key": "sk-abc" }, "prompt": "my key is sk-leaked" }
```

4. Scan existing handlers for `res.json` that pass through user input unchanged.

5. Document in `src/hosted/redact.ts` header: run `pnpm test src/hosted/redact.test.ts` before any audit-related PR.

## Expected behavior

- Audit details never contain `sk-` sequences
- Vault GET never returns key material (already); audit add events show `provider` only

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/redact.test.ts
```

Add CI grep check optional: fail if `encrypted_api_key` appears in test API response fixtures.

## Exit criteria

Sprint 6 complete: stranger completes onboarding without manual ops steps.
