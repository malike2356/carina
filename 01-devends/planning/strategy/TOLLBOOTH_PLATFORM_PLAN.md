# Carina Platform: The Tollbooth Strategy
# Master Plan, Roadmap, and Implementation Checklist

**Document status:** Active - do not archive
**Classification:** Internal strategy - VERLOX only
**Last updated:** 2026-06-26
**Source discussion:** `/opt/lampp/htdocs/verlox/carina/carina_the_tollbooth_end_game_strategy_discussion.md`

---

## The One-Sentence Strategy

Carina is the authorization and orchestration network for AI work. Scout is the compliance
interchange. Aiva is the proof-of-concept merchant. Every partner builds stores. Every store
runs on Carina rails.

---

## What the Tollbooth Model Actually Means

Visa's 67% margin is not a product decision. It is an architectural one. They separated two things
that most companies keep fused: the risk layer (banks lend, default, carry bad debt) and the
infrastructure layer (Visa routes, audits, settles). Visa never touches money. It touches messages
about money.

Carina's version:

```
Who carries risk             Carina equivalent          Current state
--------------------------------------------------------------------
Banks carry credit risk      Users bring own keys       BYOK: built
Merchants absorb interchange  AI cost in product price   Partial
Visa owns routing only       Carina owns orchestration  Core: built
Two roads for the planet     Carina + one other         Not yet
```

The gap is not technical. It is architectural positioning and commercial instrumentation.
Every decision from this point forward must be tested against one question: does this
make Carina more like Visa or more like Barclays? Barclays lends money and carries risk.
Visa routes messages and charges a fraction. Build like Visa.

---

## What Already Exists (Do Not Rebuild)

Before writing any new code, confirm you understand what is already in place.

In `core.carinaai.uk`:
- `partner_accounts` table: id, name, slug, brand, commercial_tier, owner_org_id, stripe_customer_id, max_client_orgs
- `partner-service.ts`: create, get, list, link partner accounts to orgs
- `white-label-plans.ts`: three tiers: starter (GBP 99/month, 5 workspaces), agency (GBP 299/month, 25 workspaces), enterprise (custom)
- `margin-report.ts`: `MARGIN_FLOOR = 0.65`, `impliedGrossMargin()`, per-org margin tracking
- `skills/hub/registry.ts`: `author_revenue_share_bps`, `carina_revenue_share_bps`, `platform_fee_bps` fields on every pack row
- `hosted-billing.ts`: Stripe billing infrastructure for hosted mode
- `hosted-migrations.ts`: org, partner, custom-domain tables already migrated

In `app.carinaai.uk`:
- `usage_events` table: workspaceId, provider, model, inputTokens, outputTokens, createdAt
- `byok_keys` table and encryption pattern (the basis for partner API keys)
- `audit_log` table: workspaceId, userId, action, detail, ipHash
- `workspace_members` table: multi-tenant workspace access
- SSO module: workspace-level IdP configuration (OIDC and SAML)

None of the above should be duplicated. Every sprint in this plan extends what exists.

---

## The Four-Layer Architecture (Target State)

```
Layer 1: Carina Platform (the road)
  - Canonical event bus: every AI action emits a metered event
  - Partner API gateway: authenticated, rate-limited, scoped
  - Usage-based billing: Stripe metered records on top of subscription
  - Scout governance layer: mandatory for production tier

Layer 2: Partner Network (the banks)
  - Certified platform partners: full API, revenue share agreement
  - Integration partners: pre-built connectors, flat monthly fee
  - Self-hosted deployers: MIT, no toll (community funnel)

Layer 3: Applications (the vehicles)
  - Carina Workspace (built by VERLOX on Layer 1)
  - Aiva (built by VERLOX on Layer 1)
  - Partner apps (built by certified partners on Layer 1)

Layer 4: Marketplace (the cargo)
  - Skill packs: authored by anyone, monetised through Layer 1
  - Playbooks: vertical workflow templates
  - Certified agent blueprints
```

This architecture means that Carina's margin grows with partner volume, not with VERLOX
headcount. When a partner's users generate 10,000 AI events per month, Carina earns a
fraction of every one. The partner employed nobody. The partner sold nobody. The road
just got busier.

---

## Revenue Model: Three Tolls

### Toll 1: Platform usage (per event)

Every AI action on Carina's infrastructure generates a metered event. Partners pay per
event beyond their included monthly volume.

```
Event type              Billable unit     Notes
----------------------------------------------------------------------
AI message (in/out)     Per 1k tokens     Passed through at cost + margin
Tool call executed      Per call          Flat micro-fee
Skill invoked           Per invocation    Flat micro-fee
Webhook delivered       Per webhook       Flat micro-fee
Scout audit record      Per record        Flat micro-fee
Memory read/write       Per operation     Flat micro-fee
```

Implementation: Stripe Usage Records, metered subscription item per workspace, invoiced
monthly. The infrastructure already records `usage_events`. Extend it with event types
and attach Stripe metered billing.

### Toll 2: Trust (Scout governance)

Scout is the compliance interchange. Enterprises pay because they cannot go to production
without an immutable audit trail, kill switch, and compliance export. This is the
interchange fee: not optional for regulated industries.

Pricing tiers (already designed in `white-label-plans.ts`):
- Starter: GBP 99/month, 5 client workspaces
- Agency: GBP 299/month, 25 client workspaces
- Enterprise: custom, unlimited

Add: Scout-only tier for teams not using Carina Workspace (agents built on LangChain,
CrewAI, or custom, passing through Scout proxy).

### Toll 3: Ecosystem (marketplace)

Every skill pack installed generates a split:
- Author: their configured `author_revenue_share_bps` (already in schema)
- Carina: its configured `carina_revenue_share_bps` (already in schema)
- Platform fee: `platform_fee_bps` on the transaction (already in schema)

The schema exists. The submission flow, payment split, and payout mechanism do not yet
exist. That is Sprint TB-006.

---

## Roadmap: Four Phases

### Phase 1: Instrument the road (months 1-3)
Goal: every AI action on Carina generates a measurable, attributed event.

Without this, nothing else is possible. You cannot charge for usage you cannot measure.

Key deliverables:
- Canonical event schema (`platform_event` table in core)
- Event emitter wired to every channel, tool call, skill invocation, Scout record
- `partner_id` attribution on every event (already partially wired; complete it)
- Usage dashboard for internal visibility (operators only at this stage)
- Stripe metered billing wired to event volume (even if no partner uses it yet)

### Phase 2: Open the road to partners (months 3-6)
Goal: three certified partners are routing AI work through Carina's infrastructure.

Propreneur is already Partner 0. Formalise it. Then recruit two more.

Key deliverables:
- Partner API gateway at `api.carinaai.uk`
- Partner API keys: scoped, rate-limited, with `revenue_share_bps`
- Partner console: usage, billing, branded workspace management
- Self-serve partner onboarding (sign up, get key, see docs in 15 minutes)
- Published partner program page at `carinaai.uk/partners`
- Revenue share invoicing via Stripe

### Phase 3: Build the network effect (months 6-12)
Goal: the platform is more valuable because of what partners contributed, not because
VERLOX built more features.

Key deliverables:
- Skills marketplace: submission, review, approval, distribution, payout
- Public `status.carinaai.uk` with SLA enforcement and credit mechanism
- Scout standalone: governance for agents not built on Carina (LangChain, etc.)
- Partner analytics: usage, trends, compliance exports via API
- SOC 2 Type II audit initiated (12-18 month process, start now)

### Phase 4: Become the standard (months 12-36)
Goal: the phrase "compliant AI agent" means "agent that passed Scout governance."

Key deliverables:
- On-chain agent attestation (ERC-8004 registration from DeepSeek's suggestion, or
  equivalent if that standard matures)
- Scout as regulatory compliance layer (GDPR, FCA, NHS-DSP toolkit ready)
- Marketplace at scale: 50+ certified skill packs, revenue share paying authors
- Enterprise GTM: NHS trusts, financial services, legal firms
- Second infrastructure partner (the Mastercard equivalent - not a competitor, a
  validator that there are two roads)

---

## Decision Rules

These rules govern every product, technical, and commercial decision. Test every proposal
against them before building.

### Rule 1: Own the road, not the cargo
Carina routes AI work. It does not own the vertical logic, the customer data, the models,
or the end-user relationships. Partners and workspace owners hold all of those. When
someone proposes "we should add a property management feature to Carina core," the answer
is: that is a skill pack or a partner app, not a Carina core feature.

### Rule 2: Carry no risk
- Model cost: BYOK or passed through at cost with usage fee. Never sell unlimited inference
  on a flat seat. That is lending money at 0% interest.
- Data liability: workspace data is owned and controlled by the workspace. Carina processes
  it but does not own it. Terms of service must state this explicitly.
- Compliance liability: workspace owners are data controllers under GDPR. Carina is a
  processor. This is not a legal technicality; it is a margin protection mechanism.
- Model liability: Carina routes prompts. The model provider is the generator. Carina
  is not responsible for model outputs. State this in partner agreements.

### Rule 3: Meter everything before charging anything
Instrumentation comes first. Before any usage-based pricing is launched, every event type
must be recorded, attributed, and visible in the operator dashboard. Charging for events
you cannot accurately measure creates billing disputes that destroy partner trust.

### Rule 4: Margin floor is 65%
The `MARGIN_FLOOR = 0.65` constant already exists in `margin-report.ts`. This is the
minimum acceptable gross margin on any workspace. If a workspace's AI spend causes gross
margin to drop below 65%, either BYOK is required, plan limits are applied, or the usage
fee is adjusted. This floor must never be relaxed without a written commercial decision.

### Rule 5: Scout is mandatory for production
Any partner workspace accessing customer data, external APIs, or automated workflows must
have Scout governance active. Self-hosted and development workspaces can run without Scout.
The moment an agent touches production, Scout becomes non-optional. This is how the toll
becomes unavoidable: you can drive a car in a car park without paying. The moment you get
on the motorway, the barrier drops.

### Rule 6: The platform must never compete with certified partners
If VERLOX certifies a partner to serve the legal sector, VERLOX must not then launch a
competing legal product built on the same platform. This is the Visa rule: Visa does not
compete with Barclays by issuing credit cards. Partners need to trust that building on
Carina does not create a future competitor with privileged infrastructure access.

---

## Key Metrics

These are the metrics that distinguish a tollbooth business from a consultancy.

```
Metric                          Target (month 12)       Current state
----------------------------------------------------------------------
Agent events per month          1,000,000               Not measured
Take rate (revenue/event vol)   0.3% of AI spend        Not calculated
Partner count (certified)       10                      1 (Propreneur)
Workspaces on platform          500                     ~50
Revenue per event (pence)       0.05                    N/A
Gross margin                    65%+                    Partially tracked
% of events hitting Scout       80%                     Not measured
Headcount at 1M events/month   Under 5                  N/A (track this)
```

If revenue scales with headcount, Carina is a services firm. If revenue scales with events
while headcount is flat, Carina is a tollbooth. Watch both.

---

## Implementation Checklists

### Checklist A: Before launching the partner API

- [ ] `platform_event` table created in core with: id, org_id, partner_id, event_type,
      tokens_in, tokens_out, tool_calls, skill_calls, memory_ops, latency_ms, model,
      provider, scout_verified, fee_pence, created_at
- [ ] Every channel adapter emits a `platform_event` on each message processed
- [ ] Every tool call emits a `platform_event`
- [ ] Every skill invocation emits a `platform_event`
- [ ] `partner_id` is attributed correctly on every event (not null for partner workspaces)
- [ ] Internal operator dashboard shows event volume by partner, event type, and day
- [ ] Stripe metered subscription item created for `platform_events` product
- [ ] Partner API key table created with: id, partner_id, key_hash, scopes, rate_limit_rpm,
      monthly_cap_events, revenue_share_bps, status, created_at
- [ ] Rate limiting middleware enforces `rate_limit_rpm` per key
- [ ] API gateway routes authenticated with partner key
- [ ] Documentation for every endpoint published at `api.carinaai.uk`

### Checklist B: Before certifying a partner

- [ ] Partner account created in `partner_accounts` with commercial tier
- [ ] Revenue share agreement signed (GBP amount, bps rate, payment terms)
- [ ] Partner API key issued with correct scopes for their use case
- [ ] Partner has integrated and sent at least 100 test events through gateway
- [ ] Stripe billing for partner workspace activated (metered + flat monthly)
- [ ] Partner listed on `carinaai.uk/partners` page with approved description
- [ ] Partner onboarding completed: custom domain, branding, workspace setup
- [ ] Escalation path documented: who to call if gateway is down

### Checklist C: Before launching Scout standalone

- [ ] Scout proxy deployed as a standalone Docker container
- [ ] Scout SDK published to npm with install instructions
- [ ] Self-serve sign-up flow at `console.labyrinthscout.com`: create account, get API key,
      configure first agent, see first event in dashboard
- [ ] Scout-only pricing tier: separate from Carina workspace subscription
- [ ] Documentation covers: LangChain, CrewAI, OpenAI Agents SDK integrations
- [ ] ERC-8004 registration (or equivalent) working for on-chain attestation

### Checklist D: Before launching the marketplace

- [ ] Skill pack submission form at `hub.carinaai.uk`: name, description, version,
      pricing_tier, price_gbp_cents, author_revenue_share_bps
- [ ] Review and approval workflow: VERLOX reviews every submitted pack before listing
- [ ] Stripe Connect or equivalent set up for author payouts
- [ ] Pack installation tracked: `download_count` incremented, billing event fired
- [ ] Author dashboard: packs published, installs, revenue earned to date
- [ ] Revenue split working end to end: install payment -> Stripe -> split author/Carina

### Checklist E: SOC 2 Type II readiness (start month 3)

- [ ] Audit firm engaged
- [ ] Trust service criteria mapped to existing controls
- [ ] Access control review: every admin API route has authentication and authorization
- [ ] Encryption at rest confirmed for: database, secrets, partner credentials
- [ ] Encryption in transit confirmed: TLS 1.3 on all endpoints
- [ ] Incident response plan documented
- [ ] Change management process documented
- [ ] Audit log completeness: every admin and partner action logged
- [ ] Log retention policy: minimum 12 months
- [ ] Penetration test scheduled

---

## What Not to Build (The Barclays Trap)

Visa is a tollbooth because it never became a bank. Carina must maintain the same
discipline.

Do not build:
- Custom enterprise integrations that bypass the standard event and billing layer
- Unlimited AI inference on any flat subscription tier without a credit cap
- Vertical-specific logic in core that belongs in a skill pack or partner app
- A competing product in a vertical where VERLOX has certified a partner
- Features that require VERLOX to hold customer data beyond what processing requires
- SLA commitments before `status.carinaai.uk` and SLA credit automation exist

The moment Carina owns vertical logic in its core, it becomes a vertical SaaS. Vertical
SaaS margins are 20-35%. Platform margins are 65%+. Stay on the platform side.

---

## Filing and Updates

This document lives at:
`01-devends/planning/strategy/TOLLBOOTH_PLATFORM_PLAN.md`

Update the relevant section and checklist when:
- A sprint is completed
- A partner is certified or removed
- A rule is amended by a business decision
- A metric target is revised based on actual data

Do not create a separate version of this document. Edit it in place and note the date
of each substantive change at the top.
