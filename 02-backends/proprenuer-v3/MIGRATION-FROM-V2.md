# Migration from Propreneur v2

What carries forward unchanged, what changes, and how tenants move to v3.

---

## Repository strategy

**Recommended:** Fork `propreneur-v2` to `propreneur-v3` at `/opt/lampp/htdocs/verlox/propreneur/propreneur-v3/`.

| Approach | Pros | Cons |
|----------|------|------|
| Fork v2 (recommended) | All modules, tests, deploy scripts intact | Must merge v2 bugfixes during transition |
| Greenfield Laravel | Clean tree | Rebuild 13 modules; unacceptable delay |
| v3 inside v2 branch | Single repo | Confusing deploy; avoid |

v2 remains production until v3 pilot tenants pass E2E checklist (prompt 20).

---

## Unchanged (copy as-is)

| Area | Notes |
|------|-------|
| Central + tenant migrations | No schema break for v3 launch |
| `database/migrations/tenant/*` | Carina conversation tables reused |
| Module routes (`routes/tenant.php`) | All module URLs |
| `app/Services/*` except agent dispatch | Business logic |
| `app/Services/Carina/Tools/*` | All 61 tools; called via bridge |
| `CarinaToolRegistry` | Source of truth for tool execution |
| Billing, stancl tenancy, Horizon | Unchanged |
| Brain/knowledge docs | Carina RAG corpus |
| Deploy host/path | Same VPS pattern; add sidecar container |

---

## Changed in v3

| v2 | v3 |
|----|-----|
| `CarinaAgentService` runs LLM loop | `CarinaSidecarGateway` delegates loop to sidecar |
| `CarinaService::agentTurn()` primary | Sidecar uses kernel LLM router |
| Skills in `compiled-skills.json` for PHP only | Sidecar manifest + optional PHP compile for fallback |
| Single LLM provider chain | 23 providers via kernel (BYOK per tenant later) |
| No Docker sidecar | `apps/carina` + compose service |
| Remote API -> PHP agent | Remote API -> gateway -> sidecar (flagged) |

---

## Deprecated (after strangler complete)

| Component | When |
|-----------|------|
| `CarinaAgentService` agent loop | Prompt 18 |
| Direct LLM calls in `CarinaService` for chat | After sidecar stable |
| `carina:compile-skills` for runtime (optional) | Hub sync to sidecar replaces for kernel path |

Keep PHP agent code for **one release** behind `CARINA_AGENT_RUNTIME=php` rollback.

---

## Database migration

**No tenant DB migration required** for kernel cutover if:

- `carina_conversations`, `carina_messages` schema unchanged
- Conversation `type` and `metadata` fields compatible

Optional central migration:

```php
// tenant_settings or tenants.data JSON
'carina_runtime' => 'kernel' | 'php'
```

Prompt 19 covers runbook.

---

## Tenant upgrade path

### Pilot (manual)

1. Set `tenant.settings.carina_runtime = kernel` on staging slug (e.g. xelox)
2. Run prompt 20 checklist
3. Monitor audit logs 14 days
4. Enable production pilot

### General availability

1. Default new tenants to `kernel`
2. Batch enable existing tenants by plan tier (Professional+ first)
3. Communicate: "Carina upgrade powered by Carina platform" (no downtime; same UI)

### Rollback

1. Set `carina_runtime = php`
2. Restart FPM; no data loss (messages already persisted by Laravel)

---

## v2 federation (Aiva bridge)

The standalone Carina bridge (`propreneur-bridge.ts`, Remote API) **continues to work** during v3 build:

- Remote API endpoint unchanged
- Gateway internally routes to sidecar when tenant flag set
- Aiva users see no difference except improved agent capabilities over time

---

## Environment variables (new in v3)

| Variable | Where | Purpose |
|----------|-------|---------|
| `CARINA_SIDECAR_URL` | Laravel | `http://carina:4500` |
| `CARINA_INTERNAL_JWT_SECRET` | Laravel + sidecar | Sign tenant context JWT |
| `CARINA_AGENT_RUNTIME` | Laravel | `php` or `kernel` |
| `ACTIVE_SKILL_PACKS` | sidecar | `property-uk,propreneur-workspace` |
| `LABYRINTH_ENABLED` | sidecar | Scout (optional) |

See prompt 20 for full checklist.

---

## Merge policy during transition

While v2 is production and v3 is developed:

1. **Bugfixes** in v2 modules: cherry-pick to v3 weekly
2. **New modules/features**: build in v3 only after fork date; backport to v2 only if critical for revenue
3. **Carina agent changes**: v3 sidecar only; v2 PHP agent frozen except security fixes

---

## Testing parity

Before retiring PHP agent, run golden set:

| Scenario | v2 baseline | v3 must match |
|----------|-------------|---------------|
| BTL calculator via chat | numeric output | same numbers |
| List compliance expiring | item count | same count |
| Generate deal pack | confirmation gate | same gate |
| Remote API session | `carina_standalone_*` prefix | same behavior |
| Cross-tenant isolation | 403 | 403 |

Store golden prompts in `propreneur-v3/tests/Fixtures/carina-golden-prompts.json`.
