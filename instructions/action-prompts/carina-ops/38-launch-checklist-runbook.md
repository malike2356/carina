# Carina Ops Sprint 7.3: Launch checklist and support runbook

## Goal

Production launch checklist, beta program guide, and internal support runbook.

## Context

- Launch targets `app.carinaai.uk` with `HOSTED_MODE=true`
- Ops stays private at `ops.carinaai.uk`
- Beta: 3 to 5 design partners

## Dependencies

- `12-tenant-isolation-tests.md`
- `26-stripe-webhook-plan-sync.md`
- `36-marketing-pricing-page.md`

## Files to create

- `instructions/strategy/CARINA_OPS_LAUNCH_RUNBOOK.md`
- `core.carinaai.uk/prompts/carina-ops-demo-seed.md` (optional seed script instructions)

## Files to modify

- `core.carinaai.uk/.env.production.example`
- `instructions/strategy/CARINA_OPS_IMPLEMENTATION_PLAN.md` (mark sprints complete checkboxes when done)

## Step-by-step

1. Write `CARINA_OPS_LAUNCH_RUNBOOK.md` sections:

**Pre-launch technical**

- [ ] `pnpm test` green in core and ops
- [ ] `hosted-isolation.test.ts` passes on staging
- [ ] Stripe live price IDs in production env
- [ ] `CARINA_OPS_PRODUCT_ENABLED=true`
- [ ] `ops.carinaai.uk` not in marketing CTAs
- [ ] TLS valid on app.carinaai.uk

**Stripe**

- [ ] Products: Carina Ops Starter, Carina Ops Team
- [ ] Webhook endpoint registered with signing secret
- [ ] Test checkout + cancel + renew on staging

**Support procedures**

- Manual plan override via ops tenant detail
- Account suspend: set `access_status` on hosted_users
- Impersonation: read-only, audit required
- Billing dispute: Stripe portal link, not raw card data

**Beta program**

- Recruit 3-5 partners (AI-first startups, platform teams)
- Track: time to first prompt, upgrade intent, confusion log
- Weekly feedback template (5 questions)

**Rollback**

- Set `CARINA_OPS_PRODUCT_ENABLED=false` to hide ops routes
- Hosted chat continues for free tier

2. Demo seed doc:

- SQL or CLI steps to create demo org with sample usage, audit, workbench runs for sales calls
- Do not commit real API keys

3. Update `.env.production.example` with all Carina Ops vars documented inline.

## Expected behavior

- Operator can follow runbook without reading implementation plan
- Beta checklist ready before inviting partners

## Test

Dry run on staging:

1. Register new user
2. Complete onboarding
3. Stripe test checkout
4. Run workbench
5. Export audit CSV
6. Verify ops impersonation audit row

## Exit criteria

Sprint 7 complete:

- [ ] Pricing page live
- [ ] Docs published
- [ ] Runbook approved
- [ ] 3 beta partners invited
- [ ] One-sentence pitch validated with 2 external buyers

## Post-launch (document only, do not implement)

- SSO/SCIM Enterprise tier
- Approval workflows
- Scout cross-sell from audit view
- Mobile ops screens
