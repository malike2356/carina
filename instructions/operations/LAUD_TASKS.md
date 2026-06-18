# Laud's Task List -- Config & Operator Actions

**Date:** 14 June 2026
**Scope:** Every task across the VERLOX/Carina ecosystem that requires Laud (not code, not AI agents) to complete.

---

## SCOUT / TRUST (highest impact)

| # | Task | Source | Type |
|---|------|--------|------|
| 1 | Run `pnpm trust:attest` for first weekly labyrinth-scout.v1 attestation post on Base Sepolia (or wait for 30-day clean runtime window and let scheduler fire) | TRUST_BUILD_CHECKLIST.md C.2 | Operator |
| 2 | Run `pnpm trust:register:mainnet` for Base mainnet ERC-8004 registration | TRUST_BUILD_CHECKLIST.md C.1 | Operator |
| 3 | Set `SCOUT_ALERT_TO_EMAIL` + `RESEND_API_KEY` in Scout .env on VPS to activate alert delivery | SECURITY_HARDENING_CHECKLIST.md | Config |
| 4 | Set Scout channel credentials in production .env: Telegram bot token/chat ID, Slack webhook, Discord webhook, SMS credentials | CONFIGURATION_READINESS.md | Config |
| 5 | Keep dated operator trust log of wallet funding, register, attest, verify actions (use operator-trust-log.template.md) | SECURITY_HARDENING_CHECKLIST.md | Operator |
| 6 | Review production logs for unexpected stream hangs, tool retries, or repeated guard hits | SECURITY_HARDENING_CHECKLIST.md | Operator |

---

## CARINA OPS / SAAS (revenue-critical)

| # | Task | Source | Type |
|---|------|--------|------|
| 7 | Create live Stripe price IDs for carina_ops_starter (£19/mo) and carina_ops_team (£49/mo). Set `STRIPE_PRICE_CARINA_OPS_STARTER` and `STRIPE_PRICE_CARINA_OPS_TEAM` in production .env | GAP_ANALYSIS.md | Config |
| 8 | Configure Stripe Customer Portal URL in production .env | GAP_ANALYSIS.md | Config |
| 9 | Set `HOSTED_MODE=true` and `CARINA_OPS_PRODUCT_ENABLED=true` on production app.carinaai.uk | CARINA_OPS_IMPLEMENTATION_PLAN.md | Config |
| 10 | Set `TENANT_KEY_ENCRYPTION_KEY` in production .env | CARINA_OPS_IMPLEMENTATION_PLAN.md | Config |
| 11 | Recruit 3 to 5 design partners (AI-first startups, platform teams) for Carina Ops beta | CARINA_OPS_IMPLEMENTATION_PLAN.md | Business |
| 12 | Write privacy policy and terms of service mentioning org data boundaries | CARINA_OPS_IMPLEMENTATION_PLAN.md | Legal |
| 13 | Verify hosted mode tenant sign-up flow on app.carinaai.uk works end-to-end | GAP_ANALYSIS.md | Operator |

---

## ENTERPRISE / BUSINESS

| # | Task | Source | Type |
|---|------|--------|------|
| 14 | Identify 5 target enterprises for Scout pilot (regulated: finance, legal, healthcare, property) | TRUST_BUILD_CHECKLIST.md G | Business |
| 15 | Secure first free pilot with security log collection | TRUST_BUILD_CHECKLIST.md G | Business |
| 16 | Convert pilot to £2,500-5,000/mo paid (Scout + attestations) | TRUST_BUILD_CHECKLIST.md D | Business |
| 17 | One paying enterprise pilot OR signed LOI for Carina + Scout bundle | TRUST_BUILD_CHECKLIST.md B | Business |
| 18 | Track metrics: support tickets per agent, Scout alerts per 1000 actions, CAC, MRR | TRUST_BUILD_CHECKLIST.md G | Business |

---

## MARKETING / PUBLIC

| # | Task | Source | Type |
|---|------|--------|------|
| 19 | Update carinaai.uk pricing page with Ops tier details (£19 Starter, £49 Team) | GAP_ANALYSIS.md | Content |
| 20 | Verify docs site (docs.carinaai.uk) is deployed with getting-started guide | GAP_ANALYSIS.md | Operator |
| 21 | Verify public copy does not overstate unsupported features -- audit carinaai.uk and labyrinthscout.com | CONFIGURATION_READINESS.md | Content |
| 22 | Register domain and configure DNS for install.carinaai.uk (for curl installer) | CONFIGURATION_READINESS.md | Config |

---

## INFRASTRUCTURE / SECURITY

| # | Task | Source | Type |
|---|------|--------|------|
| 23 | Run `bash scripts/verify-security-config.sh vps` on production VPS | SECURITY_HARDENING_CHECKLIST.md | Operator |
| 24 | Re-run trust bootstrap after any env rotation or wallet change (`setup-trust.sh`) | SECURITY_HARDENING_CHECKLIST.md | Operator |
| 25 | Keep production secrets out of repo; ensure .env is in .gitignore and rsync excludes .env | SECURITY_HARDENING_CHECKLIST.md | Discipline |
| 26 | Apply Cloudflare rate limiting rules, bot fight mode, and OWASP ruleset across all domains (currently zero L7 protection) | Memory | Config |

---

## NHS / COMPASS

| # | Task | Source | Type |
|---|------|--------|------|
| 27 | Interview 5 healthtech founders about their DCB0129 compliance pain (validation before building) | NHS/strategy/01-dcb0129-compliance-copilot.md | Business |
| 28 | Speak with 1-2 clinical safety consultants about pricing, process, and willingness to use AI tool | NHS/strategy/01-dcb0129-compliance-copilot.md | Business |
| 29 | Consult NHS digital health lawyer re: AI-generated compliance docs, liability, ToS | NHS/strategy/01-dcb0129-compliance-copilot.md | Legal |
| 30 | Register domain for COMPASS (compliancelab.uk or compass.verlox.uk) | NHS/SCOPE.md | Config |

---

## PUBLISHING / DISTRIBUTION

| # | Task | Source | Type |
|---|------|--------|------|
| 31 | Publish @carina/core@0.2.0 to npm (hand Cursor the prompt at prompts/publish-carina-core.md) | carina/prompts/publish-carina-core.md | Delegate |
| 32 | Verify clean npm install on fresh machine: `npm install -g carina-agent && carina --version` | RELEASE_CHECKLIST.md | Operator |
| 33 | Git tag and GitHub release notes for next version | RELEASE_CHECKLIST.md | Operator |

---

## Summary By Type

| Type | Count |
|------|-------|
| **Config (set env vars, create Stripe IDs, DNS)** | 12 |
| **Operator (run scripts, verify, review logs)** | 9 |
| **Business (recruit, interview, pilot, sell)** | 8 |
| **Legal (privacy policy, terms, lawyer consult)** | 3 |
| **Content (pricing page, docs, copy audit)** | 3 |

**Total: 33 tasks that only Laud can do.**

---

## The Top 5 That Unlock Revenue

1. Create live Stripe price IDs (unlocks Carina Ops billing)
2. Set alert channel credentials (unlocks Scout premium value)
3. Recruit 3-5 design partners (validates Carina Ops)
4. Interview 5 healthtech founders (validates COMPASS before building)
5. Publish @carina/core to npm (unlocks the kernel story)
