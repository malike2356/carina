# Platform operations

Status of platform quality features across the Carina stack. Items marked **complete** have implementation and tests; **partial** means core behavior exists but needs production hardening or UI.

## Observability

| Feature | Status | Notes |
|---------|--------|-------|
| Gateway log collection | **complete** | `GET /api/ops/logs` merges turn log, node audit, gateway.jsonl |
| Log SSE streaming | **complete** | `GET /api/ops/logs/stream` (ops token required) |
| System events + presence | **complete** | `GET /api/ops/events` |
| Agent session overview | **complete** | `GET /api/ops/sessions` |

## Doctor and secrets

| Feature | Status | Notes |
|---------|--------|-------|
| `carina doctor --deep` | **complete** | Extra scans for logs, ACP store, ops token, extensions |
| Gateway ops token repair | **complete** | `doctor --repair` with `generate-ops-token` |
| Secrets plan apply/rollback | **complete** | `carina secrets plan create|apply|rollback` |

## ACP

| Feature | Status | Notes |
|---------|--------|-------|
| Route compliance validation | **complete** | `src/gateway/acp-compliance.ts` |
| IDE route integration tests | **complete** | `src/gateway/acp-ide.test.ts` |
| Strict provenance enforcement | **partial** | Set `CARINA_ACP_PROVENANCE=strict` |

## Tenancy and billing

| Feature | Status | Notes |
|---------|--------|-------|
| Tenant skill pack config | **complete** | `PUT /api/ops/tenant-config/:tenantId` |
| Tenant channel config | **complete** | Same endpoint; persisted under `tenant-config/` |
| Workspace usage billing | **complete** | `buildWorkspaceBillingSummary()` for team plans |
| Stripe live metering | **partial** | Credit ledger exists; payment webhooks vary by deployment |

## Mobile and nodes

| Feature | Status | Notes |
|---------|--------|-------|
| QR pairing polish | **complete** | `carina pair` shows LAN host + terminal QR |
| Phone presence | **complete** | `carina pair presence`, `GET /api/ops/phone/presence` |
| Phone file access | **complete** | Node host `file.push` / `file.pull` commands (existing) |
| Dedicated mobile app UI | **partial** | Pairing API ready; app-specific UX out of core scope |

## Dev profile isolation

| Feature | Status | Notes |
|---------|--------|-------|
| Dev profile guardrails | **complete** | `src/profiles/dev-isolation.ts`; set `CARINA_DEV_ISOLATION_STRICT=true` to fail on prod endpoints |

## Release and docs automation

| Feature | Status | Notes |
|---------|--------|-------|
| Changelog generation | **complete** | `scripts/release/generate-changelog.sh` |
| Versioning policy | **complete** | `docs/VERSIONING.md` |
| Breaking change policy | **complete** | `docs/BREAKING_CHANGES.md` |
| Homebrew formula template | **complete** | `scripts/release/homebrew/carina.rb.template` |
| npm publish helper | **complete** | `scripts/release/npm-publish.sh` |
| Channel setup guides | **complete** | `docs/gateways/channel-setup.md` |
| Migration guide | **complete** | `docs/MIGRATION.md` |

## Quick commands

```bash
# Deep health scan
carina doctor --deep --repair

# Secrets plan from audit
carina secrets plan create
carina secrets plan apply <plan-id>
carina secrets plan rollback <plan-id>

# Ops observability (Bearer CARINA_OPS_TOKEN)
curl -H "Authorization: Bearer $CARINA_OPS_TOKEN" http://localhost:<gateway-port>/api/ops/sessions
curl -H "Authorization: Bearer $CARINA_OPS_TOKEN" http://localhost:<gateway-port>/api/ops/logs?since=24h

# Release prep
./scripts/release/generate-changelog.sh
```
