# SOP 017: Security Hardening Checklist
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/security/SECURITY_HARDENING_CHECKLIST.md
**Last reviewed:** 2026-06-25

---

# Carina Security Hardening Checklist

Living checklist for reducing Carina's cyber risk without pretending code can solve configuration, identity, or operator discipline.

**Last updated:** 2026-06-25
**Current posture:** Aiva built-in governance is live (volume spike detection, escalation tracking, unauthorized tool detection, operator kill switch, cryptographic audit log). Scout integration is optional and must be configured separately. The platform is still an LLM agent with tool access, so hardening remains ongoing.

## Configuration guide

For the remaining operator steps (alerts, CORS, webhooks, rotation, logbook), see **`SOP/016-security-configuration.md`**.

Quick commands:

```bash
bash scripts/verify-security-config.sh vps
SCOUT_ALERT_TO_EMAIL=ops@yourdomain.com bash scripts/complete-production-security.sh vps
bash scripts/post-deploy-security-check.sh vps
```

## How to use this file

1. Work top to bottom.
2. Mark an item complete only when it is deployed and verified in the live environment.
3. Use `[~]` if a code path exists but still depends on credentials or another external control.
4. Keep code fixes, config fixes, and operator actions separate.
5. Do not count a security control as complete just because the source exists.

**Status key:** `[x]` done | `[~]` partial / config pending | `[ ]` not started | `[;]` deferred

---

## 1) Core attack surface

These are the highest-value controls because they reduce the chance that a single bad prompt or tool call becomes a compromise.

- [x] Prompt injection filter in Carina (`PromptGuard` + middleware)
- [x] Scout-side Type 3 detection and incident classification (when Scout is connected)
- [x] Honeypot / decoy credential detection
- [x] Moving-target marker rotation and stale-marker replay detection
- [x] Outbound egress allowlisting and sensitive-data scan before requests leave the agent
- [x] Kill switch / suspend / resume control path (built into Aiva governance and Scout)
- [x] Forensic snapshot capture before containment

## 2) Tool access control

Limit what the agent can do even when the model is compromised or confused.

- [x] Keep dangerous tools behind explicit registration and policy checks
- [x] Maintain allowlist-based outbound URL enforcement
- [x] Keep file honeypots separate from real secrets and scan for accesses
- [x] Audit every tool that can write, send, delete, deploy, or trigger external side effects (`tool-risk-registry.ts` + `carina tools audit`)
- [x] Reduce tool scope for default installs so least privilege is the default (no `toolsets.yaml` = preset, not all tools)
- [x] Add regression tests for every tool that can leak secrets or escalate privilege (`tool-security-regression.test.ts`, `tool-policy-matrix.test.ts`)

## 3) Identity and audit

This section covers audit integrity. Carina uses a cryptographic audit log in PostgreSQL, not a blockchain. Each agent action is stored with a SHA-256 content hash in a tamper-evident audit log table. No on-chain wallet or external ledger is involved.

- [x] Cryptographic audit log active: SHA-256 content hash per action, stored in PostgreSQL
- [x] Audit log visible in `admin.carinaai.uk/fleet/attestation`
- [x] `runMigrations()` in `src/memory/migrations.ts` creates audit tables on startup
- [x] Audit log is append-only; no customer data leaves VERLOX infrastructure
- [x] Alert events for failed trust submissions or stale audit data

## 4) Secrets and configuration

These are not code problems if the environment is empty or wrong, but they are still security-critical.

- [x] Scout `.env` loaded at runtime (when Scout is deployed)
- [~] Rotate `SCOUT_API_KEY` and `SCOUT_SESSION_SECRET` on a schedule (`scripts/rotate-scout-secrets.sh`; run quarterly)
- [~] Audit all channel credentials before enabling them in production (checklist in `SOP/016-security-configuration.md`)
- [x] Keep `LABYRINTH_ENABLED` off unless Scout is actually reachable and configured (`carina doctor` + `carina security audit` fail when enabled but misconfigured)
- [~] Keep production secrets out of the repo and deploy artifacts (deploy rsync excludes `.env`; operator discipline + `.env.bak-*` gitignore)
- [ ] Stripe credentials (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) must be set on VPS before billing goes live (currently blank)

Docker container names for reference when checking credentials:
- `carina-web` (core API)
- `carina-cloud` (app.carinaai.uk, port 4100)
- `carina-admin` (admin.carinaai.uk, port 4200)
- `carina-ops` (ops.carinaai.uk, port 4001)
- `carina-hub` (hub.carinaai.uk, port 3001)
- `labyrinth-scout` (console.labyrinthscout.com, port 4444)

## 5) Monitoring and incident response

Security posture is only real if incidents are visible and actionable.

- [x] Built-in governance monitoring in Aiva: volume spike detection, escalation rate tracking, unauthorized tool detection
- [x] Operator kill switch accessible from ops.carinaai.uk
- [x] Security event ingestion from Carina into Scout (when `LABYRINTH_ENABLED=true`)
- [x] Incident timeline API
- [x] Compliance report export
- [x] Alert for risk score spikes and repeated injection blocks
- [~] Configure `SCOUT_ALERT_TO_EMAIL` + `RESEND_API_KEY` for honeypot and stale marker alerts
- [x] Operator runbook for "blocked prompt / suspected compromise / kill switch fired" (`docs/user/security/incident-response.md`)
- [x] SLA defined for reviewing critical or breach events (`SOP/018-security-incident-sla.md`)

## 6) Network and runtime hardening

These controls reduce blast radius if the runtime or model goes sideways.

- [x] Scout egress filter (when Scout connected)
- [x] Rate limits and request policy hooks
- [x] Web chat requires authenticated access where configured
- [x] Verify every exposed HTTP endpoint has an explicit auth model (`auth-surface.test.ts` + readiness endpoint)
- [x] Review CORS and proxy settings for production-only looseness (`SCOUT_CORS_ORIGIN`, Carina audit fails on `*` in production)
- [x] Confirm webhook receivers reject unsigned or unauthenticated calls (Resend Svix, channel adapters reject unsigned in production)
- [x] Keep public trust endpoints read-only (GET-only middleware on `/api/public/trust`)

## 7) Operational hardening

This is the part that keeps a secure design from degrading over time.

- [x] `doctor` command exists for Scout readiness checks (when Scout deployed)
- [x] Post-deploy security check script exists (`scripts/post-deploy-security-check.sh`)
- [x] Run `doctor` after every deploy that touches security code
- [~] Re-run post-deploy checks after any env rotation
- [~] Keep a dated private record of secret rotations and security actions
- [ ] Review logs for unexpected stream hangs, tool retries, or repeated guard hits

## 8) What is secure enough vs what is not

**Secure enough today**
- The platform has meaningful layered defenses.
- Built-in governance audit trail is cryptographically sound (SHA-256 hashes in PostgreSQL).
- Scout can detect and surface several attack classes when connected.

**Not secure enough to assume**
- That an LLM will never misuse a tool.
- That the cryptographic audit log prevents runtime compromise (it detects tampering, not exploits).
- That enabled credentials are automatically safe.
- That a feature being implemented means it is safe in production.

## 9) Next hardening work

- [x] Inventory every tool by risk class: read, write, execute, external side effect, credential access (`src/tools/tool-risk-registry.ts`)
- [x] Make the default tool set smaller for new installs
- [x] Add explicit per-tool policy tests
- [x] Add a trust-data freshness check on the public dashboard
- [x] Add a single operator page that shows what is configured, what is pending, and what is blocked (`GET /api/readiness`)
- [x] Write an incident drill for prompt injection + honeypot leak + kill switch in one sequence (`docs/user/security/incident-drill.md`)
- [ ] Configure Stripe webhook secret before billing launch
- [ ] Set `SCOUT_ALERT_TO_EMAIL` in production for automated breach alerts
