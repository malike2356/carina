do you think we could commercialize and productize the internal OPS dashbaord so people can buy it and use it?
  advice


• Yes, but not as the current ops dashboard. As-is it is an internal control surface for Carina and Scout;
  productizing it would require turning it into a multi-tenant SaaS with hard boundaries between tenants, billing,
  roles, and data.

  My blunt take: the commercializable core is there, but the product is not yet packaged.

  What already points in the right direction:

  - It has real operational primitives: tenants, security, settings, skills, memories, chat, packs, subscriptions.
  - It already sits close to the value plane: AI usage, governance, identity, and control.
  - It is more differentiated than a generic admin panel because it touches agent behavior, not just content
    management.

  What is missing before anyone can buy it:

  - Tenant isolation that is real, tested, and impossible to bypass by accident.
  - Role-based access control, not just one admin password.
  - Billing, plans, metering, usage limits, and upgrade flows.
  - A clean onboarding path that does not assume you already run Carina internally.
  - Safer defaults for secrets, logs, exports, and audit trails.
  - Product-level UX around setup, navigation, and empty states.
  - Clear packaging: what the customer buys, what is hosted, what is BYOK, what is optional.

  So the answer is: commercialize the platform layer, not the raw ops panel. The internal dashboard should become
  the back office and system of record behind a customer-facing product, while the customer-facing surface exposes
  only the parts a buyer needs.

  Best path:

  1. Define the product wedge: AI governance, agent operations, or BYOK control plane.
  2. Split internal admin from customer tenant app.
  3. Add billing and usage metering first.
  4. Harden auth, RBAC, and audit logs.
  5. Package a minimal self-serve onboarding flow.

  If you try to sell the dashboard before those changes, you will be selling a service engagement disguised as
  software. If you productize the control plane properly, it can become a real SaaS.
  
  
  
THE WAY FORWARD.  

The thing you have now is a credible control plane prototype. The product you can sell is a narrower, safer, multi-tenant platform built on top of it.

  The main decision is this: do not sell the ops dashboard itself. Sell a hosted AI operations product with the ops dashboard as the private back office.

  Product Shape

  Your sellable product should be one of these, not all at once:

  1. AI governance and audit platform
  2. BYOK AI control plane
  3. Agent operations console for teams
  4. Internal AI admin for companies using multiple models and agents

  My recommendation: start with BYOK + governance + audit + usage controls. That is the cleanest wedge, easiest to explain, and closest to what you already have.

  What Must Exist Before Sale

  1. Multi-tenant isolation
     Every customer needs their own org, data boundary, and audit trail. No shared assumptions. No accidental cross-tenant reads.

  2. Real auth and roles
     Add roles like owner, admin, operator, auditor, viewer. One admin password is not a product.

  3. Billing and metering
     You need plans, seat counts or usage bands, invoice history, usage totals, limits, and overage handling.

  4. Audit and evidence
     Every model call, tool call, policy decision, prompt change, secret change, and deployment change needs a durable log.

  5. Secrets and vaults
     Customers need BYOK, scoped vault entries, rotation, and safe redaction.

  6. Clear onboarding
     A buyer should be able to sign up, create an org, connect a provider key, and run a first workflow without contacting you.

  7. Product-grade UX
     The current admin UI can stay, but the customer-facing app must be simpler, more opinionated, and much less ops-heavy.

  Building Plan

  Phase 1: Separate internal admin from customer product

  - Keep ops.carinaai.uk as the private admin console.
  - Create a customer-facing app, even if it starts as a thin shell.
  - Share the same backend libraries where sensible, but do not share the same navigation or mental model.
  - Decide which actions are internal only and which are customer visible.

  Exit criteria:

  - Customer app exists.
  - Internal ops stays private.
  - Customer data is tenant-scoped.

  Phase 2: Make identity and tenancy real

  - Add org registration, invites, and user membership.
  - Add roles and permissions.
  - Tie every record to an org ID.
  - Enforce row-level checks in code and, if possible, in the database.
  - Add org switching and session scoping.

  Exit criteria:

  - No data can be read across orgs.
  - Roles are enforced consistently.
  - Tests prove isolation.

  Phase 3: Productize the core value

  - Ship the minimum useful customer surface:
      - model catalog
      - workbench
      - prompt history
      - usage dashboard
      - credits and spend
      - vault
      - audit log
      - deployments
      - environments

  - Make BYOK first-class.
  - Make provider routing visible.
  - Make policy enforcement visible.
  - Keep the internal admin features, but do not expose all of them to customers.

  Exit criteria:

  - A customer can connect keys, run prompts, inspect usage, and review logs.
  - There is a clear reason to pay.

  Phase 4: Add commercial controls

  - Integrate Stripe or your payment provider.
  - Add subscriptions, trial periods, usage caps, and overage rules.
  - Add invoices, receipts, and payment failures.
  - Add plan gates for features like batch jobs, agent count, vault size, and retention length.

  Exit criteria:

  - A stranger can self-serve into a paid account.
  - Billing is reflected in product behavior.

  Phase 5: Add governance as differentiation

  - Ship policy packs for common use cases.
  - Add approval flows for risky actions.
  - Add evidence export for audits.
  - Add retention controls and legal hold.
  - Add configurable redaction and policy exceptions.

  Exit criteria:

  - You are not just another prompt wrapper.
  - You are selling control, evidence, and operating discipline.

  Phase 6: Package for a market
  Pick one buyer first. Do not market to everyone.

  Good first buyers:

  - AI-first startups with multiple providers
  - regulated SMEs using assistants and agents
  - internal platform teams managing BYOK usage
  - consulting firms running customer-specific agents

  You will need:

  - a simple homepage
  - pricing
  - docs
  - onboarding
  - one strong demo story
  - one narrow promise

  My recommendation for the promise:
  “Bring your own keys, govern your agents, audit everything, control spend.”

  What To Keep Private

  Keep these internal, even after product launch:

  - raw admin knobs
  - database repair tools
  - tenant provisioning internals
  - support overrides
  - secret migration utilities
  - infra health controls

  Customers should not see those unless they are deliberately surfaced as support or enterprise features.

  What To Turn Into Product Features

  These are already close and worth exposing:

  - workbench
  - usage ledger
  - org credits
  - model comparison
  - batch queue
  - agent sessions
  - deployment records
  - vault entries
  - memory stores
  - audit log
  - policy events

  These are the things that create a credible product, because they map to what buyers already understand: spend, access, evidence, control.

  What Not To Build Yet

  Do not start with:

  - generic marketplace features
  - broad prompt marketplace
  - dozens of AI provider integrations
  - enterprise SSO everywhere
  - complex workflow builder
  - custom agent IDE
  - public community features

  Those are expansion features, not launch blockers.

  Suggested Commercial Packaging

  Tier 1: Starter

  - 1 org
  - limited usage
  - BYOK
  - workbench
  - audit log
  - basic vault
  - basic usage charts

  Tier 2: Team

  - multiple users
  - approvals
  - deployments
  - environments
  - richer retention
  - batch jobs
  - exports

  Tier 3: Enterprise

  - SSO
  - SCIM
  - custom retention
  - policy packs
  - advanced audit exports
  - dedicated support
  - custom limits

  Key Product Risk

  The biggest risk is selling a dashboard instead of a platform. If the buyer feels like they are adopting your internal admin page, they will not trust it, and they will not pay for it.

  The fix is to force a product boundary:

  - customer app for usage and governance
  - internal ops for support and control
  - one backend, two faces, strict scoping

  My recommendation in one line

  Turn the dashboard into a hosted, tenant-scoped AI governance and operations product, keep the current ops surface private, and monetize the combination of BYOK, auditability, spend control, and approval workflows.
  
  
  ROADMAP
  
 Days 1 to 30: make the core sellable

  1. Freeze the product wedge: BYOK + governance + audit + spend control.
  2. Split internal admin from customer-facing product in the codebase and routing.
  3. Make tenancy real everywhere: every record gets an org ID, every query is scoped, every route is checked.
  4. Add RBAC with a small role set: owner, admin, operator, auditor, viewer.
  5. Turn the current AI Platform into a usable customer surface: org settings, model catalog, workbench, usage, vault, audit, deployments, environments.
  6. Wire the first commercial metrics: requests, tokens, spend estimate, credits, cache hits, batch count.
  7. Add tests for tenant isolation, role checks, and the key product flows.

  Exit criteria:

  - A customer can sign in, create an org, add keys, run a prompt, and see usage and audit history.
  - No cross-tenant reads are possible in the supported flows.

  Days 31 to 60: make it operationally trustworthy

  1. Add billing: plans, trial, seat or usage caps, invoice history, and overage handling.
  2. Add onboarding that a buyer can finish without help: create org, invite user, connect provider, run first workbench prompt, view first report.
  3. Add usage governance: limits, warnings, approval gates, and org-level feature flags.
  4. Add secret handling and vault hygiene: encryption at rest, redaction in logs, no secret echo back to UI.
  5. Add evidence exports: audit log CSV or JSON, usage export, incident timeline export.
  6. Add a minimal support workflow in internal ops: impersonation with logs, account status, reset tools, manual limit edits.
  7. Keep polishing the workbench so it feels like the main product, not a settings page.

  Exit criteria:

  - A stranger can try the product end to end and understand what it does without a call.
  - Billing and limits actually change product behavior.

  Days 61 to 90: make it launchable

  1. Build the customer-facing shell and pricing pages, separate from private ops.
  2. Add landing copy around one clear promise: Bring your own keys, govern your agents, audit everything, control spend.
  3. Add plan packaging: Starter, Team, Enterprise.
  4. Add retention and compliance controls: log retention, export retention, legal hold basics.
  5. Add a product demo path with seeded data and one or two guided workflows.
  6. Add telemetry for activation, retention, prompt runs, key connections, and upgrade intent.
  7. Run a private beta with 3 to 5 design partners and tighten the product from real usage.

  Exit criteria:

  - You have a product you can put in front of customers without apologizing for the UX or the boundary model.
  - You can explain the price, the value, and the trust story in one sentence.

  What I would not do in the first 90 days

  1. Do not build a generic AI marketplace.
  2. Do not build a giant workflow builder.
  3. Do not chase every provider under the sun.
  4. Do not expose private admin tools to customers.
  5. Do not overinvest in polish before tenancy, billing, and audit are sound.

  What to sell first

  1. BYOK governance for teams
  2. AI spend control and audit
  3. Agent ops for regulated or multi-model teams

  That is the cleanest commercial story because it matches what you already have and what buyers can understand quickly.

  Success metrics

  1. Time to first prompt under 10 minutes.
  2. One org can be onboarded without manual intervention.
  3. Every meaningful action has an audit record.
  4. Usage and spend are visible at org and user level.
  5. A buyer can tell the difference between the private ops console and the product.

  Practical sequence inside the repo

  1. Keep ops.carinaai.uk as the back office.
  2. Add a customer app or tenant shell on top of the same backend services.
  3. Share libraries, not UI assumptions.
  4. Enforce org scoping in the data layer, not just in views.
  5. Treat audit and billing as first-class data, not afterthoughts.

  My recommendation is to use this as the launch thesis:

  Carina is the BYOK AI governance and operations platform for teams that need control, evidence, and spend discipline.



 does this product not look like another labyrinth scout?


• It can, yes. If you market it as “AI governance” without a sharp boundary, it will read like Scout with a different coat of paint.

  The clean distinction is:

  - Labyrinth Scout: external trust and enforcement layer. It watches agents, detects risk, logs evidence, and can intervene.
  - Carina product: internal AI operations and control plane. It manages orgs, keys, usage, workbenches, models, runs, billing, and deployment state.

  So the product only feels like “another Scout” if you collapse those roles into one story. If you keep the boundaries clear, they are complementary:

  1. Scout answers: Is this agent safe, compliant, and observable?
  2. Carina answers: How do I build, run, pay for, and operate the AI system?

  My advice is to avoid selling Carina as governance first. Sell it as an AI operations platform with governance built in. That makes the relationship honest and makes Scout the stronger, more focused trust product.

  The clean commercial split is:

  - Scout: security and governance for autonomous agents
  - Carina: AI platform operations, BYOK, workflows, usage, billing, and admin

  If you want, I can write you a crisp positioning statement that makes the two products feel distinct instead of overlapping.


 yes do


• Use this split:

  Labyrinth Scout

  - “Governance and protection for autonomous agents.”
  - It watches, evaluates, proves, and intervenes.
  - It is the trust layer.

  Carina

  - “The AI operations control plane for teams that run models, keys, sessions, and spend.”
  - It manages workbenches, BYOK, orgs, deployments, usage, billing, and audit.
  - It is the operating layer.

  A tighter version for the two-product story:

  - Scout: “Prove your agents are safe.”
  - Carina: “Run your AI stack.”

  If you need a customer-facing positioning line for Carina, I would use:

  Carina is the AI operations platform for teams that need BYOK, usage control, workbenches, deployment tracking, and auditability in one place.

  And for Scout:

  Labyrinth Scout is the governance layer that monitors agents, enforces policy, and produces evidence.

  The boundary matters. Carina should feel like the system you use every day to operate AI. Scout should feel like the system you rely on when you need assurance, enforcement, and proof.


› carina ai is the ai, the ops.carina is the operations backend or dashboar. carina ops.


• Yes. That is the cleanest split.

  - Carina AI: the product, the agent, the user-facing AI experience
  - ops.carinaai.uk: the operations backend and internal dashboard for running Carina
  - Carina Ops: the control plane, support console, and admin surface

  That framing avoids the Scout overlap. Scout is about governance and protection. Carina is the AI. Carina Ops is how you operate it.

  A good shorthand is:

  - Carina AI runs the work
  - Carina Ops runs Carina

  If you want, I can turn that into a naming and positioning spec so the repo, docs, and UI all use the same language consistently.


› yes


• Use this as the naming and positioning spec.

  Brand Hierarchy

  - Carina AI: the product users interact with
  - Carina Ops: the internal operations console and control plane
  - Labyrinth Scout: the governance and protection layer

  One-line definitions

  - Carina AI: “The AI that gets work done.”
  - Carina Ops: “The control plane that runs Carina.”
  - Labyrinth Scout: “The governance layer that watches and protects autonomous agents.”

  Role boundaries

  - Carina AI handles conversations, tasks, automations, and user-facing assistance.
  - Carina Ops handles orgs, keys, models, deployments, usage, billing, environments, vaults, sessions, and support actions.
  - Labyrinth Scout handles monitoring, policy enforcement, incident detection, evidence, and intervention.

  What to call the ops product

  - Use Carina Ops in docs, UI copy, and internal language.
  - Use ops.carinaai.uk as the host only, not the product name by itself.
  - Avoid calling the ops dashboard just “admin” unless the context is clearly internal.

  What not to do

  - Do not describe Carina Ops as a second AI product.
  - Do not describe Carina Ops as governance-first.
  - Do not blur Carina Ops into Scout; they solve different problems.
  - Do not present ops.carinaai.uk as customer-facing unless that is explicitly the product plan.

  Suggested product language

  - Carina AI is the product.
  - Carina Ops is how you run it.
  - Scout is how you prove it is safe.

  UI label guidance

  - Product shell: Carina AI
  - Private admin nav: Carina Ops
  - Internal sections: AI Platform, Tenants, Security, Billing, Settings
  - Avoid generic labels like Dashboard as the only top-level brand signal

  Docs language

  - “Carina AI is the assistant and automation layer.”
  - “Carina Ops is the internal operations console for Carina AI.”
  - “Scout is the independent governance layer used alongside Carina when agent assurance is required.”

  Sales language

  - Carina AI: “Your AI assistant and automation layer.”
  - Carina Ops: “The internal control plane for running Carina AI at scale.”
  - Scout: “Governance and protection for autonomous agents.”

  Simple mental model

  - Carina AI: does the work
  - Carina Ops: runs the system
  - Scout: watches the system

  That naming structure is clean, commercially defensible, and it keeps the products from collapsing into one another.




 carina is curentlt free as a ai agen, how do we sell Carina OPS and a paid addon?


• Sell Carina as the free agent, and sell Carina Ops as the paid control plane around it.

  The clean model is:

  1. Carina stays free for individual use
      - chat, basic task help, personal workflows
      - low-friction adoption
      - no heavy admin, no team features

  2. Carina Ops is the paid product
      - org management
      - BYOK
      - usage tracking
      - model routing
      - workbench
      - deployments and environments
      - audit logs
      - vaults
      - role-based access
      - support tooling

  3. The paid addon should be the thing that makes Carina usable in a team or business setting
      - governance
      - cost control
      - visibility
      - compliance
      - central admin
      - multi-user ops

  The key is to make the free agent valuable on its own, but obviously incomplete for serious use. Then Carina Ops becomes the obvious upgrade when a user says: “I need to manage this for a team, control spend, or prove what happened.”

  What I would charge for:

  - team orgs
  - shared workbench
  - BYOK management
  - usage dashboards
  - audit history
  - secrets and vaults
  - deployment tracking
  - policy controls
  - retention and export
  - support and admin features

  What I would keep free:

  - basic agent access
  - personal use
  - simple chat or task workflows
  - limited history
  - limited runs
  - no team admin

  Best packaging:

  - Free: Carina
  - Paid addon: Carina Ops
  - Optional higher tier: Carina Ops Pro for compliance, retention, advanced audit, and SSO

  Best commercial story:

  - Carina helps one person work
  - Carina Ops helps a company run Carina safely and at scale

  Do not sell Carina Ops as “more AI.” Sell it as:

  - control
  - visibility
  - billing discipline
  - auditability
  - team administration

  That makes the addon feel necessary instead of optional polish.

  My recommendation is to keep the value boundary simple:

  - free = individual AI use
  - paid = operating AI as a system

  If you want, I can draft the exact pricing page structure and the feature split between free and paid tiers.
  
  
  in effect, i will have 3 products, carina ai (free), carina ops (paid addon) and labyrinth scout 9 (external security and governance platform)


• Yes. That is a coherent portfolio if you keep the boundaries strict.

  The structure should be:

  - Carina AI: the free agent product
  - Carina Ops: the paid control plane and admin addon for Carina
  - Labyrinth Scout 9: the external security and governance platform for autonomous agents

  That is commercially defensible because each product solves a different job:

  1. Carina AI
      - User-facing assistant
      - Free adoption layer
      - Top of funnel

  2. Carina Ops
      - Internal operating system for Carina
      - Paid upgrade for teams, orgs, and power users
      - Monetizes control, usage, billing, deployment, and admin

  3. Labyrinth Scout 9
      - Independent governance and protection layer
      - Sells to teams that need monitoring, enforcement, evidence, and control over agent risk
      - Can work with Carina or any other stack

  The main risk is overlap in the story. You avoid that by using one sentence per product:

  - Carina AI: “The AI that gets work done.”
  - Carina Ops: “The control plane that runs Carina.”
  - Labyrinth Scout 9: “Governance and protection for autonomous agents.”

  My advice is to market them as a ladder, not as three separate unrelated tools:

  - free user starts with Carina AI
  - team or business upgrades to Carina Ops
  - security or compliance buyer adds Labyrinth Scout 9

  That gives you a clean motion:

  - adoption
  - operationalization
  - governance

  The important part is to keep Carina Ops clearly attached to Carina AI, and keep Scout 9 clearly independent. If those two blur, the portfolio starts to feel confused. If they stay distinct, the three-product setup is strong.


we will carina ai and carina ops on https://carinaai.uk/ marketing site and scout on https://labyrinthscout.com/ marketing site.


• That is the right split.

  - carinaai.uk should market the free agent plus the paid ops addon as one commercial family.
  - labyrinthscout.com should stay separate and market security, governance, and protection.

  That gives you two clean acquisition motions:

  1. Carina AI and Carina Ops on one site, one story, one funnel.
  2. Labyrinth Scout on its own site, aimed at security and governance buyers.

  The key is to make the relationship explicit without muddling the products:

  - Carina AI: the free agent
  - Carina Ops: the paid control plane for teams using Carina
  - Scout: independent governance for autonomous agents

  I would structure carinaai.uk like this:

  - hero: Carina AI
  - secondary path: Carina Ops
  - clear upgrade path from free to paid
  - pricing that distinguishes personal use from team operations

  And labyrinthscout.com should stay focused on:

  - monitoring
  - policy enforcement
  - audit
  - evidence
  - incident response
  - governance

  That separation is commercially cleaner and avoids the “this is just another admin panel” problem. It also lets Scout keep its own security-first positioning while Carina carries the product and growth story.

  One practical rule: do not cross-sell Scout from the Carina homepage as the main message. Mention it as an optional companion for governance, not as part of the core pitch.



carina is free, scout is currently £99/mo, should carina ops addon be £ £49/mo ???


I have enough pricing references. I’m turning them into a concrete recommendation now, with an opinion on whether £49 should be the headline or just the entry tier.

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• £49/mo can work, but I would not make it the main price if Carina Ops includes org admin, BYOK, workbench, usage, audit, environments, vaults, and deployment tracking.

  Why: the market reference points for business AI control surfaces are already above or around that band. OpenAI prices business workspace products per user per month, and enterprise adds RBAC, SCIM, audit, retention, and spend controls
  (OpenAI pricing (https://chatgpt.com/pricing/)). Claude’s Team plan is $20 per seat monthly on annual billing, $25 monthly on monthly billing, with premium seats at $100 or $125, and enterprise includes spend limits, RBAC, audit logs,
  SCIM, and retention controls (Claude pricing (https://claude.com/pricing)). That tells you the value is not “cheap admin”; it is operational control.

  My recommendation:

  1. Use £49/mo as a starter tier
      - 1 org
      - limited users
      - limited usage or capped runs
      - core Ops surface only

  2. Put the real team price higher
      - £79/mo to £99/mo for a serious workspace tier
      - or £20 to £25/user/mo if you want a seat model that matches the market more closely

  3. Keep Scout separate at £99/mo
      - Scout is governance and protection
      - Carina Ops is operations and control
      - they should not feel like the same product at different prices

  My blunt view: if £49/mo is the only paid tier, it risks underpricing the product and making it feel small. If £49/mo is the entry tier and you also have a higher team tier, that is sensible.

  Best structure:

  - Carina AI: free
  - Carina Ops Starter: £49/mo
  - Carina Ops Team: £99/mo or per seat
  - Labyrinth Scout 9: £99/mo

  That gives you a clean ladder:
  free agent -> paid operations -> external governance.

  If you want a strong default, I would set the headline offer to £49/mo starting, then push serious buyers to a higher team plan.



























ASSESSMENT.

## Assessment

The document is **strong strategy, weak execution spec**. It reads like a well-reasoned advisory transcript, not a build plan. That is useful for direction, but it will not move the repo on its own.

### What it gets right

1. **The core insight is correct:** do not sell `ops.carinaai.uk` as-is. Sell a hosted control plane; keep ops as the private back office.
2. **The wedge is right:** BYOK + spend control + audit + team ops. That matches what you already have and what buyers understand.
3. **The three-product split is clean:**
   - Carina AI: free agent
   - Carina Ops: paid control plane
   - Scout: external governance
4. **The Scout boundary is important.** Without it, Carina Ops reads like "Scout with a dashboard."
5. **The 90-day roadmap is sensible in order:** tenancy first, billing second, marketing third.
6. **Pricing advice is sound:** £49 as Starter, £79-£99 for Team, Scout stays at £99.

### Where it is weak or optimistic

1. **It overstates readiness.** The doc talks as if the control plane is "credible" and close. In code, much of Phase 2 is not started in ops:
   - single admin password, no RBAC
   - `/ai-platform` is a prototype with one default org
   - memories, skills, RAG, chat in ops are global, not tenant-scoped
   - no tenant isolation tests in ops

2. **It blurs two apps that already exist.** You already have:
   - `ops.carinaai.uk`: VERLOX internal console
   - `app.carinaai.uk` in core: partial customer surface with register/login/billing

   The doc says "create a customer app" but does not say whether that means extending `app.carinaai.uk` or building something new. That decision matters now.

3. **No owner or acceptance tests.** Phases have exit criteria, but no file paths, schema changes, or "done when X test passes."

4. **Marketing is sequenced too late.** You can draft positioning and pricing now without building SSO or a workflow builder.

5. **It underplays the hardest part:** org membership, RBAC, and enforced row-level isolation everywhere. That is the real product, not the workbench UI.

### Reality check against the repo

| Strategy claim | Current state |
|---|---|
| Tenant provisioning | Partial: `hosted_users`, per-tenant schemas, BYOK |
| Customer app exists | Partial: core gateway at `app.carinaai.uk` |
| RBAC | Missing |
| Billing | Core has Stripe; ops is manual override + read views |
| Audit | Ops admin audit exists; not full product audit |
| AI Platform as product surface | Prototype inside private ops, single org |
| Tenant isolation tests | Missing in ops |

**Bottom line:** the strategy is commercially coherent. The gap is implementation discipline and a single architectural decision about where the customer product lives.

---

## How to proceed

Treat the doc as a **positioning + phase model**, then replace it with a short implementation brief.

### 1. Lock the product decision (1 meeting, not 1 month)

Answer these in writing:

- **Product name:** Carina Ops
- **Buyer:** team lead or platform owner running Carina for a business
- **Promise:** "Bring your own keys, govern usage, audit everything, control spend."
- **Not selling:** raw ops dashboard, governance-first story, Scout overlap

### 2. Choose the customer surface architecture

Recommended path:

```
ops.carinaai.uk     -> VERLOX back office only (support, provisioning, overrides)
app.carinaai.uk      -> customer Carina Ops product (extend core gateway)
shared libraries     -> tenancy, billing, vault, audit in core or shared package
```

Do **not** expose `/ai-platform` from ops to customers. Rebuild or port the useful parts into the customer app.

### 3. Execute in this order

**Now (Days 1-14): make tenancy real**
- org + membership tables
- roles: owner, admin, operator, auditor, viewer
- every query scoped by `org_id` / `tenant_id`
- isolation tests that fail if cross-tenant read is possible

**Next (Days 15-30): make the paid surface usable**
- customer login at `app.carinaai.uk`
- BYOK vault
- workbench
- usage + credits
- audit log
- org settings

**Then (Days 31-60): make it sellable**
- Stripe plans wired to feature gates
- self-serve onboarding
- exports
- internal support tools in ops only

**Last (Days 61-90): make it marketable**
- `carinaai.uk` pricing page
- demo path
- 3-5 design partners

---

## What to do immediately

If you only do five things this week, do these:

### 1. Write a one-page product brief
Freeze:
- Carina AI = free
- Carina Ops = paid addon
- Scout = separate governance product
- Starter £49, Team £99, Scout £99

Put it in `instructions/strategy/CARINA_OPS_PRODUCT_BRIEF.md`. The current doc is too long to drive engineering.

### 2. Draw the boundary matrix
Two columns: **Customer (app.carinaai.uk)** vs **Internal (ops.carinaai.uk)**.

Examples:
- Customer: workbench, usage, vault, audit, org settings
- Internal: tenant provisioning, manual plan override, Scout kill switch, DB repair, impersonation

This stops `/ai-platform` from becoming the accidental product.

### 3. Start Phase 2 schema, not UI polish
Add to core/hosted schema:
- `organizations`
- `org_memberships` with role
- `org_id` on every product table that lacks it
- middleware that sets tenant context on every request

No new features until a test proves tenant A cannot read tenant B data.

### 4. Stop expanding ops as the customer app
Freeze new customer-facing work inside `ops.carinaai.uk`. Use ops only for:
- tenant create/support
- subscription override
- security/Scout proxy
- internal analytics

Port workbench/usage/vault into the customer path.

### 5. Update marketing copy only at headline level
On `carinaai.uk`, add the ladder without building checkout yet:
- Carina AI: free
- Carina Ops: team control plane
- Scout: optional governance companion

You can sell the story before every gate is wired.

---

## My blunt recommendation

**Do not try to productize the ops dashboard UI.** Productize the **capabilities behind it** as Carina Ops on `app.carinaai.uk`, with ops staying private.

The immediate blocker is not pricing, landing pages, or workbench polish. It is:

> Can a stranger sign up, join an org, add a key, run a prompt, and only ever see their own data?

Until that is true with tests, everything else is packaging a service engagement as SaaS.

If useful, I can turn this into:
1. a one-page `CARINA_OPS_PRODUCT_BRIEF.md`, or
2. a Week 1 engineering checklist with exact schema/routes/tests mapped to your repo.
