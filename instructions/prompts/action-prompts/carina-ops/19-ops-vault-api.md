# Carina Ops Sprint 4.3: BYOK vault API (customer)

## Goal

Customer CRUD for provider keys at `/api/carina-ops/vault` with encryption, RBAC, and audit.

## Context

- Encryption: `src/brain/tenant-provider-keys.ts`
- Ops panel BYOK already exists (`feature-byok-ops-ui.md`); customer API is separate path
- Never return decrypted keys in JSON

## Dependencies

- `09-scope-billing-byok-queries.md`
- `10-product-audit-log.md`
- `15-carina-ops-api-router.md`

## Files to create

- `core.carinaai.uk/src/hosted/vault-service.ts`
- `core.carinaai.uk/src/hosted/vault-service.test.ts`

## Files to modify

- `core.carinaai.uk/src/api/carina-ops-routes.ts`
- `core.carinaai.uk/src/gateway/web/ops/vault.html`

## Step-by-step

1. `vault-service.ts`:

```typescript
export async function listVaultEntries(orgId: string): Promise<VaultEntrySummary[]>;
export async function addVaultEntry(orgId: string, input: AddVaultInput, actorUserId: string): Promise<void>;
export async function removeVaultEntry(orgId: string, provider: string, actorUserId: string): Promise<void>;
export async function toggleVaultEntry(orgId: string, provider: string, enabled: boolean, actorUserId: string): Promise<void>;
```

`VaultEntrySummary`: `{ provider, enabled, hasCustomBaseUrl, hasCustomModel, lastRotatedAt }` only.

2. Enforce `plan-gates` max BYOK providers on add.

3. Routes:

| Method | Path | RBAC |
|--------|------|------|
| GET | `/vault` | vault.read |
| POST | `/vault` | vault.write |
| DELETE | `/vault/:provider` | vault.write |
| PATCH | `/vault/:provider` | vault.write (enabled toggle) |

4. Audit: `vault.key_added`, `vault.key_removed`, `vault.key_toggled`.

5. `vault.html`: list cards, add form (provider select, api key password input), remove button.

## Expected behavior

- POST stores encrypted key; GET never includes key material
- Starter org blocked after 3 providers
- Viewer gets 403 on POST

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/vault-service.test.ts
```

Include isolation case from prompt 12 regression.
