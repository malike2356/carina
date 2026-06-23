# Carina Security Hardening Checklist

Living checklist for reducing Carina's cyber risk without pretending code can solve configuration, identity, or operator discipline.

**Last updated:** 2026-06-10  
**Current posture:** Scout trust layer is live, identity is registered, and on-chain verification has been submitted. The platform is still an LLM agent with tool access, so hardening remains ongoing.

## Configuration guide

For the remaining operator steps (alerts, CORS, webhooks, rotation, logbook), see **`instructions/SECURITY_CONFIGURATION_GUIDE.md`**.

Quick commands:

```bash
bash scripts/verify-security-config.sh vps
SCOUT_ALERT_TO_EMAIL=ops@yourdomain.com bash scripts/complete-production-security.sh vps
bash scripts/post-deploy-security-check.sh vps
```

## How to use this file

1. Work top to bottom.
2. Mark an item complete only when it is deployed and verified in the live environment.
3. Use `[~]` if a code path exists but still depends on credentials, wallet funding, or another external control.
4. Keep code fixes, config fixes, and operator actions separate.
5. Do not count a security control as complete just because the source exists.

**Status key:** `[x]` done | `[~]` partial / config pending | `[ ]` not started | `[;]` deferred

---

## 1) Core attack surface

These are the highest-value controls because they reduce the chance that a single bad prompt or tool call becomes a compromise.

- [x] Prompt injection filter in Carina (`PromptGuard` + middleware)
- [x] Scout-side Type 3 detection and incident classification
- [x] Honeypot / decoy credential detection
- [x] Moving-target marker rotation and stale-marker replay detection
- [x] Outbound egress allowlisting and sensitive-data scan before requests leave the agent
- [x] Kill switch / suspend / resume control path
- [x] Forensic snapshot capture before containment

## 2) Tool access control

Limit what the agent can do even when the model is compromised or confused.

- [x] Keep dangerous tools behind explicit registration and policy checks
- [x] Maintain allowlist-based outbound URL enforcement
- [x] Keep file honeypots separate from real secrets and scan for accesses
- [x] Audit every tool that can write, send, delete, deploy, or trigger external side effects (`tool-risk-registry.ts` + `carina tools audit`)
- [x] Reduce tool scope for default installs so least privilege is the default (no `toolsets.yaml` = preset, not all tools)
- [x] Add regression tests for every tool that can leak secrets or escalate privilege (`tool-security-regression.test.ts`, `tool-policy-matrix.test.ts`)

## 3) Identity and trust

This is about proof, not prevention. It matters, but it does not stop a compromise on its own.

- [x] Public trust dashboard exists and polls live Scout state
- [x] ERC-8004 identity registration path implemented
- [x] ERC-8126 verification path implemented
- [x] On-chain attestation adapter implemented
- [x] Live identity registered on Base Sepolia
- [x] Live verification submitted on Base Sepolia
- [x] Keep trust labels honest when chain or wallet config is missing (`wallet_configured`, force `planned` without wallet)
- [x] Add alerting for failed trust submissions or stale trust data (`trust_attestation_failed`, `trust_verification_failed` events)
- [x] Document the exact operator steps for re-running trust registration after wallet rotation (`docs/user/security/trust-wallet-rotation.md`)

## 4) Secrets and configuration

These are not code problems if the environment is empty or wrong, but they are still security-critical.

- [x] `TRUST_ATTESTER_PRIVATE_KEY` stored in the Scout VPS `.env`
- [x] Scout `.env` loaded at runtime
- [x] Fund the attester wallet from a trusted faucet or exchange source (VPS wallet funded; re-check with `setup-trust.sh`)
- [~] Rotate `SCOUT_API_KEY` and `SCOUT_SESSION_SECRET` on a schedule (`scripts/rotate-scout-secrets.sh`; run quarterly)
- [~] Audit all channel credentials before enabling them in production (checklist in `SECURITY_CONFIGURATION_GUIDE.md`)
- [x] Keep `LABYRINTH_ENABLED` off unless Scout is actually reachable and configured (`carina doctor` + `carina security audit` fail when enabled but misconfigured)
- [~] Keep production secrets out of the repo and deploy artifacts (deploy rsync excludes `.env`; operator discipline + `.env.bak-*` gitignore)

## 5) Monitoring and incident response

Security posture is only real if incidents are visible and actionable.

- [x] Live risk score exposed in public trust API
- [x] Security event ingestion from Carina into Scout
- [x] Incident timeline API
- [x] Compliance report export
- [x] Public trust verification endpoint
- [x] Add alerting for `risk_score` spikes and repeated injection blocks (`risk_score_spike`, `repeated_injection_blocks`; never throttled)
- [~] Add alerting for honeypot triggers and stale marker detections (never throttled/deduped; configure `SCOUT_ALERT_TO_EMAIL` + `RESEND_API_KEY`)
- [x] Add a clear operator runbook for "blocked prompt / suspected compromise / kill switch fired" (`docs/user/security/incident-response.md`)
- [x] Define an SLA for reviewing critical or breach events (`instructions/SECURITY_INCIDENT_SLA.md`)

## 6) Network and runtime hardening

These controls reduce blast radius if the runtime or model goes sideways.

- [x] Scout egress filter
- [x] Rate limits and request policy hooks
- [x] Web chat requires authenticated access where configured
- [x] Verify every exposed HTTP endpoint has an explicit auth model (`auth-surface.test.ts` + readiness endpoint)
- [x] Review CORS and proxy settings for production-only looseness (`SCOUT_CORS_ORIGIN`, Carina audit fails on `*` in production)
- [x] Confirm webhook receivers reject unsigned or unauthenticated calls (Resend Svix, channel adapters reject unsigned in production)
- [x] Keep public trust endpoints read-only (GET-only middleware on `/api/public/trust`)

## 7) Operational hardening

This is the part that keeps a secure design from degrading over time.

- [x] `doctor` command exists for Scout readiness checks
- [x] Trust setup script exists for VPS bootstrap
- [x] Public trust API and dashboard verified live
- [x] Run `doctor` after every deploy that touches trust or security code (`scripts/post-deploy-security-check.sh`; wired into deploy scripts)
- [~] Re-run trust bootstrap after any env rotation or wallet change (`setup-trust.sh`; run after rotation)
- [~] Keep a dated record of wallet funding, register, attest, and verify actions (`operator-trust-log.template.md`; private copy)
- [ ] Review logs for unexpected stream hangs, tool retries, or repeated guard hits

## 8) What is secure enough vs what is not

**Secure enough today**
- The platform has meaningful layered defenses.
- The trust layer is real and live.
- Scout can detect and surface several attack classes.

**Not secure enough to assume**
- That an LLM will never misuse a tool.
- That on-chain trust prevents runtime compromise.
- That enabled credentials are automatically safe.
- That a feature being implemented means it is safe in production.

## 9) Next hardening work

- [x] Inventory every tool by risk class: read, write, execute, external side effect, credential access (`src/tools/tool-risk-registry.ts`)
- [x] Make the default tool set smaller for new installs (applies even without `toolsets.yaml`)
- [x] Add explicit per-tool policy tests (CI fails on unclassified tools or missing `dangerous` flags)
- [x] Add a trust-data freshness check on the public dashboard (`data_freshness.stale`)
- [x] Add a single operator page that shows what is configured, what is pending, and what is blocked (`GET /api/readiness`)
- [x] Write an incident drill for prompt injection + honeypot leak + kill switch in one sequence (`docs/user/security/incident-drill.md`)
