# Propreneur v3 Environment and E2E Checklist

**Status:** automated CI smoke green; staging Paths A-E awaiting ops run  
**Last checklist edit:** 2026-07-11  
**Scope:** Kernel pilot (prompts 01-19). Path F is placeholder until prompt 30.

Shorter build prompt: [prompts/20-e2e-env-checklist.md](./prompts/20-e2e-env-checklist.md).  
App copy: `propreneur/propreneur-v3/docs/V3-ENV-CHECKLIST.md`.

---

## Architecture reminder

```
Browser / Remote API / Hub / Channels
        |
   Laravel (property OS + Tool Bridge + JWT)
        | internal Docker network only
   Carina sidecar :4500 (kernel + property-uk pack)
        |
   Tool Bridge POST /api/internal/carina/tools/{name}
```

- Sidecar URL is internal only (`http://carina:4500`). Never expose to the public internet.
- Laravel and sidecar share `CARINA_INTERNAL_JWT_SECRET`.
- User-facing copy: "powered by Carina", "secured by Scout". Do not say "sidecar" in UI.

---

## Environment variables

### Laravel (`propreneur-v3/.env`)

Documented in `.env.example` under "Propreneur v3 / Carina platform runtime". Critical keys:

| Variable | Purpose |
|----------|---------|
| `CARINA_AGENT_RUNTIME` | `kernel` (default) or `php` rollback |
| `CARINA_SIDECAR_ENABLED` | Probe + kernel path |
| `CARINA_SIDECAR_URL` | `http://carina:4500` |
| `CARINA_SIDECAR_TIMEOUT` | Seconds (default 120) |
| `CARINA_INTERNAL_JWT_SECRET` | Must match sidecar |
| `CARINA_FALLBACK_PHP_WHEN_SIDECAR_DOWN` | PHP loop when sidecar unhealthy |
| `CARINA_HUB_WEBHOOK_SECRET` | Hub HMAC |
| `SKILLS_HUB_URL` / `CARINA_HUB_PACKS` | Skills sync |
| `CARINA_SCOUT_REQUIRED_FOR_KERNEL` | Gate on `carina:enable-kernel-runtime` |

### Sidecar (`apps/carina/.env`)

| Variable | Purpose |
|----------|---------|
| `CARINA_INTERNAL_JWT_SECRET` | Same as Laravel |
| `ACTIVE_SKILL_PACKS` | e.g. `property-uk,propreneur-workspace` |
| `PROPRENEUR_TOOL_BRIDGE_URL` | `http://propreneur-fpm/api/internal/carina/tools` |
| `DEEPSEEK_API_KEY` (or other) | At least one LLM key for E2E |
| `LABYRINTH_ENABLED` | `false` OK for Phase 5 local; `true` on BE staging Scout path |

Generate JWT: `openssl rand -hex 32`.

---

## Pre-flight (staging)

```bash
cd propreneur-v3
docker compose up -d carina propreneur-fpm postgres redis
docker compose ps
# From host (if port published) or exec into FPM:
curl -s http://carina:4500/health | jq .

php artisan carina:enable-kernel-runtime xelox --dry-run
php artisan carina:enable-kernel-runtime xelox
php artisan carina:sync-sidecar-skills
```

---

## Dated test run log

| Field | Value |
|-------|-------|
| Date | 2026-07-11 |
| Operator | _local CI / agent_ |
| Environment | local Pest (Http::fake) + checklist authored |
| Staging URL | _pending ops_ |
| Pilot tenant | xelox |

| Path | Status | Notes |
|------|--------|-------|
| A In-app kernel | PENDING staging | Covered by `CarinaInAppSidecarTest` + enable commands |
| B Remote API | PENDING staging | Covered by `CarinaRemoteSidecarTest` |
| C Hub inbound | PENDING staging | Covered by `CarinaHubSidecarTest`; curl in Path C |
| D Confirmation | PENDING staging | Covered by `CarinaSidecarConfirmationTest` |
| E Degradation | PENDING staging | Covered by `CarinaGracefulDegradationTest` + `CarinaE2EHealthTest` |
| F Full modules | NOT RUN until prompt 28/30 | See Path F below |

Automated subset: `php artisan test tests/Feature/Carina/CarinaE2EHealthTest.php`: PASS 2026-07-11 (6 tests).

---

## Path A: In-app chat (kernel)

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| A1 | Log in to `https://xelox.{staging-domain}/login` | 200 | _ |
| A2 | Open floating Carina widget | Loads; no JS errors | _ |
| A3 | Send compliance expiry summary question | Reply references data | _ |
| A4 | Check `carina_messages` | User + assistant rows | _ |
| A5 | Audit / logs | `runtime=kernel`; tool bridge call | _ |
| A6 | Sidecar turn log | property-uk / compliance skill | _ |

Enable:

```bash
php artisan carina:enable-kernel-runtime xelox
```

---

## Path B: Remote API / Aiva federation

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| B1 | Bind workspace in app.carinaai.uk | Slug + API key active | _ |
| B2 | Standalone: "Use Propreneur to list my open deals." | Remote tool invocation | _ |
| B3 | Network | `POST .../api/remote/carina/chat` | _ |
| B4 | Session key | Prefix `carina_standalone_*` | _ |
| B5 | Runtime | Sidecar when tenant is kernel | _ |

---

## Path C: Hub inbound (signed webhook)

Pre-conditions: `carina_hub` channel mapping; `CARINA_HUB_WEBHOOK_SECRET` matches core.

```bash
TENANT_SLUG=xelox
SECRET="$CARINA_HUB_WEBHOOK_SECRET"
BODY='{"message":"What properties do I have?","external_id":"hub_user_test","session_id":"hub_v3_001","callback_url":"https://core.carinaai.uk/api/inbound/propreneur-reply"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -sS -X POST "https://${TENANT_SLUG}.propreneur.uk/api/remote/inbound/carina-hub" \
  -H "Content-Type: application/json" \
  -H "X-Carina-Hub-Signature: $SIG" \
  -d "$BODY"
```

| Expected | Failure mode | Result |
|----------|--------------|--------|
| 200 with ack/reply | 401 if signature wrong | _ |
| Host `{slug}.propreneur.uk` | 404 on bare central domain | _ |
| Callback to core | Check core inbound logs | _ |

Local:

```bash
curl -sS -X POST "https://xelox.propreneur.test:8000/api/remote/inbound/carina-hub" \
  -H "Content-Type: application/json" \
  -H "X-Carina-Hub-Signature: $SIG" \
  -d "$BODY"
```

---

## Path D: Write tool + confirmation gate

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| D1 | "Generate a deal pack for [known deal]." | Agent proposes action | _ |
| D2 | UI confirmation | Modal; no vault file yet | _ |
| D3 | Approve | Document in vault | _ |
| D4 | Reject / timeout | No document; pending cleared | _ |

---

## Path E: Sidecar degradation

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| E1 | `docker compose stop carina` | Sidecar down | _ |
| E2 | In-app chat | Degraded message OR PHP fallback | _ |
| E3 | HTTP status | Never 500 on chat | _ |
| E4 | Audit | `carina_runtime_fallback` or degraded event | _ |
| E5 | `docker compose start carina` | Kernel resumes | _ |

---

## Path F: Placeholder (prompt 30)

NOT RUN until prompt 28 complete:

- One critical journey per shipped module
- Platform Carina on kernel
- All remote channel adapters
- Mobile API drift gate
- Golden prompt subset (32)

---

## Smoke curls

```bash
# Platform login
curl -sk -o /dev/null -w "%{http_code}\n" https://propreneur.uk/platform/login
# Expect: 200

# Tenant Carina health
curl -sk "https://xelox.propreneur.uk/api/health/carina" | jq .
# Expect: sidecar healthy / runtime field

# Hub packs API
curl -sk https://hub.carinaai.uk/api/packs | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('packs',[])), 'packs')"
# Expect: 23+ packs

# Inbound auth sanity (empty body on tenant host)
curl -sk -o /dev/null -w "%{http_code}\n" -X POST "https://xelox.propreneur.uk/api/remote/inbound/telegram"
# Expect: 401, not 404
```

---

## Automated tests (CI)

```bash
cd propreneur-v3
php artisan test tests/Feature/Carina/CarinaE2EHealthTest.php
php artisan test --filter=CarinaSidecar
php artisan test --filter=CarinaInAppSidecar
php artisan test tests/Feature/Carina/Remote/
php artisan test --filter=CarinaGracefulDegradation
```

---

## Rollback

```bash
php artisan carina:rollback-kernel-runtime {slug} --reason="e2e failure"
# or global: CARINA_AGENT_RUNTIME=php && php artisan config:cache
```

No database rollback. See `docs/V3-RUNTIME-ROLLBACK.md` and `docs/V3-TENANT-MIGRATION.md`.

---

## Blockers

| ID | Severity | Notes |
|----|----------|-------|
| _none logged_ | | File GitHub issues for P0 sidecar/bridge/chat failures before production pilot |
