# Carina Ops launch runbook

Operator guide for launching Carina Ops on **app.carinaai.uk**. Customer ops UI lives on the hosted app; **ops.carinaai.uk** is VERLOX internal only.

**Build status (2026-06-13):** Sprints 0-7 code shipped. This runbook covers production deploy, beta, and validation only.

## Pre-launch technical

- [ ] `pnpm test` green in `core.carinaai.uk` and `ops.carinaai.uk`
- [ ] `hosted-isolation.test.ts` passes on staging
- [ ] Stripe live price IDs in production env
- [ ] `CARINA_OPS_PRODUCT_ENABLED=true`
- [ ] `HOSTED_MODE=true`
- [ ] `TENANT_KEY_ENCRYPTION_KEY` set (32+ byte secret)
- [ ] `ops.carinaai.uk` not linked from marketing CTAs
- [ ] TLS valid on app.carinaai.uk
- [ ] Docs build includes Carina Ops section (`docs.carinaai.uk`) (done in repo; publish to prod)

## Stripe

- [ ] Products: Carina Ops Starter, Carina Ops Team
- [ ] Webhook endpoint registered with signing secret
- [ ] Test checkout, cancel, and renew on staging
- [ ] `STRIPE_PRICE_CARINA_OPS_STARTER` and `STRIPE_PRICE_CARINA_OPS_TEAM` set in production

## Support procedures

### Manual plan override

1. Open ops panel tenant detail (`ops.carinaai.uk/tenants/:id`).
2. Subscription tab: assign plan manually (logged as `tenant.plan_override`).
3. Confirm org plan on app.carinaai.uk `/ops/billing`.

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

Direct customer to Stripe customer portal from `/ops/billing`. Do not handle raw card data in support tickets.

## Beta program

Recruit **3 to 5 design partners** (AI-first startups, platform teams).

Track:

- Time to first workbench prompt
- Upgrade intent after trial
- Confusion log (wizard drop-off, billing, BYOK errors)

### Weekly feedback template (5 questions)

1. What blocked you this week?
2. How long until your first successful workbench run?
3. Would you pay Starter or Team at list price? Why?
4. What is still confusing in onboarding or billing?
5. One feature you expected but did not find?

## Rollback

1. Set `CARINA_OPS_PRODUCT_ENABLED=false` on app.carinaai.uk to hide `/ops/*` routes and API.
2. Hosted chat and free tier continue for existing users.
3. Leave Stripe products active; disable webhook processing if needed.

## Staging dry run

1. Register new user on staging app host.
2. Complete onboarding wizard (vault, workbench, usage, invite).
3. Stripe test checkout for Starter or Team.
4. Run workbench prompt; confirm usage and audit entries.
5. Export audit CSV on Team trial.
6. Start ops impersonation; confirm `tenant.impersonate_start` in ops audit log.
7. End impersonation; confirm `tenant.impersonate_end`.

## Exit criteria (Sprint 7)

- [x] Pricing page live on carinaai.uk (in repo; deploy marketing)
- [x] Docs published under `/docs/user/carina-ops/` (in repo; deploy docs)
- [x] Runbook approved (`CARINA_OPS_LAUNCH_RUNBOOK.md`)
- [ ] 3 beta partners invited
- [ ] One-sentence pitch validated with 2 external buyers

### One-sentence pitch (draft)

**Carina Ops** is the team console for Carina AI: bring your own model keys, run governed test prompts, audit every action, and control token spend, without giving up your provider accounts.

## Post-launch (document only)

- SSO/SCIM Enterprise tier
- Approval workflows
- Scout cross-sell from audit view
- Mobile ops screens
