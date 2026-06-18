# Carina Ops: Implementation Plan and Sprint Roadmap

**Status:** Build complete (Sprints 0-7); launch prep in progress  
**Based on:** `productizing_and_commercializing_Carina_OPS_Dashboard.md`  
**Last updated:** 2026-06-13 (exit criteria synced to repo)

This document turns the strategy conversation into a build plan. It is repo-specific, sprint-ordered, and test-driven. Do not treat `ops.carinaai.uk` as the customer product. Extend `app.carinaai.uk` in `core.carinaai.uk` as the paid Carina Ops surface.

---

## 1. Product decisions (frozen)

| Item | Decision |
|------|----------|
| Free product | Carina AI: the agent (`core.carinaai.uk`, CLI, `app.carinaai.uk` chat for individuals) |
| Paid addon | Carina Ops: team control plane on `app.carinaai.uk/ops` (or equivalent path) |
| Private back office | `ops.carinaai.uk`: VERLOX support console only; never customer-facing |
| Independent product | Labyrinth Scout: governance on `labyrinthscout.com` at £99/mo |
| Wedge | BYOK + usage control + audit + team administration |
| Promise | "Bring your own keys, govern your agents, audit everything, control spend." |
| Pricing | Starter £49/mo, Team £99/mo (or per-seat later), Scout £99/mo separate |
| Buyer (first) | AI-first startups and internal platform teams running multiple models |

### Positioning (one line each)

- **Carina AI:** "The AI that gets work done."
- **Carina Ops:** "The control plane that runs Carina."
- **Labyrinth Scout:** "Governance and protection for autonomous agents."

### What we are not building in the first 90 days

- Generic AI marketplace
- Workflow builder
- Dozens of provider integrations
- Enterprise SSO/SCIM (Enterprise tier only, post-launch)
- Exposing raw ops tools to customers

---

## 2. Architecture

### Two faces, one backend

```
carinaai.uk              Marketing: Carina AI (free) + Carina Ops (paid)
app.carinaai.uk          Customer product (core.carinaai.uk gateway)
  /                      Carina AI chat (free tier)
  /ops/*                 Carina Ops customer console (paid)
ops.carinaai.uk          VERLOX private back office (support, overrides)
labyrinthscout.com       Scout marketing (separate funnel)
```

### Code ownership

| Surface | Directory | Role |
|---------|-----------|------|
| Customer auth, billing, ops UI | `core.carinaai.uk/src/gateway/`, `src/api/` | Product |
| Shared tenancy, vault, audit libs | `core.carinaai.uk/src/hosted/` (new) or `src/api/` | Shared |
| Internal support console | `ops.carinaai.uk/` | Back office only |
| AI Platform prototype | `ops.carinaai.uk/lib/ai-platform.ts` | Port useful parts to core; freeze new customer features here |

### Boundary matrix

| Capability | Customer (`app.carinaai.uk`) | Internal (`ops.carinaai.uk`) |
|------------|------------------------------|------------------------------|
| Register / login | Yes | No (admin password only) |
| Org settings | Yes | Read-only for support |
| BYOK vault | Yes | Support view with redaction |
| Workbench | Yes | No |
| Usage and credits | Yes | Aggregate + per-tenant override |
| Audit log (product events) | Yes | Full platform view |
| Deployments / environments | Team tier | Read-only |
| Tenant provisioning | Self-serve org create | Manual create + repair |
| Plan override | Via Stripe only | Manual override |
| Scout kill switch | No | Yes |
| DB repair / impersonation | No | Yes (logged) |
| Memories / skills / RAG (VERLOX) | No | Yes |

---

## 3. Current state vs target

### Already exists

- Hosted register/login/JWT in `core.carinaai.uk/src/api/hosted-auth.ts`
- Stripe billing skeleton in `core.carinaai.uk/src/api/hosted-billing.ts`, `hosted-web.ts`
- Host-aware gate in `core.carinaai.uk/src/gateway/web-auth.ts` and `hosted-domain.ts`
- Tenant provisioning, BYOK, subscriptions in `ops.carinaai.uk/lib/tenant-*.ts`
- AI Platform prototype tables in `ops.carinaai.uk/lib/ai-platform.ts`
- Plan catalog in `ops.carinaai.uk/lib/billing-plans.ts`

### Missing (blockers)

All Sprint 0-7 **code blockers are resolved**. Remaining gaps are launch and ops, not build:

- Production deploy and live Stripe price IDs
- Privacy policy / terms update for org data boundaries
- Beta program (3+ design partners)
- Manual credit adjustment in ops back office (deferred post-launch)
- Activation telemetry beyond `product_audit_log` (deferred; audit covers v1)

---

## 4. Sprint overview

| Sprint | Dates | Theme | Exit signal |
|--------|-------|-------|-------------|
| 0 | Day 1-3 | Lock spec and boundaries | Brief approved; no new ops customer UI |
| 1 | Day 4-14 | Org model and RBAC schema | Tables exist; role enum enforced in code |
| 2 | Day 15-28 | Tenant isolation | Cross-tenant read tests fail in CI |
| 3 | Day 29-42 | Customer Ops shell | Paid user sees Ops nav on `app.carinaai.uk` |
| 4 | Day 43-56 | Core value features | BYOK + workbench + usage + audit work for one org |
| 5 | Day 57-70 | Billing and plan gates | Stripe plan changes product behavior |
| 6 | Day 71-84 | Onboarding and trust | Stranger completes flow without a call |
| 7 | Day 85-90 | Launch prep | Pricing page live; 3 beta partners onboarded |

**Build status:** Sprints 0-7 code and tests shipped in repo. See exit criteria per sprint; launch checklist in `CARINA_OPS_LAUNCH_RUNBOOK.md`.

---

## 5. Sprint 0: Lock spec (Days 1-3)

**Goal:** Stop scope drift before schema work.

### Tasks

1. **Approve this document** as the execution source. Strategy doc stays as background only.
2. **Freeze ops scope:** no new customer-facing routes in `ops.carinaai.uk/routes/ai-platform.ts`. Tag existing `/ai-platform` as `INTERNAL_PROTOTYPE` in code comments.
3. **Define Carina Ops plan IDs** in `ops.carinaai.uk/lib/billing-plans.ts` and mirror in core:
   - `carina_ops_starter` (£49)
   - `carina_ops_team` (£99)
   - Keep Scout plans separate (`scout_monitor`, `scout_pro`, etc.)
4. **Add env contract** to `core.carinaai.uk/.env.example`:
   - `HOSTED_MODE=true`
   - `CARINA_OPERATOR_HOSTS=core.carinaai.uk,localhost`
   - `CARINA_OPS_ENABLED=true`
   - Stripe price IDs for Ops plans (placeholders until Stripe products exist)
5. **Create feature flag map** (markdown table in this file or `docs.carinaai.uk` later):
   - Free: chat, limited history
   - Starter: 1 org, BYOK, workbench, basic audit, basic vault
   - Team: multi-user, deployments, environments, exports, approvals (later)

### Deliverables

- [x] Boundary matrix agreed (Section 2)
- [x] Plan IDs named in billing config (`carina_ops_starter`, `carina_ops_team`)
- [x] `/ai-platform` freeze announced (`INTERNAL_PROTOTYPE` in `ops.carinaai.uk/routes/ai-platform.ts`)

### Do not start yet

- UI polish
- Marketing site rewrite
- New provider integrations

---

## 6. Sprint 1: Org model and RBAC (Days 4-14)

**Goal:** Multi-user orgs with roles; every user belongs to exactly one org at first (multi-org later).

### Schema (add to `core.carinaai.uk/src/api/hosted-migrations.ts` and `ops.carinaai.uk/lib/hosted-migrations.ts`)

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES hosted_users(id),
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE org_memberships (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES hosted_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','operator','auditor','viewer')),
  invited_by UUID REFERENCES hosted_users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Migration rules

1. On register, create `organizations` row + `org_memberships` with role `owner`.
2. Link existing `hosted_users` rows: backfill one org per user in a one-time migration script.
3. Add `org_id UUID` to: `subscriptions`, `usage_records`, `tenant_provider_keys`, `ops_audit_log` (rename to `product_audit_log` in core over time).
4. JWT payload adds `orgId` and `role` after login.

### Code tasks

| # | Task | Files |
|---|------|-------|
| 1.1 | Add migrations | `core.carinaai.uk/src/api/hosted-migrations.ts`, `ops.carinaai.uk/lib/hosted-migrations.ts` |
| 1.2 | `createOrgForUser()` on register | `core.carinaai.uk/src/api/hosted-auth.ts` |
| 1.3 | `requireOrgMember(role)` middleware | `core.carinaai.uk/src/gateway/web-auth.ts` (new helper) |
| 1.4 | Role permission map | `core.carinaai.uk/src/hosted/rbac.ts` (new) |
| 1.5 | Invite accept endpoints | `core.carinaai.uk/src/api/hosted-web.ts` |
| 1.6 | Backfill script for existing tenants | `core.carinaai.uk/src/cli/commands/hosted-cli.ts` |
| 1.7 | Unit tests for role checks | `core.carinaai.uk/src/api/__tests__/hosted-rbac.test.ts` (new) |

### RBAC permission matrix (v1)

| Action | owner | admin | operator | auditor | viewer |
|--------|-------|-------|----------|---------|--------|
| Org settings | yes | yes | no | no | no |
| Invite users | yes | yes | no | no | no |
| BYOK write | yes | yes | no | no | no |
| Workbench run | yes | yes | yes | no | no |
| View usage | yes | yes | yes | yes | yes |
| View audit | yes | yes | yes | yes | yes |
| Billing change | yes | no | no | no | no |

### Exit criteria

- [x] New user gets org + owner membership automatically
- [x] JWT contains `orgId` and `role`
- [x] Role middleware returns 403 on forbidden actions
- [x] Tests cover each role boundary for at least 3 endpoints (`hosted-rbac.test.ts`)

---

## 7. Sprint 2: Tenant isolation (Days 15-28)

**Goal:** No cross-org reads in supported flows. Prove it with tests.

### Enforcement layers

1. **Application:** every query includes `WHERE org_id = $1` from session context.
2. **Middleware:** `setOrgContext(req)` runs before all `/ops` and `/app/auth` routes.
3. **Database (stretch):** Postgres RLS on product tables using `SET app.org_id` per connection.

### Code tasks

| # | Task | Files |
|---|------|-------|
| 2.1 | `getOrgContext(req)` helper | `core.carinaai.uk/src/hosted/org-context.ts` (new) |
| 2.2 | Scope `tenant_provider_keys` queries | `core.carinaai.uk/src/api/hosted-billing.ts`, BYOK module |
| 2.3 | Scope `usage_records` and `subscriptions` | billing routes |
| 2.4 | Add `org_id` to AI platform tables when ported | see Sprint 4 |
| 2.5 | Audit log writes include `org_id`, `actor_user_id`, `action` | new `product_audit_log` table |
| 2.6 | Ops routes: support read uses explicit `tenant_id` param + audit | `ops.carinaai.uk/routes/tenants.ts` |
| 2.7 | **Isolation test suite** | `core.carinaai.uk/src/api/__tests__/hosted-isolation.test.ts` (new) |

### Isolation tests (required)

```text
hosted-isolation.test.ts
  - user A cannot read user B vault keys
  - user A cannot read user B usage records
  - user A cannot read user B audit entries
  - operator cannot invite into org they do not belong to
  - viewer cannot POST workbench run
  - ops admin can read any tenant when using support tools (separate test file in ops)
```

### Exit criteria

- [x] All product tables queried in customer paths have `org_id` filter
- [x] Isolation test suite passes in CI (`hosted-isolation.test.ts`, 19 tests with RBAC)
- [x] Manual two-account test documented in `core.carinaai.uk/prompts/hosted-saas-multitenancy.md`

---

## 8. Sprint 3: Customer Ops shell (Days 29-42)

**Goal:** Paid customers see Carina Ops on `app.carinaai.uk`, not on `ops.carinaai.uk`.

### UI approach

Reuse the static HTML + vanilla JS pattern from `src/gateway/web/hosted-login.html`. Add an Ops shell:

```text
core.carinaai.uk/src/gateway/web/ops/
  index.html          Overview (usage summary, plan, quick actions)
  layout.js           Shared nav: Overview, Workbench, Vault, Usage, Audit, Settings
  settings.html       Org name, members, invites
  billing.html        Plan, Stripe portal link (reuse hosted billing)
```

### Routing (in `core.carinaai.uk/src/gateway/web.ts`)

- `GET /ops` -> require hosted session + `carina_ops` plan (or trial)
- `GET /ops/*` -> static ops shell
- `GET /api/ops/*` -> JSON API for ops pages (new router)

### Code tasks

| # | Task | Files |
|---|------|-------|
| 3.1 | Ops static shell and nav | `src/gateway/web/ops/` |
| 3.2 | `requireOpsPlan` gate | `src/hosted/plan-gates.ts` (new) |
| 3.3 | Ops API router skeleton | `src/api/ops-routes.ts` (new) |
| 3.4 | Link from hosted chat UI to Ops | `hosted-login.html` or post-login dashboard |
| 3.5 | Free users see upgrade CTA, not Ops nav | plan gate |
| 3.6 | Ops branding copy: "Carina Ops" not "Admin" | all ops HTML |

### Exit criteria

- [x] Logged-in Team user opens `https://app.carinaai.uk/ops`
- [x] Free user sees upgrade prompt, not ops data
- [x] Ops pages load without ops.carinaai.uk credentials
- [x] Internal ops nav unchanged and separate

---

## 9. Sprint 4: Core value features (Days 43-56)

**Goal:** Port the useful parts of `ops.carinaai.uk/lib/ai-platform.ts` into core, fully org-scoped.

### Tables to create in core (org-scoped)

Port from `ops.carinaai.uk/lib/ai-platform.ts` with `org_id` on every table:

- `ai_platform_models` (org_id; catalog per org or platform defaults copied on create)
- `ai_platform_workbench_runs` (already has org_id in ops; keep)
- `ai_platform_vault_entries` (new; wraps `tenant_provider_keys` or extends it)
- `ai_platform_deployments`
- `ai_platform_environments`
- `product_audit_log` (all product events)

### Feature build order

| # | Feature | Customer API | Priority |
|---|---------|--------------|----------|
| 4.1 | Model catalog (read) | `GET /api/ops/models` | P0 |
| 4.2 | BYOK vault CRUD | `GET/POST/DELETE /api/ops/vault` | P0 |
| 4.3 | Workbench run | `POST /api/ops/workbench/run` | P0 |
| 4.4 | Usage dashboard | `GET /api/ops/usage` | P0 |
| 4.5 | Credits and spend | `GET /api/ops/credits` | P0 |
| 4.6 | Product audit log | `GET /api/ops/audit` | P0 |
| 4.7 | Deployments list | `GET /api/ops/deployments` | P1 (Team) |
| 4.8 | Environments list | `GET /api/ops/environments` | P1 (Team) |

### Audit events to log (minimum)

- `vault.key_added`, `vault.key_removed`, `vault.key_rotated`
- `workbench.run_started`, `workbench.run_completed`
- `org.member_invited`, `org.member_removed`, `org.settings_changed`
- `billing.plan_changed`, `billing.checkout_started`

### Workbench execution

- Route workbench prompts through existing LLM router in core
- Meter tokens into `usage_records` with `org_id`
- Redact secrets from audit and workbench response logs

### Exit criteria

- [x] Customer connects BYOK key, runs workbench prompt, sees usage and audit entry
- [ ] Time to first prompt under 10 minutes (success metric; validate in beta)
- [x] No secret echoed in API responses or audit JSON (`redact.ts`, tests)
- [x] Ops prototype in `ops.carinaai.uk` not required for customer flow

---

## 10. Sprint 5: Billing and plan gates (Days 57-70)

**Goal:** Stranger can pay; plan controls features.

### Stripe setup

1. Create Stripe products:
   - Carina Ops Starter (£49/mo)
   - Carina Ops Team (£99/mo)
2. Add price IDs to env:
   - `STRIPE_PRICE_CARINA_OPS_STARTER`
   - `STRIPE_PRICE_CARINA_OPS_TEAM`
3. Extend `core.carinaai.uk/src/api/hosted-web.ts` checkout to accept `plan=carina_ops_starter|carina_ops_team`
4. Webhook handler updates `subscriptions.plan` and `organizations.plan`

### Plan gates (`src/hosted/plan-gates.ts`)

| Feature | Free | Starter | Team |
|---------|------|---------|------|
| Chat | yes | yes | yes |
| Ops console | no | yes | yes |
| Max members | 1 | 3 | 25 |
| BYOK providers | 0 | 3 | unlimited |
| Audit retention | 7 days | 30 days | 90 days |
| Deployments | no | no | yes |
| Exports | no | no | yes |

### Code tasks

| # | Task | Files |
|---|------|-------|
| 5.1 | Ops plan IDs in billing | `hosted-billing.ts`, `billing-plans.ts` |
| 5.2 | Checkout + portal for Ops | `hosted-web.ts` |
| 5.3 | Webhook maps plan to org | Stripe webhook handler |
| 5.4 | `requirePlan('starter')` on ops routes | `plan-gates.ts` |
| 5.5 | Usage limits and warnings | `hosted-billing.ts`, usage API |
| 5.6 | Invoice history in ops billing page | ops shell `billing.html` |
| 5.7 | Trial support (14 days Team) | `subscriptions.trial_ends_at` |

### Exit criteria

- [x] Stripe test checkout upgrades org to Starter
- [x] Starter user blocked from Team-only routes (deployments)
- [x] Downgrade/cancel reflects in product within webhook latency
- [x] Ops billing page shows invoices from `invoices` table

---

## 11. Sprint 6: Onboarding and trust (Days 71-84)

**Goal:** Self-serve flow works without manual ops intervention.

### Onboarding steps (automated)

1. Register at `app.carinaai.uk`
2. Create org (automatic)
3. Start trial or checkout
4. Connect first BYOK key
5. Run first workbench prompt
6. View usage and audit entry
7. Invite second user (Team)

### Code tasks

| # | Task | Files |
|---|------|-------|
| 6.1 | Onboarding checklist API | `GET /api/ops/onboarding` |
| 6.2 | Onboarding UI wizard | `ops/onboarding.html` |
| 6.3 | Evidence export CSV | `GET /api/ops/audit/export` |
| 6.4 | Usage export CSV | `GET /api/ops/usage/export` |
| 6.5 | Email invite flow | `hosted-auth.ts` + Resend template |
| 6.6 | Support tools in ops only | `ops.carinaai.uk`: impersonation with `ops_audit_log` (Sprint 7) |
| 6.7 | Secret redaction audit | `src/hosted/redact.ts` (Sprint 7) |
| 6.8 | Activation telemetry events | Deferred; `product_audit_log` covers v1 |

### Internal ops support (ops.carinaai.uk only)

- View tenant detail (existing)
- Manual plan override (existing; keep)
- Account suspend/reactivate
- Impersonation session (read-only) with mandatory audit row
- Manual credit adjustment (deferred post-launch)

### Exit criteria

- [x] New stranger completes onboarding checklist without ops manual steps
- [x] Audit and usage export downloads work for Team plan
- [x] Impersonation logged in `ops_audit_log`
- [ ] Every meaningful action has audit record (success metric)

---

## 12. Sprint 7: Launch prep (Days 85-90)

**Goal:** Marketable product and private beta.

### Marketing (`carinaai.uk/`)

| # | Task | File |
|---|------|------|
| 7.1 | Hero: Carina AI free | `carinaai.uk/index.html` |
| 7.2 | Carina Ops section with promise | same |
| 7.3 | Pricing table: Free / Starter £49 / Team £99 | same |
| 7.4 | Scout mentioned as optional companion, not core pitch | same |
| 7.5 | CTA: "Start free" -> app.carinaai.uk | same |

### Docs (`docs.carinaai.uk/`)

- User guide: Getting started with Carina Ops
- BYOK setup guide
- Audit and export guide
- Plan comparison page

### Beta program

- [ ] Recruit 3 to 5 design partners (AI-first startups, platform teams)
- [x] Seed demo org with sample usage data for sales calls (`core.carinaai.uk/prompts/carina-ops-demo-seed.md`)
- [ ] Collect: time to first prompt, confusion points, upgrade intent

### Launch checklist

- [ ] `HOSTED_MODE=true` on production `app.carinaai.uk`
- [ ] Stripe live mode price IDs set
- [ ] Isolation tests pass on staging
- [x] `ops.carinaai.uk` not linked from public marketing as customer login
- [ ] Privacy policy and terms mention org data boundaries
- [x] Runbook for support impersonation and billing overrides (`instructions/strategy/CARINA_OPS_LAUNCH_RUNBOOK.md`)

### Exit criteria

- [x] Pricing page live on carinaai.uk
- [ ] 3 beta partners onboarded
- [ ] One-sentence pitch validated with at least 2 external buyers
- [x] Product distinguishable from Scout and from raw ops dashboard

---

## 13. Success metrics (track from Sprint 4)

| Metric | Target |
|--------|--------|
| Time to first prompt | < 10 minutes |
| Self-serve org onboarding | No manual ops step |
| Audit coverage | Every vault, workbench, billing, member action logged |
| Usage visibility | Org-level and user-level spend |
| Product clarity | Buyer can explain difference between Carina AI, Carina Ops, Scout |

---

## 14. Risk register

| Risk | Mitigation |
|------|------------|
| Building customer UI inside ops | Freeze `/ai-platform`; build on `app.carinaai.uk` only |
| Scout overlap in messaging | Carina Ops = operations; Scout = governance |
| Underpricing (£49 only tier) | £49 Starter; £99 Team headline |
| Weak tenant isolation | Sprint 2 tests required before Sprint 4 features |
| Billing without gates | Sprint 5 blocks features by plan, not just labels |
| Scope creep (marketplace, SSO) | Explicitly deferred past Day 90 |

---

## 15. Next actions (launch)

Build sprints 0-7 are complete. Use `instructions/strategy/CARINA_OPS_LAUNCH_RUNBOOK.md`:

1. **Staging dry run:** register, onboarding, Stripe test checkout, workbench, CSV export, impersonation audit
2. **Production env:** `HOSTED_MODE`, `CARINA_OPS_PRODUCT_ENABLED`, live Stripe price IDs, `TENANT_KEY_ENCRYPTION_KEY`
3. **Legal:** privacy policy and terms mention org data boundaries
4. **Beta:** invite 3 design partners; run weekly feedback template from runbook
5. **Validate pitch** with 2 external buyers before broad marketing push

### Completed first PR scope (historical)

- Migrations, register creates org, JWT includes orgId + role, RBAC tests, customer ops on `app.carinaai.uk`

---

## 16. References

| Doc / path | Purpose |
|------------|---------|
| `instructions/strategy/productizing_and_commercializing_Carina_OPS_Dashboard.md` | Strategy rationale |
| `core.carinaai.uk/prompts/hosted-saas-multitenancy.md` | Existing hosted auth wiring |
| `ops.carinaai.uk/lib/ai-platform.ts` | Prototype to port |
| `ops.carinaai.uk/lib/billing-plans.ts` | Plan catalog |
| `core.carinaai.uk/src/api/hosted-auth.ts` | Auth foundation |
| `core.carinaai.uk/src/gateway/web-auth.ts` | Host-aware gate |

---

## 17. Post-90-day backlog (do not start early)

- Approval flows for risky workbench prompts
- Policy packs
- SSO / SCIM (Enterprise)
- Per-seat pricing model
- Scout cross-sell integration from Carina Ops audit view
- Legal hold and advanced retention
- Batch jobs and agent session management in customer ops
- Mobile companion ops screens
