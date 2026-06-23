# Carina Kernel Phase 4: Carina Cloud one-click deploy

## Goal

Productize "deploy a Carina agent in one click" hosted offering (Carina Cloud) with free tier and paid plans, building on existing hosted mode and Stripe billing.

## Context

- Strategy: `CARINA_AS_LINUX.md` Phase 4 item 11
- Existing hosted mode: `core.carinaai.uk/src/hosted/`, `src/api/hosted-auth.ts`, Stripe integration
- Carina Ops prompts: `instructions/action-prompts/carina-ops/` (especially sprints 5-7 for billing UI)
- This prompt is the **kernel-adjacent cloud wrapper** narrative; deep Ops work stays in carina-ops track
- Target analogy: MongoDB Atlas / Vercel for Carina kernel instances

## Dependencies

Carina Ops prompts `24-billing-plan-ids.md` through `29-trial-support.md` (or equivalent hosted billing in place)

## Files to create

- `docs.carinaai.uk/docs/user/carina-cloud.md`
- `carinaai.uk/cloud/index.html` (marketing landing for Carina Cloud)
- `core.carinaai.uk/src/hosted/cloud-provisioner.ts` (thin orchestration if missing)

## Files to modify

- `carinaai.uk/pricing/index.html` (add Carina Cloud tier row)
- `core.carinaai.uk/src/gateway/web/` onboarding flow (one-click: register, pick plan, agent live)
- `core.carinaai.uk/.env.example` (`CARINA_CLOUD_ENABLED`, plan limits)

## Step-by-step

1. Define Carina Cloud tiers (align with existing plan-features if present):

   | Tier | Price | Limits |
   |------|-------|--------|
   | Free | £0 | 1 agent, 1 member, core tools, no Scout |
   | Starter | £49/mo | BYOK, workbench, basic audit (may map to carina_ops_starter) |
   | Team | £99/mo | Multi-user, deployments (carina_ops_team) |

2. Marketing page `carinaai.uk/cloud/index.html`:
   - Hero: "Deploy a Carina agent in one click"
   - Steps: Sign up, add API key, choose pack, chat
   - Clarify: runs on same MIT kernel; Cloud is hosting + Ops UI
   - CTA: `https://app.carinaai.uk/register`

3. Docs `carina-cloud.md`:
   - Difference: self-host `@verlox/carina-core` vs Carina Cloud
   - Export/migrate: can export config and move to self-host (document honestly if not implemented: "roadmap")

4. Implement or wire `cloud-provisioner.ts`:
   - On org registration (existing flow), seed default agent config, empty `ACTIVE_SKILL_PACKS`, welcome checklist
   - Idempotent provisioning tested in Vitest

5. One-click UX on `app.carinaai.uk`:
   - Post-register redirect to onboarding wizard (carina-ops `31-onboarding-wizard-ui.md` if not done)
   - "Your agent is ready" under 60 seconds on happy path

6. Free tier guardrails: rate limits, no Scout server bundled (Scout upsell separate)

7. Link from kernel manifesto and pricing boundary page.

## Expected behavior

- New user registers at app.carinaai.uk and reaches working chat with core kernel
- Marketing clearly separates free kernel (self-host) from paid Cloud (hosting)

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/
```

- Manual: register test account on staging, complete onboarding, send one chat message
- Pricing page lists Cloud alongside Scout and self-host free kernel

## Pitfalls

- Do not conflate Carina Cloud with Scout subscription
- Hosted mode secrets stay out of git
