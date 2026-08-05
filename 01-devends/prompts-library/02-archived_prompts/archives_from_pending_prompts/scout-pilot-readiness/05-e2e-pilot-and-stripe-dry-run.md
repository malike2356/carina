# Scout Pilot Readiness -- Prompt 05 of 05: E2E Pilot Script + Stripe Dry Run
**Status: COMPLETED 2026-07-27**

**What was built:** scripts/e2e-pilot.sh PASS locally; e2e-stripe-dry-run skip without keys; package.json scripts

# Build Phase: Validation
# Depends on: Prompts 01-04
# Blocks: Declaring SaaS pilot-ready
# Estimated time: 4-5 hours

## Context

Need one automated path proving: signup → API key → register agent → blocked injection → event visible via API → kill switch blocks further filter → (optional) Stripe test checkout updates plan.

Do not create Stripe prices. Use SoT IDs only. Never commit secret keys.

## Task

### 1. Script: `scout/scripts/e2e-pilot.sh`

Bash or Node script with env:

```bash
SCOUT_API_BASE=http://localhost:4444   # or https://console.labyrinthscout.com
SCOUT_DASH_BASE=http://localhost:3005
# optional Stripe test:
# STRIPE_SECRET_KEY=sk_test_...
```

Steps (fail fast, print clear step names):

1. `GET $SCOUT_API_BASE/health` and `/v1/health` → 200
2. `POST /api/dashboard/auth/signup` unique email → token
3. `POST /api/dashboard/api-keys` → raw `sk_live_...`
4. `POST /v1/agents/register` with Bearer key → `agent_id`
5. `POST /v1/prompts/filter` with benign prompt → `verdict=allowed` (or non-blocked)
6. `POST /v1/prompts/filter` with classic injection (`Ignore all previous instructions...`) → `verdict=blocked`
7. `POST /v1/events` batch of 1 → `accepted >= 1`
8. `GET /api/dashboard/agents` with dashboard JWT → includes agent
9. `POST /api/dashboard/killswitch/:agentId`  
   - If org is free and killswitch is plan-gated: first upgrade org plan to `govern` in DB for the test user **or** call a test-only admin helper you add under `SCOUT_E2E_ALLOW_PLAN_OVERRIDE=true`  
   - Prefer: script sets plan via SQL only when `E2E_DATABASE_URL` is set; otherwise skip kill step with explicit SKIP reason
10. After suspend: filter/events return 403 `kill_switch`
11. Exit 0 only if all required steps pass

### 2. Stripe dry-run (test mode)

Add `scout/scripts/e2e-stripe-dry-run.sh` or a flag `--stripe`:

1. With dashboard JWT, `POST /api/billing/checkout` `{ plan: "monitor", success_url, cancel_url }`
2. Assert response contains `url` starting with `https://checkout.stripe.com` when `STRIPE_SECRET_KEY` is test key
3. Webhook: document using Stripe CLI  
   `stripe listen --forward-to $SCOUT_API_BASE/webhooks/stripe`  
   and completing test checkout once manually; script verifies org `plan` became `monitor` via `GET /api/dashboard/org`

If secrets missing, script exits 0 on core path and prints `STRIPE_SKIPPED` (core path must still pass).

### 3. Package scripts

In `scout/package.json` (create workspace root if missing) or document in `scout/README.md`:

```json
{
  "scripts": {
    "e2e:pilot": "bash scripts/e2e-pilot.sh",
    "e2e:stripe": "bash scripts/e2e-stripe-dry-run.sh"
  }
}
```

### 4. CI-optional

Optional GitHub Action or note in deploy README: run e2e against compose stack. Not required for acceptance if local compose run is documented with a past successful log snippet in the prompt's "What was built" on completion.

## Acceptance Criteria

- `e2e-pilot.sh` passes against local engine+dashboard (or documented hosted staging)
- Kill-switch step proves 403 after suspend (or documented plan-gate bypass for e2e only)
- Stripe path either passes in test mode or cleanly skips without failing core
- No live `sk_live` Stripe secrets in repo
- Price IDs only from SoT
- No em dashes / en dashes / emojis

## Guidance

- Keep the script dependency-light (curl + python3/jq).
- Do not hit production Stripe live mode from e2e.
- Do not weaken kill-switch auth in production builds; any plan override must be env-gated and default off.

## Done means pilot-ready (product statement)

After this prompt:

> Supervised external pilot is allowed: hosted URLs work, client can install SDK, instrumentation runbook exists, happy path is automated, kill switch is API-enforced. Full Govern marketing parity is still out of scope.

## Post-build (MANDATORY)

1. Mark prompts 01-05 COMPLETED with What was built lists  
2. Move entire `scout-pilot-readiness/` to `02-archived_prompts/archives_from_pending_prompts/scout-pilot-readiness/`  
3. Update `01-pending_prompts/README.md`  
4. Follow POST-BUILD-CHECKLIST
