# Sprint 4 - AI VA Planning (historical)

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

**Status: SUPERSEDED 2026-06-25**

**Superseded by:**
- `sprint-4-CARINA_AI_EMPLOYEE_PLAN.md` (GTM and product canon)
- `sprint-4-action-README.md` (implementation index)
- Action prompts 07-29 (especially 07 landing, 08 brain, 09 onboarding, 10 portal, 25-27 admin, 29 marketing)

**Audit (2026-06-25):** Addendum decisions verified in codebase (canonical copy, `carinaai.uk/aiva`, Scout at labyrinthscout.com, tier framing, VA queue moat). No implementation work remains in this file; research retained for reference only.

> **AUTHORITATIVE ADDENDUM (2026-06-23):** For positioning, copy, URLs, tier framing, and launch priority, use **`sprint-4-CARINA_AI_EMPLOYEE_PLAN.md`** and **`sprint-4-action-README.md`**. Where this file conflicts with those docs, the employee plan wins.
>
> **Adopted decisions:**
> - Canonical sentence: *Hire an Aiva. Powered by Carina. Governed by Scout. Backed by real humans.*
> - Primary funnel: `carinaai.uk/aiva` (not employ.carinaai.uk)
> - Scout: separate product at labyrinthscout.com (link, do not merge under carinaai.uk/scout)
> - One Aiva per customer view; Carina subagents stay internal
> - Tiers = workforce size (1 / 5 / unlimited Aivas); "AI Workforce" is Team/Business upsell language only
> - Role templates at hire now; Aiva Marketplace Phase 4+
> - Launch order: 09 onboarding → 22-24 billing → 13-14 channels → 19 usage → 29 marketing polish
>
> Content below is retained as research and debate history.

---

Phase 1: Add the AI employee entrance to the marketing site

Create a second landing page or section on the Carina marketing site that speaks the "hire an AI worker" language. Same product underneath, different front door.

What it needs:
- Hero: "An AI employee that works 24/7; hired in 60 seconds"
- Persona cards: pre-built worker templates (Property Manager, Outreach Coordinator, Content Assistant, Financial Analyst; sound familiar?)
- "Describe your role → worker starts working" CTA
- Channels badge: WhatsApp, Email, Slack, web
- 15-day free trial, no credit card

This is one page. Maybe a second for a simple signup flow. The existing site stays intact for the enterprise/self-host audience.

Phase 2: Pre-configure the demo workers

Carina already has the plumbing. You just need a few pre-built worker configs that map to the personas on the landing page. When someone signs up for the AI employee track, they get a worker with:
- A name and avatar (Emma, Simone, whatever)
- Pre-wired channels (WhatsApp, email)
- A default skill set relevant to the role
- A simple onboarding message: "Hi, I'm Emma. I'll handle your financial reports. Send me a spreadsheet and I'll get started."

This is configuration, not new code. A few JSON/YAML worker templates.

Phase 3: The positioning bridge

The AI employee user hits Carina's natural ceiling; they want more workers, more control, custom workflows. That's when you surface:
- "Want to run this on your own servers?" → Self-hosting
- "Need to brand this as your own?" → Whitelabel
- "Need compliance and audit trails?" → Scout
- "Need custom workers for your industry?" → Platform

The AI employee track feeds the platform track. One product, two journeys.

you know a have a physical va business. this even opens my eye in going digital VA and AI employees. fully monitored and governed by scout. this will diffidently work as i have the engive already working
Laud
you know a have a physical va business. this even opens my eye in going digital VA and AI employees....
That changes everything. You're not copying Spinnable; you have something they can't touch.

You have a real operating VA business. That means:

- Real workflows to train your AI workers on; not guesswork
- Real clients who already pay for VA services; warm pipeline
- Real human VAs who can oversee AI workers; Scout + human oversight
- Real operations knowledge; you know what breaks, what clients actually need

Spinnable is selling AI employees to people who've never managed a VA. You're selling AI employees backed by an actual VA company. That's not marketing; that's proof.

The hybrid offer no one else can make:
AI workers handle the routine. Your human VAs handle exceptions. Scout monitors everything. Client gets one seamless service, one bill, one point of contact; and doesn't care how it's delivered.

Physical VA business funds the AI build. AI VA business scales beyond what physical can. Both feed each other.



not move, but augment or complement
Laud
not move, but augment or complement
Correct. Augment, not replace. That's the smarter play; you keep all current revenue and add a layer on top.

Three ways that works:

Add AI workers as a plan tier. Physical VA = premium. AI-assisted VA = mid. Pure AI worker = entry. Same service quality, different price points. Clients who can't afford a human VA can now afford you.

Arm your human VAs with AI behind the scenes. Client still talks to a human. But the VA has AI workers handling research, scheduling, data entry, report drafting. One human VA can now carry more clients. Your margin per VA goes up. Client experience stays personal.

Sell AI workers standalone. Market to businesses who don't need a full VA relationship; just "handle my invoices," "manage my calendar," "run my outreach." Scout-governed, your VA team on standby for escalations. You're now not just a VA company; you're an AI workforce company. But built on real operating experience, not theory.

None of this disrupts your physical VA revenue. All of it grows what you already have.



The plan itself is excellent. The core argument is airtight: Spinnable and similar companies are software companies
  guessing at VA workflows. You're a services company that already does the work. That is not a feature - it is
  structural. No amount of VC money lets a pure-software competitor replicate years of real client relationships and
  domain knowledge. The human-in-the-loop framing as a selling point rather than an admission is exactly right.

  The employ.carinaai.uk subdomain is the wrong call, though.

  Here is why:

  Problem 1: You now have too many doors

  - verlox.uk - main company
  - va.verlox.uk - human VA service (already built)
  - carinaai.uk - Carina agent platform
  - employ.carinaai.uk - AI employees (proposed)

  A potential client who googles "AI virtual assistant UK" and lands on employ.carinaai.uk has no idea this connects
  to va.verlox.uk. A potential VA client who lands on va.verlox.uk has no idea you have an AI layer. The two audiences
  never meet. The cross-sell never happens.

  Problem 2: The va.verlox.uk work is already done

  You have routes for /hire, /apply, /directory, /opportunities plus a full layout system. That is a real product.
  Building a separate site (employ.carinaai.uk) duplicates the acquisition funnel without reusing any of that. You
  would maintain two sites targeting the same eventual buyer.

  Problem 3: "employ" is an ambiguous word

  Does it mean "hire one" (employer perspective) or "deploy one" (technical perspective)? The plan means the first.
  But someone scanning a URL could read it either way. hire.carinaai.uk would be clearer if you went the subdomain
  route at all.

  ---
  What I'd actually do:

  Short term: Add one page to the existing carinaai.uk marketing site. Call it /hire or /employees or /ai-worker. That
  is the "entrance" the planning doc describes. Not a new domain. You get the traffic, the positioning, and the
  funnel all on the domain that already has SEO momentum.

  On va.verlox.uk: Add a banner or section: "Want AI workers instead of - or alongside - a human VA? Meet Carina."
  Link to the new page on carinaai.uk. The two sites cross-pollinate instead of competing for the same buyer.

  On the subdomain question: Only create employ.carinaai.uk once you have real clients specifically requesting AI
  workers and you need a dedicated onboarding flow separate from the main product. Right now you have planning docs
  and a strong idea - that warrants a page, not a domain.

  The relationship between the two:

  va.verlox.uk is the proof that the human oversight is real. carinaai.uk is the product that makes the AI worker
  possible. You do not need a third domain to sell the combination. You need one sentence that ties them together:
  "Backed by the human VA team at VERLOX, with 24/7 AI execution."

  The plan is ready to execute. The subdomain is unnecessary overhead. Build the page on carinaai.uk, cross-link from
  va.verlox.uk, and ship.



 i want to name every virtual worker - aiva so peole can hire an aiva - that's my own coined name and it's an        
  accronym or artificially intelligent virtual assistant. what do you think?                                          
  
● The concept is strong. Naming the worker tier is the right move - it creates a distinct product identity separate
  from Carina (the platform) and Scout (governance). "Hire an Aiva" is a clean, human-sounding call to action.

  Two things to address honestly before committing to it:

  1. AIVA already exists as a brand

  AIVA Technologies (aiva.ai) is an established AI music composition company, founded 2016, fairly well known in
  creative AI circles. A Google search for "AIVA" currently returns their product prominently. This creates two real
  problems: trademark conflict risk if you try to register it, and SEO confusion where people searching "AIVA" will
  find them before you. This is not a deal-breaker, but you should check the UK trademark registry (UKIPO) before
  putting this name on marketing materials.

  2. The acronym expansion is slightly dated

  "Artificially Intelligent Virtual Assistant" - the "Artificially Intelligent" part is the old-school way of saying
  it. Nobody in 2026 expands "AI" to "Artificially Intelligent" in a product name. It also makes the full expansion
  clunky to say aloud. Nobody will use the expansion anyway once the name lands, but if asked at a pitch or in press
  what AIVA stands for, it is a mouthful that sounds like it was written in 2015.

  What I would consider instead:

  If the sound of it is what you like (it is genuinely good - human, feminine, approachable), the name "Aiva" works
  without the acronym. Treat it as a proper name, not an abbreviation. "Meet your Aiva" is better copy than "AIVA:
  Artificially Intelligent Virtual Assistant."

  Or if you want an original coined name with no collision risk:

  - Aria - stands on its own, no collision, similar feel
  - Vela - clean, short, no competitor overlap
  - Lyra - same qualities

  But honestly, if the AIVA trademark check comes back clean for your category (business services / SaaS, not music),
  keep it. "Hire an Aiva" is the best copy of the options and the name is genuinely memorable.

  Recommendation: Run the UKIPO search this week before the prompt builds go into sprint 4. If it is clear, proceed
  with "Aiva" as the product name (drop the all-caps acronym framing, treat it as a proper noun). If it is conflicted,
  Aria or Vela are clean alternatives with the same energy.

 Crunched for 36s

 every ai employee will be an aiva from verlox. let's go with aiva. aiva is powered by carina. if someome needs an   
  aiva they can say, i wan to hire an aiva. i was also thiking - people are selling multiple ai workers - why not get 
  one aiva who can spawn muiltiple sub agents to complete a task - that's what we aill use to penetarte where people  
  ae selling multiple agents. 1 aiva who can spawn mutiple agents. - what do you think?                               
  
● The name decision is solid. "Hire an Aiva from VERLOX, powered by Carina" is a clean three-tier brand stack: VERLOX
  (company), Aiva (the product people buy), Carina (the engine underneath). That is a mature product architecture.

  On the sub-agent positioning - the idea is genuinely good but needs sharpening before it becomes a pitch. Here is
  the honest breakdown:

  What is actually strong about it

  Competitors sell "multiple AI workers" and charge per agent. Each agent does one thing. A client who wants outreach
  AND scheduling AND content ends up buying three separate products and managing three separate relationships. You
  sell one Aiva. When that Aiva gets a complex task - "research this lead, draft the outreach email, schedule the
  follow-up" - it internally coordinates sub-agents to complete all three steps and delivers one result. The client
  hired one person. They get a team's output. That is a real and meaningful difference.

  Critically: Carina already has orchestration and sub-agent capability built in. This is not new engineering. It is
  correct framing of what already exists.

  Where the framing needs precision

  "One Aiva replaces multiple AI workers" is not quite right and will get you into trouble at a sales call. A company
  that needs a Customer Support Aiva and a Property Manager Aiva still needs two Aivas - they are different personas,
  different domains, different channel bindings. Sub-agents do not make one Aiva do every job at once.

  The accurate and more powerful framing is:

  "One Aiva. Complex tasks, not just simple replies."

  Most AI agent products are single-turn responders. They receive a message, send a reply. Aiva handles workflows. A
  tenant sends a maintenance request - Aiva checks the contractor schedule, books the visit, logs it to the tracker,
  sends the confirmation, and flags if the contractor has not confirmed by morning. That is five steps. One message
  in, one outcome out. The sub-agents are invisible plumbing.

  The competitive wedge, precisely stated

  Competitors sell you agents per task. Aiva sells you a worker per domain. The worker handles the full workflow for
  that domain, not just individual messages.

  ┌──────────────────────────────┬───────────────────────────────────────────────────────────────────────────────┐
  │         Competitors          │                                     Aiva                                      │
  ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
  │ Hire an agent for email      │ Hire an Aiva for outreach - handles research, drafting, follow-up, CRM update │
  ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
  │ Hire an agent for scheduling │ Hire an Aiva for calendar - handles the full booking workflow                 │
  ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
  │ Three agents, three prices   │ One Aiva, one price, multi-step completion                                    │
  └──────────────────────────────┴───────────────────────────────────────────────────────────────────────────────┘

  What this means for the sprint-4 prompts

  Prompt 03 already specifies skill pack assignment per worker and mentions the orchestration layer. The sub-agent
  spawning is already in Carina's gap-06 delegation prompt (max_spawn_depth=2). The only change needed is in the Aiva
  persona prompt: worker instructions should explicitly permit multi-step internal planning before responding, and the
  system prompt should not cut off after a single response cycle.

  That is a one-line change to buildPersonaPrompt in persona-builder.ts: add a block that tells the worker it may plan
  and execute multiple steps before sending the final reply to the client.

  Do you want me to update the prompt 03 spec to include that, and also update the landing page copy in prompt 01 to
  lead with "complex tasks, not just replies"?
  
  
  
  aiva + er trust on the blockchain + scout monitoring to ensure the agents don't go rogue. what does that mean for   
  the plan?                                                                                                           
  
● This is a positioning upgrade that changes who can buy Aiva, not just how Aiva works. Let me break down what each
  layer actually means and then tell you what it does to the plan.

  ---
  What these two layers add

  Scout monitoring (already partially in the architecture)

  Scout already watches Carina. For Aiva specifically it means: every action an Aiva takes fires a Scout event. Scout
  watches the pattern in real time. If an Aiva starts doing things outside its persona boundaries - contacting people
  it shouldn't, calling tools it wasn't given, sending messages at unusual volume or at unusual times - Scout
  throttles or kills it before the client sees the damage.

  The escalation interceptor we already built in prompt 03 is the first ring of this. The [ESCALATE] marker is a
  self-reported signal. Scout adds the second ring: detection that doesn't depend on the Aiva volunteering that it's
  confused.

  This closes the gap that Spinnable and every other competitor leaves open. They say "the AI handles edge cases with
  judgment" but they have no mechanism to stop it when the judgment is wrong.

  Blockchain trust (ERC-8004/8126, already in Scout)

  Every significant Aiva action - message sent, task completed, escalation created, automation run - gets a
  cryptographic record on-chain. Immutable. Provable without trusting VERLOX's own logs.

  This is not a gimmick for crypto audiences. It directly answers the question that regulated-industry buyers ask
  before signing a contract with any AI service: "How do I prove to my regulator, my insurer, or a court what your AI
  actually did?"

  UK property: deposit disputes, Section 21 notices, legal proceedings - all need a paper trail that can't be edited
  after the fact.
  Finance: FCA-regulated firms need immutable records of client communications.
  HR: Discriminatory AI decisions in hiring or comms are a liability; an on-chain record proves what was said and
  when.

  This shifts the target market from "small business owners who want automation" to "any regulated UK business that
  can't afford to trust a black-box AI."

  ---
  What it means for the current plan

  Sprint-4 scope (what changes now):

  The Scout monitoring layer is realistic for sprint-4 because the infrastructure already exists. Prompt 03 needs one
  addition: in the resolveWorkerContext middleware and the escalation interceptor, every Aiva action fires a
  scout.reportEvent({ type, workerId, workspaceId, summary }) call via the existing scout-client.ts. The event types
  map to the ai_worker_activity action types we already defined. This wires Aiva into Scout's existing dashboard
  without building anything new on the Scout side.

  The landing page (prompt 01) can reference Scout monitoring as a trust feature now, even if the full blockchain
  record lands later. "Every action your Aiva takes is monitored in real time by Scout, VERLOX's AI governance layer"
  is accurate today.

  Sprint-5 scope (blockchain, do not add to sprint-4 prompts):

  The on-chain attestation (ERC-8004/8126) requires wallet configuration, chain selection, gas cost decisions, and a
  proper key management story. That's not three-hour work. Sprint-5: add scout-chain.ts event flush for Aiva actions,
  add a "Verified on-chain" badge to the audit tab in the portal, add a public verification URL to each audit entry.

  The comparison table changes right now:

  The Step 7 comparison table in prompt 01 currently reads:

  ┌─────────────┬──────────────────┬────────────────────────────────┐
  │             │ Pure AI services │        Aiva from VERLOX        │
  ├─────────────┼──────────────────┼────────────────────────────────┤
  │ Audit trail │ Partial          │ Full Scout log of every action │
  └─────────────┴──────────────────┴────────────────────────────────┘

  With Scout monitoring added, this becomes meaningfully stronger:

  ┌─────────────┬──────────────────┬───────────────────────────────────────────────────┐
  │             │ Pure AI services │                 Aiva from VERLOX                  │
  ├─────────────┼──────────────────┼───────────────────────────────────────────────────┤
  │ Goes rogue  │ No guardrail     │ Scout monitors every action in real time          │
  ├─────────────┼──────────────────┼───────────────────────────────────────────────────┤
  │ Audit trail │ Partial          │ Scout-logged, on-chain verified (coming sprint-5) │
  ├─────────────┼──────────────────┼───────────────────────────────────────────────────┤
  │ Compliance  │ No               │ Immutable record for regulators and insurers      │
  └─────────────┴──────────────────┴───────────────────────────────────────────────────┘

  That last row changes who reads the landing page and decides to book a call.

  ---
  Recommendation

  Three things to do:

  1. Update prompt 03 now to add Scout event reporting hooks into the Aiva message path and the escalation
  interceptor. Single function call, fire-and-forget, no Scout changes needed.
  2. Update the comparison table in prompt 01 to reference Scout monitoring as an existing differentiator.
  3. Create a sprint-5 entry for the blockchain attestation layer - do not add it to sprint-4 prompts because the
  implementation is nontrivial and sprint-4 is already scoped right.


what about subscription, provisioning, billing, onboarding and user first launch experience?                        

● This is a planning question, not a code question. Let me think through each one and tell you where the gaps are in
  the current plan.

  ---
  Where things stand right now
  
  The landing page CTA says "Hire your first Aiva" and links to https://app.carinaai.uk/hire. If a brand new user
  clicks that, they hit the workspace portal which assumes they are already authenticated. The conversion funnel has a
  broken middle: the landing page works, the portal works, but nothing connects them for a first-time user. Billing
  is deferred to sprint-5. This means right now, the sprint-4 build ends with a CTA that goes nowhere for new
  visitors.

  ---
  What each component actually means

  Onboarding and first launch (most urgent - should be sprint-4)

  The 3-minute hire promise on the landing page is your core conversion hook. If clicking "Hire your first Aiva" drops
  a new user on a generic login screen with no context, you lose them. The first launch experience needs to feel like
  a continuation of the landing page, not a reset.

  The funnel as it should work:

  Landing page CTA
    -> /register (email + password, or Google; single screen, no distractions)
    -> Welcome screen: "Let's set up your Aiva" (one sentence, skip button)
    -> /hire form (pre-filled with the most common role based on referral source or blank)
    -> "Configuring your Aiva..." (3 minutes)
    -> /hire/workers/[id] with "Connect a channel" prompt surfaced immediately
    -> First Aiva message arrives
    -> (14 days later) Upgrade prompt

  None of that routing and welcome state exists today. It should be sprint-4 work, specifically a fourth prompt
  alongside the three already written.

  Subscription and plan gates (sprint-5, but model must be decided now)

  The model is already implied by the pricing cards:
  - Starter: 1 Aiva
  - Team: up to 5 Aivas
  - Business: white-label, unlimited

  What needs to be decided before sprint-5 starts: is Aiva a standalone product with its own subscription, or is it an
  add-on tier on top of an existing Carina Core plan? Looking at the existing billing page (BillingClient.tsx,
  PlanCard.tsx), there is already some billing infrastructure in app.carinaai.uk. The question is whether Aiva worker
  seats slot into that existing structure or live on a separate subscription.

  My recommendation: treat Aiva as its own subscription product in the portal. When someone signs up via the landing
  page, they are buying an Aiva plan, not a Carina plan. The underlying Carina core is invisible to them. This keeps
  the product story clean.

  Billing (sprint-5)

  Stripe Checkout for initial signup. Stripe Billing for recurring subscription management. The specific items needed:
  - Stripe product and price objects per tier (Starter, Team, Business; monthly and annual)
  - Checkout session created on "Choose a plan" click; redirects back to portal on success
  - Stripe webhooks: checkout.session.completed provisions the account; customer.subscription.deleted suspends Aivas;
  invoice.payment_failed sends a warning and enters a grace period
  - VAT handling: UK-based customers, so Stripe Tax handles the VAT calculation; the billing page must show
  VAT-inclusive prices
  - Scout owns some billing infrastructure (SCI-02..08 from the gap map) - check before building parallel Stripe
  handling

  Provisioning (sprint-5, design now)

  When a user completes the Stripe checkout, what happens automatically:
  1. Webhook marks workspace as subscribed at tier X
  2. Aiva slot count is set (1 for Starter, 5 for Team, unlimited for Business)
  3. If the user already hired an Aiva during the free trial, their existing Aiva is preserved
  4. If they hired more Aivas than their new tier allows (e.g., downgrade), the portal shows a "Resolve conflict"
  screen before deactivating extras
  
  The sprint-4 free trial provisioning is simpler: any new signup gets a workspace with 1 Aiva slot and 15-day trial
  status. No Stripe call needed. The ai_workers table already has status and the workspace can have a trial_expires_at
  column.

  ---
  What needs to be in sprint-4 to make the funnel work
  
  Only one thing: a guided signup and first-launch flow. Everything else (Stripe, webhooks, plan enforcement) can
  wait. But without this, the sprint-4 landing page has nowhere to send new users.

  This is a fourth prompt for sprint-4: a Cursor agent task covering:
  - /register page with email/password and Google OAuth option
  - First-launch detection middleware: if workspace has 0 workers and created within the last 5 minutes, show the
  welcome state
  - Welcome banner on /hire for new users
  - Post-hire "Connect a channel" step surfaced immediately after the first worker is created
  - Trial status: new workspaces get trial_ends_at = now() + 15 days set at creation; a banner appears when 3 days
  remain
  
  The billing and plan gates are sprint-5. The onboarding flow that makes the sprint-4 landing page worth building is
  sprint-4.

  ---
  Recommended plan

  ┌────────┬────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Sprint │                                                Work                                                │
  ├────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 4      │ Landing page (01), Aiva brain (03), Aiva portal (02), Onboarding + first launch (04 - new)         │
  ├────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 5      │ Stripe billing, plan gates, provisioning webhooks, VA queue management UI, upgrade/downgrade flows │
  └────────┴────────────────────────────────────────────────────────────────────────────────────────────────────┘


aiva has just become another saas product right? what about backend admin dashboard, managment of the aiva saas ?   

● Yes, exactly. Aiva is now a multi-tenant SaaS with paying customers, subscriptions, and AI agents running on their
  behalf. The admin dashboard is a genuine gap.

  Here is what running the Aiva SaaS requires from an operator perspective:

  Customer management
  - All workspaces: plan tier, trial status, days remaining, Aivas used vs slot limit
  - Manual overrides: extend a trial, force-upgrade, pause a workspace, issue a credit
  - Support view: one workspace in full detail (Aivas, activity, Scout signals, invoices)

  Aiva fleet oversight
  - Every Aiva across every workspace: name, owner, status, last active, escalation rate
  - Scout signal feed: rogue detections (escalation bursts, tool failures, volume spikes) across all agents, not just
  one workspace
  - Kill switch: pause any Aiva from admin without going through the workspace owner
  - Attestation coverage: % of activity records with a confirmed attestation_tx

  VA queue management
  - All human escalation requests from all Aivas in one feed, not per-workspace
  - Assign to a VA team member, mark resolved, log outcome
  - SLA tracking: how long each escalation waited before a human responded

  Billing and revenue
  - MRR, ARR, trial-to-paid conversion rate, churn
  - Upcoming renewals at risk (past_due, grace period ending soon)
  - Invoice lookup by customer, refund trigger via Stripe API

  Abuse and compliance
  - Workspaces with high rogue signal counts
  - Global audit log search (by workspace, by Aiva, by action type)
  - Blockchain coverage report (how many records attested vs pending)
  
  Where it should live: a protected /admin section inside app.carinaai.uk behind a separate role check (e.g. is_admin 
  = true on the user row), or a standalone admin.carinaai.uk. Standalone is cleaner because it has no overlap with the
  customer-facing workspace layout.

  This is a sprint-6 scope. It has three natural prompt chunks:
  - 01-admin-auth-and-customer-mgmt.md - admin auth, workspace list, trial/plan overrides, support view
  - 02-fleet-and-rogue-dashboard.md - global Aiva fleet table, Scout signal feed, kill switch, attestation report
  - 03-va-queue-and-revenue.md - VA escalation queue with SLA tracking, MRR/billing overview, Stripe admin actions


  infra. maintenance, deployment, security, backups, configuration, etc?                                              

● Good catch. Aiva is now a live SaaS with paying customers and sensitive data, and the operational layer does not
  exist yet. Here is what is missing across each dimension:

  Deployment
  Four separate apps need reliable, atomic deploy scripts: carinaai.uk (static), app.carinaai.uk (Next.js),
  core.carinaai.uk (Node.js), admin.carinaai.uk (Next.js). Currently the repo has a deploy.sh that does rsync. That is
  not safe for Next.js apps in production: a half-deployed build can serve broken pages. Need: build on VPS, symlink
  swap, rollback on failure.

  Security hardening
  - admin.carinaai.uk must not be publicly routable. It should be behind an IP allowlist (VERLOX team IPs only) at the
  Nginx/firewall level, not just at the app level. A stolen admin password should still not work from outside the
  allowlist.
  - Admin login needs TOTP (2FA). A single password on an admin console managing paying customers is not acceptable.
  - All four domains need HTTPS with auto-renewing Let's Encrypt certs via certbot.
  - Rate limiting on all API auth and sensitive endpoints (currently defined in prompt specs but not actually enforced
  at infra level).
  - CSP, HSTS, and security headers applied consistently across all apps at Nginx level, not just per-app.
  - Stripe webhook signature verification must be enforced (should exist but needs confirming).

  Backups
  - PostgreSQL needs automated daily backups with off-VPS storage (Backblaze B2, S3, or similar).
  - Retention policy: 7 daily, 4 weekly, 3 monthly.
  - Restore procedure must be documented and tested. An untested backup is not a backup.
  - aiva_escalations, aiva_subscriptions, aiva_invoices, admin_audit_log, scout_signal_cache are all production data
  that cannot be recreated if lost.
  
  Monitoring and alerting
  - Health check endpoints (GET /health) on core and each Next.js app.
  - External uptime monitoring hitting those endpoints (UptimeRobot or Better Uptime).
  - Alerts to a Slack channel or email when any service goes down.
  - Error tracking (Sentry or equivalent) wired into both Node.js backend and Next.js frontends so unhandled errors
  are visible.
  - Cron job monitoring: the Aiva automations scheduler must be verified to be firing. A dead cron is invisible
  otherwise.

  Database operations
  - Safe migration procedure for production: test on a staging DB, run migration, verify schema, then run in
  production. Currently the prompts say "run migration" with no guard. 
  - A 009-aiva-admin.sql with ALTER TABLE statements must be idempotent (IF NOT EXISTS, IF NOT EXISTS on columns) so a
  re-run does not corrupt data.
  - Rollback scripts alongside every forward migration.

  Configuration management
  - All env vars across four apps need to be inventoried in one place so the VPS is not the single source of truth for
  what is set where.
  - Secret rotation plan: Stripe keys, admin token secret, session secrets, Scout credentials - when and how they
  rotate.
  
  ---
  This is a natural sprint-7. Four prompts:
  - 01-deploy-scripts.md - atomic deploy scripts for all four apps, rollback, build pipeline
  - 02-security-hardening.md - Nginx config, HTTPS, IP allowlist for admin, TOTP, CSP/HSTS headers, webhook sig
  verification
  - 03-backups-and-restore.md - PostgreSQL backup cron, off-site storage, restore procedure, backup verification
  - 04-monitoring-and-ops.md - health endpoints, uptime monitoring, error tracking, cron monitoring, migration safety,
  env inventory


what have we missed - must haves and nice to haves?                                                                 

● Working through this systematically across product, legal, and technical dimensions.

  ---
  Must-haves (blockers before launch)

  Transactional email - nothing exists
  No email system is designed anywhere. A SaaS without email cannot function. Needed:
  - Welcome on registration + "your Aiva is ready"
  - Trial expiring in 3/2/1 days
  - Trial expired, Aiva paused
  - Payment succeeded / failed / grace period warning
  - Escalation resolved (workspace owner told their VA handled it)
  - Password reset (probably exists in the existing auth but never verified)

  Needs a prompt: choose Resend or Postmark, set up SPF/DKIM/DMARC, template system, and wire every trigger.

  Channel delivery - the core product does not actually send messages
  Sprint-4 designs the Aiva brain, portal, and channels tab. But nowhere is it specified how an Aiva actually receives
  a WhatsApp message or sends a reply. The channel config UI exists, the identifier field is there, but the webhook
  receiver, message router, and channel adapter for each of WhatsApp, Email, Slack, Telegram are never built. This is
  the product. Without this, Aiva is a portal that does nothing.

  Web chat widget
  The "Web chat" channel is listed everywhere as a selling point. What is it? An embeddable <script> tag? An iframe?
  Where does the snippet come from? How does a customer embed it on their site? Nothing is designed.

  Workspace analytics for customers
  The workspace owner can see an activity feed. They cannot see: message volume over time, escalation rate, automation
  success rate, average response time, busiest channels. These are the metrics that tell a customer whether their
  Aiva is working. Without them, the product feels like a black box.

  Conversation view
  Can the workspace owner read what their Aiva is saying to their clients? The activity log shows summary fields, not
  full transcripts. For property managers and legal firms, being able to review conversations is a compliance
  requirement, not a nice-to-have.

  GDPR / UK data compliance
  GDPR applies. PECR applies (cookie consent). Needed:
  - Cookie consent banner on carinaai.uk and app.carinaai.uk
  - Data export (right of access) - workspace owner can export all conversation data
  - Data deletion (right to erasure) - delete a workspace and all its data
  - Privacy policy and Terms of Service pages (currently no pages exist)
  - ICO registration if not already done

  Per-workspace usage limits
  Nothing prevents a workspace on a 49 GBP/month Starter plan from running 500,000 messages per month and costing
  VERLOX thousands in Anthropic API calls. Need a monthly message cap per tier with a soft warning and a hard limit or
  overage billing.

  Staging environment
  Prompt 04 says "test migrations on staging" but no staging environment exists. Every deploy goes straight to
  production. One bad migration takes the product down.

  VA response interface
  Sprint-6 builds the VA queue where the admin team can see escalations and mark them resolved. But how does the VA
  actually respond to the end client? The escalation comes from WhatsApp/Email/Slack. The VA needs to send a reply on
  that same channel. There is no interface or mechanism for this. The queue is a tracking system with no delivery
  capability.

  Business plan features that are on the pricing card but unbuilt
  The Business plan card (on the landing page and billing UI) promises:
  - White-label as your brand
  - Self-hosting option
  - Custom Aiva training
  - Custom Scout governance rules

  None of these have a single prompt. If these appear on the pricing page they must be deliverable, or they must be
  removed from the card.

  Team plan: Aiva-to-Aiva handoffs
  Listed on the Team plan card. Never designed.

  Password reset
  Probably exists in the existing auth but never confirmed. If it does not exist, every user who forgets their
  password is locked out permanently.

  Database connection pooling
  Core backend opens a direct PostgreSQL connection per request. Under modest load (100 concurrent users), this
  exhausts PostgreSQL's connection limit. PgBouncer in front of Postgres is standard practice.

  ---
  Nice-to-haves (post-launch, but worth planning)

  CI/CD pipeline
  Manual deploy-all.sh works but requires SSH access and local repo state. GitHub Actions deploying on push to main
  would remove human error from the deploy process and make deploys reviewable.

  Workspace-level Scout view
  The landing page says "Scout real-time monitoring" as a customer-facing benefit. Currently Scout is admin-only.
  Customers on Team and Business plans should see a simplified view of their own Aiva's Scout status - not the global
  fleet, just their Aivas.

  Blockchain verification public page
  The landing page says "Verifiable by regulators." How does a regulator actually verify? There should be a public URL
  like verify.carinaai.uk/tx/[hash] that anyone can query to confirm an attestation without needing a portal account.

  Aiva knowledge base / file uploads
  Give an Aiva documents: property listings, rate cards, legal FAQs. This transforms Aiva from a generic assistant to
  one that knows your specific business. Significant differentiator.

  Outbound webhooks for workspaces
  Let workspace owners subscribe to events (escalation fired, automation ran, message received) via webhook so they
  can integrate Aiva with their own CRM or ticketing system.

  Referral program
  Common growth mechanism for SME SaaS. "Give a colleague 15% off, get a month free."

  CDN for static assets
  carinaai.uk serves static files directly from the VPS. A UK-focused product should at minimum have Cloudflare in
  front for DDoS protection and edge caching.

  Background job queue
  Fire-and-forget patterns (attestation, Scout event emission, email sending) are not reliable under load. BullMQ with
  Redis gives retries, visibility, and dead-letter queues.

  Audit trail export for workspace owners
  Compliance-conscious customers (legal firms, finance) will ask for this: export all Aiva activity as CSV or PDF for
  their own records.

  ---
  Summary of the biggest gaps in priority order
  
  1. Transactional email (nothing works without it)
  2. Channel delivery adapters (the product does not deliver messages)
  3. Web chat widget
  4. VA response interface (the queue has no delivery)
  5. GDPR / privacy policy / cookie consent (legal requirement)
  6. Workspace conversation view and analytics
  7. Usage limits per tier (cost protection)
  8. Business plan feature implementation (white-label, custom training)
  9. Staging environment
  10. Database connection pooling

  Want me to plan sprints for any of these? The channel delivery, email, and GDPR items are the ones I would do before
  anything else goes to production.



now let's discuss the marketing site's ui and the backedn ui - what do you suggest for aiva                         

● Let me look at what's already built for both surfaces before making any suggestions.

  Searched for 9 patterns, read 1 file, listed 2 directories (ctrl+o to expand)

● Good picture of the codebase. Here is what I see and what I'd suggest for each surface.
     
  ---
  What exists
  
  Marketing site (carinaai.uk): static HTML/CSS, dark navy (--ink: #09161e), teal (--teal: #1a5f7a), amber (--amber: 
  #f5a623), Cormorant Garamond serif headlines, Instrument Sans body. Premium, editorial, understated. No Aiva page
  exists yet.

  Workspace portal (app.carinaai.uk): Next.js + Tailwind. Full Carina workspace (chat, docs, calendar, billing etc).
  No /hire/ section yet. That is sprint-4 prompts 07-10.

  Admin dashboard (admin.carinaai.uk): does not exist yet. Sprint-4 prompts 25-27.

  ---
  Marketing site: carinaai.uk/hire/
  
  The existing site looks like a professional services firm, not a startup. Stay in that register. Aiva is a worker,
  not a chatbot.

  What to avoid: SaaS hero with a floating UI screenshot and "AI-powered" headline. That is every other product. This
  one should feel closer to a staffing agency that happens to use AI.

  Suggested page structure:

  HERO
    Headline: "Meet your Aiva."
    Sub:      "Always on. Knows your business. Escalates when it counts."
    CTA:      "Start free - no card needed"
    Visual:   Not a screenshot. A simple illustration of
              three chat bubbles (WhatsApp / Email / Web)
              converging into one calm, named entity ("Aria from Bloom Studio").

  WHAT IS AN AIVA (3 points, tight)
    - Available on every channel, 24/7
    - Learns your business from documents and FAQ you give it
    - Hands off to a human the moment it should not answer alone

  HOW IT WORKS (numbered, horizontal on desktop)
    1  Choose a role (Customer service, Bookings, Sales, Ops)
    2  Connect your channels (WhatsApp, Email, Slack, Web, Telegram)
    3  Go live in under 10 minutes

  CHANNELS (icon strip with one-line descriptions)
    WhatsApp  Email  Slack  Telegram  Web chat widget

  ROLE TEMPLATES (card row)
    Customer service  |  Booking assistant  |  Sales qualifier
    Tech support      |  Property enquiries |  Custom role
    Each card: icon, name, 1-line example conversation snippet

  TRUST SECTION (this is the differentiator)
    "Every Aiva is watched."
    - Scout governance monitors every conversation in real time
    - Human VA team on standby for escalations (SLA: 15 min first response)
    - Every action hashed and attested on-chain; tamper-evident audit trail

  PRICING (3 tiers, same amber/teal palette as existing pricing page)
    Starter / Team / Business
    Link to /pricing#aiva for full breakdown

  FINAL CTA
    "Your first Aiva is free for 15 days."
    [Start free]  [Talk to us first ->]

  The color palette is already right. Amber CTAs on dark navy. No new fonts or colors needed - just a new page
  following vertical.css.

  ---
  Workspace portal: the /hire/ section
  
  The existing workspace already has a sidebar nav. Aiva needs a dedicated section in it, separate from the Carina
  chat and tools.

  Sidebar structure suggestion:

  -- Your Aivas --
    Hire an Aiva         (entry point when count = 0)
    [Aria]  active       (one entry per Aiva once created)
    [Max]   trial 11d
    [Zara]  paused

  -- Conversations --    (sprint-4 prompt 20)
  -- Analytics --        (sprint-4 prompt 20)

  Aiva roster page (/hire): show each Aiva as an employee card, not a table row. Each card:

  [Avatar initial]  Aria                    [green dot] Active
  Customer service  |  3 channels  |  47 messages today
  [Manage]  [Pause]

  Hire flow (new Aiva wizard, /hire/new): 5 short steps, one screen each, progress bar at top:

  Step 1  Choose a role template (6 cards, or "Custom")
  Step 2  Name your Aiva and set its persona in 2-3 sentences
  Step 3  Connect first channel (can skip, add later)
  Step 4  Test conversation (right there in the wizard, live)
  Step 5  Launch (shows the widget embed snippet and channel status)

  Aiva detail page (/hire/workers/[id]): tabs across the top:

  Overview  |  Channels  |  Conversations  |  Training  |  Automations  |  Analytics  |  Settings

  - Overview: status card, usage bar, last 5 conversations, quick stats
  - Channels: card per connected channel (icon, identifier, toggle, message count)
  - Conversations: two-panel (list left, thread right); user messages right/grey, Aiva left/teal, VA left/amber with
  "VA" badge, escalations as centre dividers
  - Training: document upload, FAQ pairs, 50k char usage bar
  - Automations: scheduled tasks list

  ---
  Admin dashboard: admin.carinaai.uk

  This is internal-only. The tone should be utilitarian, not branded. Tighter density than the workspace portal.
  Priorities:

  Header bar (always visible):
  MRR: £4,820  |  New this month: 12  |  Churned: 2  |  Alerts: 3 [red badge]

  Sidebar:
  Customers       (workspace list)
  Fleet           (all Aivas across all workspaces)
  VA Queue        (escalation kanban)
  Revenue         (Stripe MRR, invoices, refunds)
  Audit Log
  
  Customers page: the "at risk" filter should be the default view on load, not "all customers." At risk = past_due +
  trial expiring within 3 days. Show urgency items first, not alphabetical.

  Fleet page: same principle. Sort by "needs attention" first: rogue signals, high escalation rate, suspended. Kill
  switch visible per row, no navigation away to a detail page to use it.

  VA Queue: three-column kanban: Unassigned / In Progress / Resolved today. Cards show: channel, contact (masked),
  Aiva name, time since escalation, SLA countdown in amber when < 1 hour remaining, red when breached.

  One deliberate choice: the admin app should use a slightly different colour for its primary accent - use --teal
  instead of amber for primary actions, to make it visually distinct from the customer-facing workspace. Amber can
  remain for warnings and SLA breach alerts. That way a screenshot of the admin app is never confused with the
  workspace portal.

  ---
  Summary recommendation

  ┌───────────────────────┬───────────────────────────────────────────────────────────────────────────────────────┐
  │        Surface        │                                     Key principle                                     │
  ├───────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ Marketing             │ Employee metaphor, not SaaS product. Trust and human backup as the differentiator.    │
  │ carinaai.uk/hire/     │ Existing palette, no new design debt.                                                 │
  ├───────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ Workspace /hire/      │ Cards not tables for Aivas. 5-step wizard. Sidebar entry per named Aiva.              │
  │ section               │ Conversations with distinct bubble styles.                                            │
  ├───────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ Admin                 │ Utilitarian density. At-risk first, not alphabetical. Teal as primary accent to       │
  │ admin.carinaai.uk     │ distinguish from workspace. Kill switch always visible without drilling into detail.  │
  └───────────────────────┴───────────────────────────────────────────────────────────────────────────────────────┘

  Want to go deeper on any of these three, or talk through specific component patterns?


let's go deeper but even before that. i prefer /aiva instead of /hire - is that a good idea?                        

● Yes, that is a better idea. Here is why:

  /hire is a verb describing what you do. /aiva is the name of the thing you get. The URL becomes part of the brand.
  When someone bookmarks app.carinaai.uk/aiva or sees it in a tab, it reads as a destination, not an action. Same
  logic as why Stripe uses /payments not /setup-payments.

  It also survives product evolution. If VERLOX ever adds a second product type under the Aiva umbrella (say, a
  specialist Aiva variant, or Aiva Teams), /aiva/workers and /aiva/teams scales cleanly. /hire/workers and /hire/teams
  reads oddly because hire describes one moment in the journey, not the whole section.

  Consistency across surfaces:

  ┌───────────────┬──────────────────────────┬──────────────────────┐
  │    Surface    │        With /hire        │      With /aiva      │
  ├───────────────┼──────────────────────────┼──────────────────────┤
  │ Marketing URL │ carinaai.uk/hire         │ carinaai.uk/aiva     │
  ├───────────────┼──────────────────────────┼──────────────────────┤
  │ Workspace URL │ app.carinaai.uk/hire     │ app.carinaai.uk/aiva │
  ├───────────────┼──────────────────────────┼──────────────────────┤
  │ API routes    │ /api/hire/workers        │ /api/aiva/workers    │
  ├───────────────┼──────────────────────────┼──────────────────────┤
  │ Sidebar label │ "Hire an Aiva" (awkward) │ "Aiva" (clean)       │
  └───────────────┴──────────────────────────┴──────────────────────┘

  The API routes in the sprint-4 prompts currently use /api/hire/* - those should be /api/aiva/* too. It is worth
  updating all 28 prompt files before any agent executes them, because renaming routes after the fact means touching
  the backend, the frontend, and the deploy scripts. */

  One small caveat: the marketing page at carinaai.uk/aiva will compete with your brand hierarchy. Someone landing
  there might ask "is this the Aiva site or the Carina site?" That is easily handled by making the page header say
  "Aiva by VERLOX" with a back-link to carinaai.uk. Not a reason to avoid /aiva, just something to be deliberate about
  in the hero copy.


Marketing site: carinaai.uk/aiva - wireframe level

  The existing design system is already right: --ink navy, --amber CTAs, Cormorant Garamond serif headlines,
  Instrument Sans body, vertical.css layout. No new dependencies. This is a new page, not a new design system.

  ---
  Nav

  Reuse _nav-snippet.html. Add "Aiva" as an active nav item with the amber underline treatment that the existing pages
  use for the current section.

  ---
  Section 1: Hero

  The visual hook matters here. Not a dashboard screenshot (every SaaS product does that). Instead: a single named
  Aiva with a real conversation example. The "2:14am" timestamp does more persuasion than any headline.

  ┌──────────────────────────────────────────────────────────────────┐
  │  [full-width, dark navy, subtle noise texture]                    │
  │                                                                   │
  │  [left, 55% width]              [right, 40% width]                │
  │                                                                   │
  │  ARIA                           ┌────────────────────────────┐   │
  │  Your Aiva from VERLOX          │ WhatsApp   2:14 am         │   │
  │                                 │ ─────────────────────────  │   │
  │  Hire a worker.                 │ "What are your rates for   │   │
  │  Not another chatbot.           │  a full detail?"           │   │
  │  [Cormorant Garamond, 56px]     │                            │   │
  │                                 │ Aria                       │   │
  │  Aiva answers your clients      │ "Hi! Full detail is £85    │   │
  │  on WhatsApp, email, and        │  and takes about 90 min.   │   │
  │  web chat around the clock.     │  Want to book this week?"  │   │
  │  It knows your business         │                            │   │
  │  because you trained it.        │ "Yes please, Saturday?"    │   │
  │  When it should not answer      │                            │   │
  │  alone, it hands off to         │ Aria                       │   │
  │  a human.                       │ "Saturday at 10am works.   │   │
  │                                 │  Sending you a confirm..." │   │
  │  [amber] Start free             └────────────────────────────┘   │
  │  [ghost]  See how it works ->   [caption: "While you slept."]    │
  │                                                                   │
  └──────────────────────────────────────────────────────────────────┘

  Decisions:
  - The conversation card is a static HTML mock, not an animation. No typing effect. Static is cleaner and doesn't
  feel gimmicky.
  - "Hire a worker. Not another chatbot." is the only place the word "chatbot" appears on the whole page. One punch,
  in the headline, then never again.
  - The Aiva has a name ("Aria") and it is shown in the conversation. The moment visitors see a named entity replying
  at 2am they get the product. No further explanation needed.
  - Mobile: conversation card drops below the headline, full width.

  ---
  Section 2: Three pillars
  
  "What is an Aiva" answered in three cards. Short. No bullets inside cards.

  ┌──────────────────────┬──────────────────────┬──────────────────────┐
  │  Always on           │  Knows your          │  Knows when          │
  │                      │  business            │  to stop             │
  │  Answers on          │                      │                      │
  │  WhatsApp, Email,    │  Train it with your  │  The moment it is    │
  │  Slack, Telegram,    │  documents, FAQs,    │  uncertain, it       │
  │  and web chat.       │  and product notes.  │  escalates to a      │
  │  No shifts.          │  It stays in         │  human. Every time.  │
  │  No holidays.        │  character.          │                      │
  └──────────────────────┴──────────────────────┴──────────────────────┘

  Cards have a 1px solid var(--border) outline, var(--r-md) radius, and a very faint teal glow on hover. No icons.
  Typography does the work.

  ---
  Section 3: Role templates

  This is the self-identification moment. Visitors need to see themselves in one of these. Shown as a 3x2 grid on
  desktop, scrolling list on mobile.

  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
  │  Customer service  │  │  Booking assistant │  │  Sales qualifier   │
  │                    │  │                    │  │                    │
  │  "Do you offer     │  │  "Can I book a     │  │  "What's your      │
  │   next-day         │  │   table for        │  │   budget range?"   │
  │   delivery?"       │  │   Saturday?"       │  │                    │
  │                    │  │                    │  │                    │
  │  [Try this role -> │  │  [Try this role -> │  │  [Try this role -> │
  └────────────────────┘  └────────────────────┘  └────────────────────┘

  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
  │  Property enquiry  │  │  Tech support      │  │  Custom role       │
  │                    │  │                    │  │  [amber border]    │
  │  "Is the flat on   │  │  "My login isn't   │  │                    │
  │   Park Road still  │  │   working - can    │  │  Describe your     │
  │   available?"      │  │   you help?"       │  │  business in your  │
  │                    │  │                    │  │  own words.        │
  │  [Try this role -> │  │  [Try this role -> │  │  [Start ->         │
  └────────────────────┘  └────────────────────┘  └────────────────────┘

  Decisions:
  - Each card shows a single real example question, not a feature list. Specificity converts better than abstraction.
  - Hover state reveals a second exchange (the Aiva reply). Done with CSS max-height transition, no JS.
  - "Custom role" card has amber border to visually distinguish it as the escape hatch.
  - "Try this role" link goes to app.carinaai.uk/register?role=customer_service etc., pre-seeding the onboarding
  wizard.

  ---
  Section 4: How it works

  Three numbered steps. On desktop: horizontal with amber connecting line. On mobile: numbered vertical list.

  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                  │
  │   01 ─────────────── 02 ─────────────── 03                      │
  │   [amber line connects the numbers]                              │
  │                                                                  │
  │   Choose a role          Connect channels       Go live          │
  │                                                                  │
  │   Pick from a template   WhatsApp, Email,       Your Aiva starts │
  │   or describe your       Slack, Telegram,       answering in     │
  │   business in your       or web chat.           minutes.         │
  │   own words. Done        Connect one now,       Add channels     │
  │   in two minutes.        more later.            any time.        │
  │                                                                  │
  └─────────────────────────────────────────────────────────────────┘

  The numbered circles use the existing .pricing-path-num style from pricing/index.html: amber fill at low opacity,
  amber border, amber text.

  ---
  Section 5: Channels
  
  Icon strip. Five channels, each with a name, one-line description, and a Tabler icon. The site already loads Tabler
  icons. No new dependency.

  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ [icon]   │  │ [icon]   │  │ [icon]   │  │ [icon]   │  │ [icon]   │
  │          │  │          │  │          │  │          │  │          │
  │ WhatsApp │  │ Email    │  │ Slack    │  │ Telegram │  │ Web chat │
  │          │  │          │  │          │  │          │  │          │
  │ Clients  │  │ Gets its │  │ Lives in │  │ Full two-│  │ Embed on │
  │ message  │  │ own      │  │ your     │  │ way      │  │ any site.│
  │ on their │  │ inbox.   │  │ channels.│  │ messaging│  │ One line.│
  │ phone.   │  │          │  │          │  │          │  │          │
  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘

  Five items in a CSS flex row, wrapping to 2-3 on mobile. Tabler icons: ti-brand-whatsapp, ti-mail, ti-brand-slack,
  ti-brand-telegram, ti-message-chatbot.

  ---
  Section 6: Trust
  
  This is the section no competitor can match. Give it its own background zone to make it feel structurally different.

  ┌─────────────────────────────────────────────────────────────────┐
  │  [background: rgba(26,95,122,0.12) over --ink]                  │
  │  [1px teal top/bottom borders]                                  │
  │                                                                  │
  │  "Every Aiva is watched."                                        │
  │  [Cormorant Garamond, 44px]                                      │
  │  Not by you. By us.                                              │
  │  [Instrument Sans, muted, weight 300]                            │
  │                                                                  │
  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
  │  │  Scout           │  │  Human backup    │  │  On-chain      │ │
  │  │  governance      │  │                  │  │  audit trail   │ │
  │  │                  │  │  Your VA team    │  │                │ │
  │  │  Monitors every  │  │  is on standby.  │  │  Every action  │ │
  │  │  conversation in │  │  Escalations     │  │  is hashed and │ │
  │  │  real time.      │  │  reach a trained │  │  attested.     │ │
  │  │  Volume spikes,  │  │  human within    │  │  Tamper-       │ │
  │  │  unusual         │  │  15 minutes.     │  │  evident.      │ │
  │  │  patterns,       │  │                  │  │  Always.       │ │
  │  │  rogue behavior. │  │                  │  │                │ │
  │  └──────────────────┘  └──────────────────┘  └────────────────┘ │
  │                                                                  │
  │  [ghost link] How Scout works ->  [links to labyrinthscout.com]  │
  │                                                                  │
  └─────────────────────────────────────────────────────────────────┘

  Decisions:
  - The opening line is a statement, not a feature. "Watched" is slightly unsettling in a good way - it creates a
  pause.
  - "Not by you. By us." removes the burden from the customer. They do not need to monitor their Aiva. VERLOX does.
  - The link to Scout's own site (labyrinthscout.com) is the only external link on this page. It validates the claim
  with a real product.

  ---
  Section 7: Pricing

  Three plan cards matching the exact visual pattern of the existing pricing/index.html. The layout and classes are
  already defined in vertical.css. No new CSS needed beyond the card values.

  Show: plan name, price, Aiva count, message limit, key features list (4-5 items max per card), and a CTA button.

  The Business card gets an amber border to distinguish it. The Team card gets a "Most popular" badge in teal.

  ---
  Section 8: Final CTA

  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                  │
  │   Your first Aiva is free for 15 days.                          │
  │   No card required.                                             │
  │   [Cormorant Garamond, 44px]                                    │
  │                                                                  │
  │   [amber button]  Start free                                    │
  │   [ghost link]    Talk to us first ->                           │
  │                                                                  │
  │   [small, muted, centered]                                      │
  │   Powered by Carina.  Monitored by Scout.                       │
  │   [two brand marks, SVG, already in /assets/badges/]            │
  │                                                                  │
  └─────────────────────────────────────────────────────────────────┘

  ---
  Footer
  
  Reuse _footer-snippet.html. Add Privacy Policy | Terms of Service links to the footer now that sprint-4 prompt 21
  builds those pages.

  ---
  What deliberately is not on this page
  
  - No animated typing effect in the conversation mock
  - No video
  - No "As seen in" logos
  - No testimonials (no customers yet)
  - No feature comparison table (that belongs on /pricing)
  - No mention of "AI-powered", "machine learning", "LLM"
  - The word "chatbot" appears exactly once (in the headline, negated)




Here is the workspace portal wireframe.

  ---
  Workspace portal: app.carinaai.uk/aiva - wireframe level

  ---
  Sidebar addition
  
  The existing nav groups system is the right place to add Aiva. Add a new group aiva to NAV_GROUPS, positioned
  between the intelligence group and the account group. Two static routes only - no dynamic per-Aiva entries in the
  sidebar (too noisy when someone has 5 Aivas; the roster page handles browsing):

  AIVA                              <- group header, same 10px uppercase tracking style
    [Bot icon]  Your Aivas   /aiva/workers
    [Plus icon] Hire          /aiva

  When on any /aiva/* */path, the group header text uses text-accent. Active route gets bg-elevated text-text-primary.
  Collapsed sidebar shows the Bot icon as the group representative, same as all other groups.

  Bot is already available in lucide-react (check NAV_ICON_MAP - add it if not there). Add it to the icon map and the
  NAV_GROUPS entry.

  ---
  Entry page /aiva

  Two-column on desktop (grid-cols-[1fr_340px]), stacked on mobile.

  Left column - the brief form:

  h1: Hire an Aiva
  p:  Describe the role in plain English. Your Aiva will be configured and
      ready in under three minutes.

  [Label] What should I call this Aiva?
  [Input] placeholder: "e.g. Aria, Property Manager, Friday"

  [Label] What does this Aiva do?
  [Textarea, 5 rows]
  placeholder: "Describe the tasks, tone, and who it talks to. Example:
  Handles tenant WhatsApp messages about maintenance and rent. Tone is
  professional and reassuring. Escalates anything legal or urgent."

  [Label] Which channels should it use? (pick at least one)
  [Checkbox group, 2-column]
    [WA icon] WhatsApp       [Email icon] Email
    [Slack icon] Slack       [Telegram icon] Telegram
    [Web icon] Web chat

  [Submit button - full width on mobile, auto on desktop]
    Text: "Meet your Aiva"
    Loading state text: "Configuring [name from field]..."
    (interpolate the name they typed; fallback to "your Aiva" if blank)

  No <select> for language on the initial form. Language defaults to English (UK). Let them change it in Settings
  after hire if needed - one less field to fill on day one.

  On submit error: inline red message below the button, not a toast. The form is the entire page; an error toast can
  disappear before the user reads it.

  Right column - role templates:

  Section label: "Or start from a template" (text-xs text-text-muted uppercase tracking-wider)

  Six small cards in a single column (flex flex-col gap-2). Each card:

  ┌────────────────────────────────────────┐
  │  [icon]  Customer service              │
  │          "Do you offer next-day..."    │  <- example Q, truncated, italic, muted
  │          Aria: "Yes, orders before..." │  <- example A, truncated, accent-dim color
  └────────────────────────────────────────┘

  Click fills both roleName and roleDescription inputs with role defaults. Selected card gets border-accent. If user
  edits either field after selecting, the selected state clears (deselect via onChange listener on the inputs).

  ---
  Roster page /aiva/workers

  Page header:

  [h1] Your Aivas
  [Button, top-right] + Hire an Aiva  ->  /aiva

  Empty state:

  [Bot icon, large, text-text-muted]
  No Aivas yet
  [p, muted] Hire your first Aiva and it will appear here.
  [Button] Hire an Aiva

  Aiva cards (responsive grid: 1 col mobile / 2 col md / 3 col xl):

  ┌──────────────────────────────────────────────────┐
  │  [A]  Aria                   [green dot] Active  │
  │       Customer service                           │
  │  ────────────────────────────────────────────    │
  │  [WA][Email][Web]       47 msgs today  · 2h ago  │
  │                                  [Manage] [II]   │
  └──────────────────────────────────────────────────┘

  Avatar: h-9 w-9 rounded-full bg-accent-dim text-accent text-sm font-medium - first letter of roleName. Use the same
  initials pattern already used in the sidebar user avatar.

  Status chip (top-right of card, inline):
  active:      h-2 w-2 rounded-full bg-green-400  + "Active" text
  trial:       h-2 w-2 rounded-full bg-amber-400  + "Trial · Nd left"
  paused:      h-2 w-2 rounded-full bg-gray-400   + "Paused"
  suspended:   h-2 w-2 rounded-full bg-red-400    + "Suspended"
  setting_up:  h-2 w-2 rounded-full bg-blue-400 animate-pulse + "Setting up"

  Channel icons: tiny icon-only row, h-3.5 w-3.5 text-text-muted. One icon per connected channel.

  Actions:
  - "Manage" is a <Link> to /aiva/workers/[id]
  - The pause icon ([II]) is an inline button. Calls PATCH /api/aiva/workers/[id] with { status: 'paused' }. No
  navigation, updates the card status in-place via optimistic update.

  ---
  Detail page /aiva/workers/[id]

  Page header:

  ┌────────────────────────────────────────────────────────────────┐
  │  [A]  Aria                             [Pause Aiva]  [Scout ->]│
  │       Customer service  |  [dot] Active  |  3 channels         │
  └────────────────────────────────────────────────────────────────┘

  - Avatar: same h-9 w-9 circle as the roster card
  - Status dot + text inline with role name
  - Channel count badge: "3 channels" in text-xs text-text-muted
  - "Pause Aiva" / "Resume Aiva": secondary button, no confirm for resume; confirm modal before pause
  - "Scout ->" : ghost button with ExternalLink icon, opens $SCOUT_FLEET_URL/agents/[id] in new tab

  Tab bar:

  Overview | Channels | Conversations | Automations | Analytics | Settings

  - Overview, Channels, Automations, Settings built by this prompt (10)
  - Conversations, Analytics built by prompt 20 - those prompts add their tab content to this page
  - Training added by prompt 28

  Tab bar is a <div role="tablist"> using the existing tab pattern from BillingClient.tsx (check what pattern it uses
  - likely a data-active border-bottom style). Match it exactly.

  Overview tab:

  [Row of 4 stat cards]
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │ 47           │ │ 2,847        │ │ 3.2%         │ │ 12           │
  │ Today        │ │ Total msgs   │ │ Escalation   │ │ Automations  │
  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

  [Usage bar - only shown if aiva_subscriptions row exists]
  Messages this month: [====------] 47 / 2,000  Resets 1 Jul

  [Section: Last 5 conversations]
    [WA] +44 7** *** 123  "I need to book a..."  2h ago   ->
    [Email] jo***@gmail   "Following up on..."   5h ago   ->
    ...
    [View all conversations]  ->  /aiva/conversations?worker=[id]

  [Section: Recent activity - last 10]
    [timestamp]  [badge: message sent]    Replied to +44 791...
    [timestamp]  [badge: escalated]       Escalated to VA team
    [timestamp]  [badge: automation ran]  Morning briefing sent
    ...

  Stat cards: border border-border rounded-lg p-4 bg-elevated. Number in text-2xl font-semibold text-text-primary.
  Label in text-xs text-text-muted.

  Usage bar: narrow h-1.5 progress bar, color class switches based on percentage:
  - < 60%: bg-green-400
  - 60-85%: bg-amber-400
  - > 85%: bg-red-400
  
  Last 5 conversations: each row is a <Link> to the conversations page filtered by this worker and contact. Shows
  channel icon, masked contact, first 40 chars of last message, time ago.

  Channels tab:

  Grid of channel cards (grid-cols-1 sm:grid-cols-2 gap-3).

  Connected channel card:
  ┌───────────────────────────────────────────────────┐
  │  [WA icon, green]  WhatsApp         [toggle: ON]  │
  │  +44 7** *** 456                                  │
  │  1,204 messages                                   │
  │                            [Disconnect] (danger)  │
  └───────────────────────────────────────────────────┘
  
  Not-connected channel card:
  ┌───────────────────────────────────────────────────┐
  │  [Slack icon, muted]  Slack         [disabled]    │
  │  Not connected                                    │
  │                                    [Connect ->]   │
  └───────────────────────────────────────────────────┘
  
  Connected card: border border-border bg-elevated rounded-lg p-4
  Not connected: border border-dashed border-border rounded-lg p-4 opacity-60

  The identifier shows masked: phone digits masked as +44 7** *** 456, email as ar**@mail.carinaai.uk.

  The toggle switch pauses message processing on that channel without disconnecting it. Toggle calls PATCH 
  /api/aiva/workers/[id]/channels/[channel] with { active: false }.

  Automations tab: Keep from existing prompt 10. Add one visual detail: the schedule badge under each automation name
  uses text-xs bg-accent-dim text-accent rounded px-1.5 py-0.5.

  Settings tab:

  Two sections:

  Section 1 - Edit:
  [Label] Aiva name
  [Input] current value
  
  [Label] Role description
  [Textarea, 5 rows] current value

  [Label] Language
  [Select] English (UK) / English (US) / French / Spanish / Arabic

  [Save changes button]
  
  Section 2 - Audit (the old Audit tab, merged here):

  [h3] Activity audit
  [p, muted] Every action is hashed and attested on-chain. The hash
  covers the action type, timestamp, and a content fingerprint.
  No raw message content is stored on-chain.

  [Table]
  Timestamp | Action | Input | Output | Escalated | Verified
  ...rows...
  [on-chain badge: green link] or [pending badge: muted text]

  Section 3 - Danger zone:

  [h3, text-danger] Danger zone
  [border border-danger/30 rounded-lg p-4]

  [Dismiss this Aiva]
  "Permanently deactivates this Aiva. Cannot be undone."
  [Button, danger outline]  "Dismiss Aiva"

  Dismiss requires typing the Aiva's name in a confirm modal before calling DELETE /api/aiva/workers/[id].

  ---
  What the existing prompt 10 already has that is correct
  
  - All five Next.js API proxy routes (keep exactly as-is)
  - Role template defaults (the copy for all 6 roles)
  - The automations modal fields and post behavior
  - The resolveCoreUrl() + Authorization header pattern for core proxying
  - The TypeScript design constraints section








go wireframe-level on the admin layout and each page                                                                

● Let me go section by section. I'll cover shell, then each page.

  ---
  Admin shell
  
  The admin app needs to be visually distinguishable from the workspace app at a glance. Same dark base, but amber is
  the primary accent (not teal). A persistent amber topbar strip serves as the "you are in admin" signal.

  Shell layout:
  ┌─────────────────────────────────────────────────────────────┐
  │ VERLOX  ADMIN                          admin@verlox.co  Sign out │  <- amber topbar, h-10
  ├──────────────┬──────────────────────────────────────────────┤
  │              │                                               │
  │  Nav         │  Page content                                 │
  │  w-52        │  flex-1 overflow-y-auto px-8 py-6            │
  │  shrink-0    │                                               │
  │              │                                               │
  │              │                                               │
  │              │                                               │
  │              │                                               │
  │  ──────────  │                                               │
  │  admin@      │                                               │
  │  verlox.co   │                                               │
  │  Sign out    │                                               │
  └──────────────┴──────────────────────────────────────────────┘
  
  Topbar: bg-amber-500/15 border-b border-amber-500/30 h-10 flex items-center px-4
  Left: VERLOX wordmark (small, text-xs font-semibold tracking-widest) + ADMIN badge (text-[10px] bg-amber-500/20 
  text-amber-400 px-1.5 py-0.5 rounded uppercase tracking-wider ml-2)
  Right: admin email text-xs text-text-muted + Sign out button.

  Sidebar nav items:
    Customers          (Users icon)
    Fleet              (Server icon)
    VA Queue           (Headphones icon)  [3]  <- open escalations count badge, amber
    Revenue            (TrendingUp icon)
    Audit Log          (Shield icon)

  Active item: bg-amber-500/10 text-amber-400 with left border-l-2 border-amber-400. All others: text-text-secondary 
  hover:text-text-primary hover:bg-overlay.

  The VA Queue badge shows total open escalations (unassigned + in_progress). Red if any SLA breach, amber otherwise.
  Fetch on mount, no polling (refresh on navigate).

  Sidebar bottom: admin email text-xs text-text-muted + Sign out link.

  ---
  Login page

  No sidebar or topbar. Standalone full-screen.

                ┌───────────────────────┐
                │                       │
                │  VERLOX               │
                │  Admin access         │
                │                       │
                │  [Email             ] │
                │  [Password          ] │
                │                       │
                │  [  Sign in         ] │  <- amber button style, full width
                │                       │
                │  Error: Invalid...     │  <- inline, text-danger, text-sm
                └───────────────────────┘

  Card: w-full max-w-sm rounded-xl border border-border bg-elevated p-8. Centered in a min-h-screen flex items-center 
  justify-center bg-base page.

  "Admin access" subtitle: text-sm text-text-muted mt-1. No "forgot password" link, no register link.

  Sign in button: amber variant - bg-amber-500 text-black hover:bg-amber-400 (not the workspace teal btn-primary).
  Define btn-admin-primary in the admin app's globals.

  Rate limit state: after 5 failures, replace button with text-danger text-sm text-center "Too many attempts. Wait 15 
  minutes." and disable form.

  ---
  Customers page

  h1: Customers
  p: 124 workspaces

  [Search: workspace name or email...]  [Plan ▾]  [Status ▾]  [Latest ▾]

  ┌─────────────────────────────────────────────────────────────────────────┐
  │ Workspace            │ Owner              │ Plan/Status   │ Aivas │ MRR │ Last active │ Signals │ │
  ├─────────────────────────────────────────────────────────────────────────┤
  │← amber │ Acme Corp   │ jo@acme.com        │ [Trial 2d]   │  1/1  │  -  │  3h ago     │   0     │[View]│
  │        │ Beta Ltd    │ ceo@beta.com       │ [Team]       │  3/5  │ 199 │  1h ago     │  [!2]   │[View]│
  │← red   │ Gamma Inc   │ ops@gamma.io       │ [Past due]   │  2/5  │  0  │  12h ago    │   0     │[View]│
  └─────────────────────────────────────────────────────────────────────────┘
       Page 1 of 3   [< Prev]  [Next >]

  Row left-border treatment:
  - status = 'past_due' or trial_ends_at < NOW() + 3d: border-l-2 border-amber-400 + bg-amber-500/5
  - status = 'suspended': border-l-2 border-red-500/30 + bg-red-500/5 opacity-80
  - Normal: no border, default row background

  Plan/Status badge:
  Single badge that combines both:
  - Trial · 2d left - bg-amber-500/15 text-amber-400
  - Starter - Active - bg-green-500/10 text-green-400
  - Team - Active - bg-green-500/10 text-green-400
  - Team - Past due - bg-red-500/10 text-red-400
  - Suspended - bg-gray-500/10 text-text-muted

  Scout signals column: A plain number. If > 0 warning-level signals: amber number. If any critical: red number with a
  ! prefix (!2).

  [View] button: text-xs text-accent hover:underline. Not a full button, just a link-style action.

  MRR column: Shows formatted GBP (e.g., 199). "Trial" shows - since MRR is £0. "Past due" shows the MRR in red
  (at-risk revenue).

  ---
  Customer detail page
  
  Two-column: grid grid-cols-[1fr_288px] gap-6 items-start.

  Left column carries breadcrumb, header, stat chips, tabs. Right column carries the override panel and stays sticky.

  Customers / Acme Corp

  Acme Corp                                    [Copy ID]
  jo@acme.com  ·  Created 14 Jan 2026

  [Plan: Trial · 2d]  [Aivas: 1/1]  [MRR: -]  [Last active: 3h ago]

  [Aivas] [Activity] [Scout Signals] [Billing]       |  ADMIN OVERRIDES
  ──────────────────────────────────────────          │  ─────────────────
                                                      │
  [Aivas tab content]                                 │  Trial extension
                                                      │  [14] days  [Extend]
                                                      │  Ends 25 Jun 2026
                                                      │
                                                      │  ───────────────
                                                      │  Force plan
                                                      │  [Trial      ▾]
                                                      │  [reason...   ]
                                                      │  [Apply]  <- danger
                                                      │
                                                      │  ───────────────
                                                      │  Pause / Resume
                                                      │  [Pause all (1)] <- danger
                                                      │
                                                      │  ───────────────
                                                      │  Add credit
                                                      │  [£ ] [note   ]
                                                      │  [Apply credit]
                                                      │
                                                      │  ───────────────
                                                      │  Notes
                                                      │  [textarea     ]
                                                      │  [Save notes   ]

  Override panel: rounded-lg border border-amber-500/20 bg-elevated p-4 sticky top-6

  Header: text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-4 - "ADMIN OVERRIDES"

  Sections separated by <div className="border-t border-border my-3" />.

  Each "danger" action button: w-full text-xs border border-red-500/40 text-red-400 rounded-md px-3 py-1.5 
  hover:bg-red-500/10 transition-colors.
  Credit and trial-extend buttons: w-full text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-md
  px-3 py-1.5 hover:bg-amber-500/25.

  Every action that mutates shows a confirmation window.confirm or inline <dialog>. After success: flash "Done." in
  text-xs text-green-400 below the button for 3 seconds; re-fetch page data.

  Aivas tab:
  Name         Role             Status    Last active  Escalations  Attestation  Action
  Aria         Customer svc     ● Active  1h ago       3            94%          [Pause]

  Attestation cell: text-green-400 if >= 95, text-amber-400 if 80-94, text-red-400 if < 80.

  Activity tab:
  Feed layout, not table. Each item:
    [Bot icon small]  [action badge]  "Handled tenant query about heating."  2h ago  [On-chain ↗]
  No outer table. divide-y divide-border. Load more at bottom.

  Scout Signals tab:
  [Severity ▾]  [Event type ▾]

    [CRITICAL]  unauthorized_tool_attempt  Aria tried to call /api/delete-tenant  2h ago  [+]
    [WARNING]   high_escalation_rate       Escalation rate 34% (threshold 20%)    4h ago  [+]

  Critical rows: bg-red-500/5 border-l-2 border-red-500/40. Warning rows: amber left border. [+] expands the metadata
  JSON inline.

  Billing tab:
  Read-only plan card (same card shape as the workspace billing UI but with a "Read only" label). Invoice table with
  Stripe link icon next to the customer ID.

  ---
  Fleet page

  Two tabs: Aivas | Scout Signals

  Aivas tab

  [Search name/role/workspace]  [Status ▾]  [Signals ▾]  [Sort: Escalation rate ▾]

  Aiva               Workspace          Status      Esc 7d   Signals 24h  Attest   Actions (on hover)
  ─────────────────────────────────────────────────────────────────────────────────────────────────
  Aria               Acme Corp          ● Active     14 [!]    [crit: 2]   91%      [Pause] [View →]
                     jo@acme.com
  ─────────────────────────────────────────────────────────────────────────────────────────────────
  Friday             Beta Ltd           ● Active      2          0         98%      [Pause] [View →]
                     ceo@beta.com
  ─────────────────────────────────────────────────────────────────────────────────────────────────
  Max                Gamma Inc          ◌ Paused      7          0         73% [!]  [Resume] [View →]
                     ops@gamma.io

  Row treatment:
  - Any critical signal in last 24h: border-l-2 border-red-500/40 bg-red-500/5
  - Escalation rate > 0.2 (no critical): border-l-2 border-amber-400/40
  - Paused: row opacity-70

  Actions column: Hidden by default (opacity-0). On group-hover: opacity-100 transition-opacity. This keeps the table
  scannable and makes the kill switch deliberate. Use group on <tr> and group-hover:opacity-100 on the action cell.

  Escalations 7d cell: Number in text-text-primary. If escalation_rate > 0.2: text-red-400 with [!] suffix.

  Attestation cell: Percentage text, colored same as customer detail (green/amber/red by threshold).

  Signals 24h cell:
  - 0: - in text-text-muted
  - Warning only: amber number
  - Any critical: text-red-400 font-medium number

  ---
  Aiva detail drawer (slide-in)
  
  fixed right-0 top-0 h-full w-[480px] bg-elevated border-l border-border z-50 flex flex-col

  ┌─────────────────────────────────────────────┐
  │  [X close]                                  │
  │  Aria                        ● Active       │
  │  Customer service · Acme Corp [↗ workspace] │
  │                                             │
  │  47,213 msgs  ·  14 esc  ·  91% attest     │
  │                                             │
  │  [Pause Aiva] <- amber/red button           │
  │  ─────────────────────────────────────────  │
  │  Recent activity (last 20)                  │
  │  [feed rows]                                │
  │                                             │
  │  Scout signals (last 10)                    │
  │  [signal rows]                              │
  │                                             │
  │  Channels                                   │
  │  WhatsApp  ·  +44 7** *** 456  ● active     │
  │                                             │
  │  Automations                                │
  │  Morning briefing  ·  Daily 8am   enabled  │
  └─────────────────────────────────────────────┘

  Drawer enters with translate-x-full -> translate-x-0 CSS transition (200ms ease-out). Backdrop: fixed inset-0 
  bg-black/40 z-40 (click to close).

  "Pause Aiva" button in drawer: text-sm border border-amber-500/40 text-amber-400 rounded-md px-4 py-2 
  hover:bg-amber-500/10. Opens the reason modal before calling the API.

  ---
  Scout Signals tab

  [Severity ▾]  [Event type ▾]  [Aiva ▾]  [Workspace ▾]  [Date range]
                                                            [● Live] toggle  <- top right

  Time         Severity     Event type                  Aiva       Workspace      Details
  ─────────────────────────────────────────────────────────────────────────────────────
  14:23        [CRITICAL]   unauthorized_tool_attempt   Aria       Acme Corp      [+]
  14:01        [WARNING]    high_escalation_rate        Friday     Beta Ltd       [+]
  13:47        [INFO]       volume_spike                Max        Delta Co       [+]

  Critical rows: bg-red-500/5 border-l-2 border-red-500/40.
  Warning rows: bg-amber-500/5 border-l-2 border-amber-400/30.
  Info rows: default.

  Live toggle: text-xs flex items-center gap-1.5. Off state: text-text-muted. On state: text-green-400 with a h-1.5 
  w-1.5 rounded-full bg-green-400 animate-pulse dot. Disconnected state: amber dot, text-amber-400 "Reconnecting...".

  Critical signal toast (bottom-right, fixed bottom-4 right-4 z-50):
  ┌────────────────────────────────────────┐
  │  CRITICAL  unauthorized_tool_attempt   │  <- red top border
  │  Aria in Acme Corp                     │
  │  "Attempted to call /api/delete-tenant"│
  ┌────────────────────────────────────────┐
  │  CRITICAL  unauthorized_tool_attempt   │  <- red top border
  │  Aria in Acme Corp                     │
  │  "Attempted to call /api/delete-tenant"│
  │  [View ->]                    [Dismiss]│
  └────────────────────────────────────────┘
  rounded-lg border border-red-500/40 bg-elevated shadow-lg p-3 w-72. Never auto-dismissed. Multiple toasts stack vertically (newest at bottom).

  ---
  Attestation report page

  Linked from Fleet page top-right as Attestation report -> link.

  Attestation coverage

  [Total: 1.2M]  [Confirmed: 1.14M]  [Pending: 8.4K]  [Failed: 51.6K]  [Coverage: 94.8%]

                                                          amber: 80-94%
  Last 24 hours: 12,441 records · 11,992 confirmed · 96.4% coverage

  ─────────────────────────────────────────────────────────────────
  Aivas with lowest attestation coverage

  Aiva       Workspace     Total    Confirmed    Coverage    Action
  Max        Gamma Inc     8,442    6,186        73%         [Retry all 2,256 failed]
  Jade       Delta Co      3,201    2,561        80%         [Retry all 640 failed]

  ─────────────────────────────────────────────────────────────────
  All unattested records  (oldest first)                [Retry all on page]

  Activity ID      Aiva    Workspace    Action type       Created          Retry
  a3f1...          Aria    Acme Corp    message_sent      2h ago           [Retry]
  b9c2...          Max     Gamma Inc    tool_called       3h ago           [Retry]

  Coverage % stat card: text-4xl font-semibold number. Color: green >= 95, amber 80-94, red < 80. Background of that card matches: bg-green-500/10 / bg-amber-500/10 / bg-red-500/10.

  "Retry all failed" button on worst-coverage table: inline loading state "Retrying 2,256... (1,847 done)" with a mini progress bar below the button.

  "Retry all on page" at top of unattested table: shows a "Retrying 50 records..." banner that replaces the button while running. Each successfully retried row fades out (opacity-0 transition-opacity) then is removed from the DOM.

  ---
  VA Queue page

  Three tabs: Queue | Team | SLA Report

  Queue tab - Kanban

  [Total open: 18]  [SLA breached: 3] <- red  [Avg wait: 34m]  [Avg TTFR (7d): 11m]  [Avg TTR (7d): 47m]

         UNASSIGNED (8)              IN PROGRESS (7) [!1 breached]     RESOLVED TODAY (23)
         ────────────────────────    ──────────────────────────────     ──────────────────
    ┌──────────────────────────┐  ┌──────────────────────────────┐
    │ [URGENT]      [BREACHED] │  │ [HIGH]              [3m left]│
    │ Aria - Acme Corp         │  │ Friday - Beta Ltd            │
    │ "Client mentioned legal  │  │ "Payment dispute re inv 0042"│
    │ proceedings..."          │  │                              │
    │ ───────────────────────  │  │ ───────────────────────────  │
    │ 1h 23m ago  [Assign ▾] [View]│ 47m ago  Sarah C.   [View] │
    └──────────────────────────┘  └──────────────────────────────┘
    ┌──────────────────────────┐
    │ [HIGH]                   │
    │ Max - Gamma Inc          │
    │ "Refund request, client  │
    │ very frustrated"         │
    │ ───────────────────────  │
    │ 52m ago     [Assign ▾] [View]│
    └──────────────────────────┘

  Each column: flex flex-col gap-3 h-[calc(100vh-240px)] overflow-y-auto pr-1

  Column header: text-sm font-medium text-text-primary mb-3 flex items-center gap-2
  SLA breach count badge: text-xs bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded - only shown if > 0.

  Card:
  bg-elevated border border-border rounded-lg p-3
  SLA-breached card: border-red-500/30 bg-red-500/5
  Urgent (not breached): border-amber-500/20
  Normal: border-border

  Priority badge: text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded
  - URGENT: bg-red-500/15 text-red-400
  - HIGH: bg-amber-500/15 text-amber-400
  - (no badge for NORMAL - keep clean)
  
  SLA badge (right side): text-[10px]
  - Breached: text-red-400 font-semibold
  - < 10m: text-amber-400
  - Hidden otherwise.
  
  Card footer: flex items-center justify-between mt-2 pt-2 border-t border-border
  Left: text-[11px] text-text-muted time ago + assigned VA name if in-progress.
  Right: [Assign ▾] (unassigned cards only) + [View] link-style button.

  "Assign" dropdown: A popover <select> or small custom dropdown listing available VA members (available=true, load < max). Selecting one calls PATCH and moves the card to In Progress column (optimistic update).

  ---
  Escalation detail panel

  fixed right-0 top-0 h-full w-[560px] bg-elevated border-l border-border z-50 flex flex-col

  ┌────────────────────────────────────────────────────┐
  │  [X]                                               │
  │                                                    │
  │  [URGENT]  Aria - Acme Corp                        │
  │  Escalated via WhatsApp  ·  1h 23m ago             │
  │                                                    │
  │  SLA                                               │
  │  First response: [OVERDUE - 13m ago]  ← red        │
  │  Resolution:     [3h 41m remaining]   ← amber       │
  │                                                    │
  │  ────────────────────────────────────────────────  │
  │  Conversation                                      │
  │  ┌──────────────────────────────────────────────┐  │
  │  │                   "I need help urgently"    │ │  <- user, right
  │  │  "I can help with that! What's going on?"  │  │  <- Aiva, left
  │  │                   "It's about the contract" │ │
  │  │  "Happy to look into that. Can you share..." │  │
  │  │                        "I want a human NOW" │ │
  │  │  ──── Aria escalated ─────────────────────  │  │
  │  │  Reason: Client explicitly requested human  │  │
  │  └──────────────────────────────────────────────┘  │
  │  (scrollable, max-h-48 overflow-y-auto)             │
  │                                                    │
  │  ────────────────────────────────────────────────  │
  │  Assignment                                        │
  │  [Assign to: Sarah Chen        ▾]                  │
  │  [Mark first response]  ← disabled if already done │
  │                                                    │
  │  Resolution                                        │
  │  [Note about how this was resolved...   ]          │
  │  [Mark resolved]  ← disabled if note < 10 chars   │
  │                                                    │
  │  ────────────────────────────────────────────────  │
  │  Scout signals for Aria (last 1h): 1 warning       │
  │  [WARNING] high_escalation_rate  "34% (>20%)"      │
  └────────────────────────────────────────────────────┘

  Conversation transcript: user bubbles right (bg-accent-dim text-text-primary text-right ml-8 rounded-lg px-3 py-2 text-xs mb-1), Aiva bubbles left (bg-elevated border border-border mr-8 rounded-lg px-3 py-2 text-xs mb-1 
  text-text-secondary). Escalation divider: text-[10px] text-red-400 text-center my-2 border-t border-red-500/20 pt-2.

  "Mark first response" button: text-xs btn-ghost - disabled and opacity-40 if first_response_at is already set.
  "Mark resolved" button: text-xs btn-admin-primary - disabled until resolution note is >= 10 chars.

  ---
  Team tab

                                               [+ Add team member]
  Name          Email           Available  Open  Load        Resolved 30d  Avg TTR  Remove
  Sarah Chen    sarah@...       [toggle]   3     ███░░ 3/5   47            12m      [Remove]
  James O.      james@...       [toggle]   5     █████ 5/5   31            18m      [Remove]
  Priya S.      priya@...       OFF        0     ░░░░░ 0/5   22            21m      [Remove]

  Available toggle: inline <button> styled as a small toggle switch. When off: row is opacity-60.

  Load bar: w-20 h-1 rounded-full bg-overlay with inner bg-green-400 (< 80%), bg-amber-400 (80-100%), bg-red-400 (overloaded). Followed by Xm/Nm text.

  "+ Add team member" button at top right. Clicking reveals an inline form row at the top of the table body:
    [Name           ]  [Email               ]  [Max load: 5]  [Add]  [Cancel]

  "Remove" button: text-[11px] text-text-muted hover:text-danger. On click, first checks for open escalations. If 409 response: shows inline error below the row text-xs text-danger "Has 3 open escalations. Reassign first.". If no open
  escalations: window.confirm then DELETE.

  ---
  SLA Report tab

  First response SLA: 87%     Resolution SLA: 79%     Breach rate: 8.3%     Avg TTR: 47m
  (target: 100% in 15 min)    (target: 100% in 4h)

  [Bar chart: 30 days - received / resolved / breached]
  ────────────────────────────────────────────────────────────

  By VA member
  Name       Assigned  Resolved  Avg TTR  SLA %
  Sarah C.   47        44        12m      96%
  James O.   31        28        18m      82%
  Priya S.   22        22        21m      91%

  By priority
  Priority   Count   Avg TTR   SLA %
  Urgent     8       14m       100%
  High       34      38m       85%
  Normal     71      58m       76%

  Stat row numbers: color the SLA rate - green >= 90, amber 70-89, red < 70.

  Bar chart: recharts BarChart. Bars: received=#1a5f7a (teal), resolved=#4ade80 (green), breached=#f87171 (red). No animation. Simple tooltip on hover.

  ---
  Revenue page

  [MRR: £4,312]  [ARR: £51,744]  [Active: 47]  [Trial: 23]  [ARPU: £91.74]  [Conv: 67%]

  MRR Trend (12 months)
  [line chart, h-56, full width]
    Total MRR (amber line)  New MRR (green)  Churned MRR (red)

  ──────────────────────────────────────
  Tier breakdown                                At risk
  Tier       Count  MRR         %          ┌───────────────────────────────┐
  Trial      23     £0          0%         │ Payment failures (3)          │
  Starter    31     £1,519     35%         │ Acme Corp  Team  £199  5d left│
  Team       12     £2,388     55%         │ Beta Ltd   Team  £199  2d left│
  Business    4     £1,996     46%         │ [View all customers]          │
                                           └───────────────────────────────┘
  [proportional bar: trial/starter/team/business]   ┌───────────────────────────────┐
                                                     │ Trials expiring in 3 days (7) │
                                                     │ Delta Co  jo@delta.io  2d left│
                                                     │ [View all]                    │
                                                     └───────────────────────────────┘

  ──────────────────────────────────────
  Invoice history
  [Search...]  [Status ▾]  [Date range]                [Export CSV]

  Date      Workspace    Plan       Amount    Status    PDF        Action
  Jun 1     Acme Corp    Trial      £0        -         -          -
  Jun 1     Beta Ltd     Team       £199      [Paid]    [PDF ↗]    [Refund]
  May 1     Beta Ltd     Team       £199      [Paid]    [PDF ↗]    [Refund]
  Apr 1     Beta Ltd     Team       £199      [Void]    [PDF ↗]    -

  MRR stat card: text-3xl font-semibold text-amber-400 - amber because it's the key operational metric. All other stat cards: text-2xl font-semibold text-text-primary.

  Tier breakdown: the proportional bar is h-1.5 w-full rounded-full flex overflow-hidden with colored segments. Colors: trial=bg-gray-600, starter=bg-blue-500/60, team=bg-teal-500/60, business=bg-amber-500/60.

  At-risk panels: rounded-lg border border-amber-500/20 bg-amber-500/5 p-3. Each entry is a compact row flex items-center justify-between text-xs. Clicking the workspace name navigates to /customers/[id].

  Invoice status badges: Paid=bg-green-500/10 text-green-400, Open=bg-amber-500/10 text-amber-400, Void=bg-gray-500/10 text-text-muted, Refunded=bg-red-500/10 text-red-400/70.

  "Refund" button: text-[11px] text-red-400 hover:underline. Only on Paid rows. Only visible on group-hover (same pattern as fleet table actions). Opens the refund modal.

  ---
  Audit Log page

  [Date range]  [Admin ▾]  [Action ▾]  [Target type ▾]        [Export CSV]

  Time              Admin         Action                Target             Details
  Jun 23, 14:23     admin@...     Extended trial +14d   Acme Corp →        [+]
  Jun 23, 13:51     admin@...     Kill switch: pause    Aria (Acme Corp) → [+]
  Jun 23, 11:02     admin@...     Added credit £50      Beta Ltd →         [+]
  Jun 22, 17:33     admin@...     Force plan: Team      Gamma Inc →        [+]

    ▼ (expanded row)
      ┌──────────────────────────────────────────────┐
      │  {                                            │
      │    "extendByDays": 14,                        │
      │    "newTrialEndsAt": "2026-07-07T00:00:00Z", │
      │    "previousTrialEndsAt": "2026-06-23T00:00Z" │
      │  }                                            │
      └──────────────────────────────────────────────┘

  Action column: Map raw action strings to human-readable labels:
  extend_trial          -> "Extended trial +Nd"
  force_plan_change     -> "Force plan: [newTier]"
  kill_switch_pause     -> "Kill switch: pause"
  kill_switch_resume    -> "Kill switch: resume"
  pause_workspace_aivas -> "Paused all Aivas"
  resume_workspace_aivas -> "Resumed all Aivas"
  add_credit            -> "Added credit £N"
  refund                -> "Refund issued £N"
  va_assign             -> "VA assigned"
  va_resolve            -> "VA resolved"
  attestation_retry     -> "Attestation retry"

  Target column: Name as a link. workspace target type links to /customers/[target_id]. aiva target type links to /customers/[workspaceId]?tab=aivas. Derive workspace from metadata.

  Expanded row: Full-width colspan row below the clicked row. bg-overlay rounded-lg p-3 font-mono text-xs text-text-secondary. Toggle on/off with [+] / [-].

  Export CSV: Calls GET /api/admin/audit-log?format=csv with current filter params. Response triggers a file download.

