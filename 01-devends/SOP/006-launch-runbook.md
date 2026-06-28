# SOP 006: Launch Runbook
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/operations/CARINA_OPS_LAUNCH_RUNBOOK.md
**Last reviewed:** 2026-06-25

---

# Aiva launch runbook

Operator guide for launching the Aiva product on **app.carinaai.uk**. The customer-facing workspace is at app.carinaai.uk; **ops.carinaai.uk** and **admin.carinaai.uk** are VERLOX internal only.

**Build status (2026-06-25):** Sprints 0-7 code shipped. This runbook covers production deploy, beta, and validation only.

## Pre-launch technical

- [ ] `pnpm test` green in `core.carinaai.uk` and `ops.carinaai.uk`
- [ ] `hosted-isolation.test.ts` passes on staging
- [ ] Stripe live price IDs in production env (NOTE: Stripe credentials not yet set on VPS - `STRIPE_SECRET_KEY` etc. still blank)
- [ ] `CARINA_OPS_PRODUCT_ENABLED=true`
- [ ] `HOSTED_MODE=true`
- [ ] `TENANT_KEY_ENCRYPTION_KEY` set (32+ byte secret)
- [ ] `ops.carinaai.uk` not linked from marketing CTAs
- [ ] TLS valid on app.carinaai.uk and admin.carinaai.uk
- [ ] Docs build includes Aiva section (`docs.carinaai.uk`) (done in repo; publish to prod)

## Aiva plan tiers

| Plan | Price | Messages/mo | Workers | Notes |
|------|-------|-------------|---------|-------|
| trial | Free | 200 | 1 | 15 days; no card required at signup |
| starter | GBP 49/mo | 2,000 | 1 | Card collected via Stripe Checkout after trial |
| team | GBP 99/mo | 10,000 | 5 | |
| business | GBP 299/mo | Unlimited | Unlimited | Aiva training, custom governance rules |

Trial warning emails: days 12, 13, 14 (08:00 UTC daily cron). Suspension via `suspendSubscription()` on day 15.

Stripe Checkout: `POST /api/aiva/billing/checkout` -> `createAivaCheckoutSession()`
Stripe webhook endpoint: `POST https://core.carinaai.uk/webhooks/stripe`

## Stripe

- [ ] Products: Aiva Starter (GBP 49/mo), Aiva Team (GBP 99/mo), Aiva Business (GBP 299/mo)
- [ ] Webhook endpoint registered at `https://core.carinaai.uk/webhooks/stripe` with signing secret
- [ ] Test checkout, cancel, and renew on staging
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` set in production (currently blank on VPS)

## Support procedures

### Manual plan override

1. Open ops panel tenant detail (`ops.carinaai.uk/tenants/:id`).
2. Subscription tab: assign plan manually (logged as `tenant.plan_override`).
3. Confirm org plan on app.carinaai.uk `/billing`.

Also visible in admin panel: `admin.carinaai.uk/customers/[id]`.

### Account suspend

1. Tenant detail, Access tab: set `access_status` to `suspended` on `hosted_users`.
2. Audit event `tenant.suspend` is written when suspended.

### Impersonation (read-only)

1. Tenant overview: **Start impersonation** (15-minute session).
2. Red banner confirms read-only mode; all POST writes blocked.
3. Audit: `tenant.impersonate_start` and `tenant.impersonate_end` in `ops_audit_log`.
4. Do not log decrypted BYOK keys. Do not pass impersonation tokens in URLs.
5. **Open customer app** opens app.carinaai.uk in a new tab without auto-login.

### Billing dispute

Direct customer to Stripe customer portal from `/billing`. Do not handle raw card data in support tickets.

## Beta program

Recruit **3 to 5 design partners** (AI-first startups, platform teams, property managers).

Track:

- Time to first Aiva message
- Upgrade intent after trial
- Confusion log (onboarding wizard drop-off, billing, BYOK errors)

### Weekly feedback template (5 questions)

1. What blocked you this week?
2. How long until your first successful Aiva interaction?
3. Would you pay Starter or Team at list price? Why?
4. What is still confusing in onboarding or billing?
5. One feature you expected but did not find?

## Built-in governance (Aiva)

Aiva includes built-in governance monitoring; no Scout subscription is required for Aiva customers. Built-in governance covers:

- Volume spike detection
- Escalation rate tracking
- Unauthorized tool detection
- Operator kill switch
- Cryptographic audit log: SHA-256 content hash per action, stored in a tamper-evident PostgreSQL audit log

Scout at labyrinthscout.com is a separate product for Carina self-hosters who want external cross-agent governance. Do not describe Scout features as Aiva plan inclusions.

## Rollback

1. Set `CARINA_OPS_PRODUCT_ENABLED=false` on app.carinaai.uk to hide `/ops/*` routes and API.
2. Hosted chat and trial tier continue for existing users.
3. Leave Stripe products active; disable webhook processing if needed.

## Staging dry run

1. Register new user on staging app host.
2. Complete onboarding wizard (worker creation, channels, training).
3. Stripe test checkout for Starter or Team.
4. Send test message via Aiva worker; confirm usage and audit entries.
5. Start ops impersonation; confirm `tenant.impersonate_start` in ops audit log.
6. End impersonation; confirm `tenant.impersonate_end`.
7. Verify trial warning email fires at day 12 simulation.

## Exit criteria (Sprint 7)

- [x] Pricing page live on carinaai.uk (in repo; deploy marketing)
- [x] Docs published under `/docs/user/aiva/` (in repo; deploy docs)
- [x] Runbook approved
- [ ] 3 beta partners invited
- [ ] One-sentence pitch validated with 2 external buyers

### One-sentence pitch (draft)

**Aiva** is your AI employee: configure it once with your business context, connect it to your channels (Telegram, WhatsApp, email), and it handles enquiries, briefings, and Q&A around the clock, while VERLOX manages the infrastructure.

## Post-launch (document only)

- SSO/SCIM Enterprise tier
- Approval workflows for Aiva actions
- Mobile admin screens for admin.carinaai.uk
- VA queue expansion
