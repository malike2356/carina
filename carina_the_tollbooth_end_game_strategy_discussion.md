Carina As  Tollbooth


 Visa has never owned a single credit card. That sounds wrong. So does this. Their operating margin is 67%.
  Apple's is 26%. Google's is 32%. Visa keeps more profit per pound of revenue than any technology company most
  people can name. And they do it by owning nothing except the road. The card in your wallet belongs to your bank,
  Barclays, HSBC, whoever issued it. They lent you the money, they carry the risk if you don't pay. Visa built the
  infrastructure that connects your bank to every merchant on earth. Every Every time you tap, insert, or swipe, a
  message crosses Visa's network Seconds. Authorization, confirm. Money moves. Visa charges a toll for every single
  journey. Not one percent. Fraction of a percent, but across two hundred fifty nine billion transactions last
  year, that fraction generates over thirty two billion dollars, roughly twenty five billion pounds, in annual
  revenue. No inventory, no lending, no credit risk, no bad debt. Once you build the road, the cost of one more
  vehicle using it is almost zero. Every additional transaction is pure margin. That is why the number is sixty-
  seven. There is a name for this in financial analysis, a toll booth business. You don't own the vehicles, you
  don't own the cargo, you own the only road that connects every buyer to every seller on earth. There are only two
  roads, Visa and Mastercard. Every bank, every merchant, every country, you You either pay their toll or you don't
  travel. One more layer. Your air miles and cash back rewards are funded by fees extracted from merchants on every
  transaction. Merchants build that cost into their prices. The person paying cash in the queue behind you is
  subsidizing your business class flight. It is a silent wealth transfer from the unbanked to the rewarded. And it
  has been running For sixty years, every purchase you have ever made on a card contributed to a margin of sixty-
  seven percent. Every coffee, every train ticket, every online order, you have been paying this toll your entire
  adult life. You just never saw the booth. The pinned comment has the exact figure Visa collected from UK card
  spending last year. This is where i want to see carina in the future. we build the workspace - people build on
  it. we become the tollbooth. advice what can we do in coe, structure, business, operations etc to archive that?


RESPONSE BY CODEX FROM OPEN AI
• Putting the Visa analogy into Carina terms: you do not want to be “an app people use”. You want to become the
  workspace layer that other people, teams, agents, tools, models, and workflows depend on to get work done. The
  tollbooth is not the UI. The tollbooth is the trusted execution, identity, context, policy, and distribution
  layer.

  To get there, Carina needs to become infrastructure.

  Core Strategy

  Build Carina as a workspace operating system, not just an agent.

  That means Carina should own:

  1. Workspace context
      - Files, docs, repos, tasks, conversations, memories, decisions, policies.
      - The durable “state of work” across tools.
      - If people build inside Carina, their work history and operational context should live there.

  2. Execution
      - Agents, automations, scheduled jobs, approvals, code actions, browser actions, API actions.
      - Carina should be where work gets safely executed, not only discussed.

  3. Trust and governance
      - Permissions, audit logs, approvals, sandboxing, role policies, org controls.
      - This is where businesses will pay. They do not just want intelligence; they want controlled intelligence.

  4. Distribution
      - Marketplace for playbooks, agents, connectors, workflows, templates, skills.
      - Third parties should be able to build on Carina and reach users through Carina.

  5. Payments or usage metering
      - Every agent run, workflow execution, premium connector, hosted workspace, model call, compliance action, or
        marketplace sale can become a toll.

  Business Model

  Do not rely only on subscriptions. Subscriptions cap upside.

  You want layered monetization:

  - Seat pricing: teams pay per user.
  - Workspace pricing: companies pay per active workspace or project.
  - Usage pricing: executions, model calls, automations, storage, compute.
  - Marketplace take rate: third parties sell agents, playbooks, connectors, templates.
  - Enterprise controls: SSO, audit, retention, compliance, private deployment.
  - Managed execution: Carina runs important workflows reliably, with monitoring and accountability.

  The long term tollbooth is the marketplace plus execution layer. If someone builds a sales agent, legal review
  agent, code migration agent, support triage agent, or compliance workflow on Carina, Carina takes a percentage
  every time it runs or sells.

  Product Structure

  I would structure Carina around four layers:

  1. Workspace
      - Projects, files, tasks, memory, team context, connected accounts.
      - This is the user-facing surface.

  2. Agent Runtime
      - Tool execution, model routing, policies, approvals, retries, logs.
      - This is the infrastructure layer.

  3. Playbook System
      - Reusable workflows for specific outcomes.
      - This should become the product’s main unit of value: “install this playbook to handle X”.

  4. Marketplace
      - Internal first, public later.
      - Start with VERLOX-authored playbooks, then allow trusted partners, then open developers.

  Operational Priorities

  In the next phase, focus less on adding random agent features and more on making Carina dependable as
  infrastructure.

  Priorities:

  - Make every action auditable.
  - Make permissions explicit.
  - Make workspace memory portable and durable.
  - Make playbooks versioned, testable, and shareable.
  - Make integrations boringly reliable.
  - Make billing measurable per workspace, user, execution, and marketplace item.
  - Make deployment easy for businesses that want private or hybrid control.
  - Make failures visible: logs, retries, rollback, human approval.

  If Carina becomes the place where businesses let agents act, then trust is the moat.

  Company Structure

  You likely want teams or ownership areas like this:

  - Core Runtime: agent execution, tools, sandboxing, model routing.
  - Workspace Product: UI, collaboration, memory, project surfaces.
  - Playbooks and Marketplace: packaged workflows, developer ecosystem, revenue share.
  - Integrations: GitHub, Slack, Google, Microsoft, Linear, Stripe, CRMs, browsers, IDEs.
  - Trust and Enterprise: security, audit, admin, compliance, deployment.
  - Growth and Solutions: templates, customer onboarding, vertical use cases.

  The key is that “playbooks” should not be treated as content. They are closer to apps. They need owners, quality
  standards, versioning, analytics, and monetization.

  Most Important Shift

  Do not try to be Visa by charging people for access to Carina.

  Become Visa by making other people’s work flow through Carina.

  That means the north star should be:

  > Number of valuable work executions completed through Carina.

  Not chats. Not signups. Not prompts. Executions.

  Examples:

  - A PR opened.
  - A support ticket resolved.
  - A contract reviewed.
  - A report generated.
  - A deployment checked.
  - A customer onboarded.
  - A workflow approved.
  - A recurring business process completed.

  Once Carina owns execution, the toll becomes natural. Then the business can charge a small amount across a very
  large number of useful actions.





RESPONSE BY DEEPSEEK

This is the clearest product vision you've articulated. Let me break it down structurally.
    
    
    
    The Visa Analogy Mapped to Carina
    
    Layer: The road
    Visa: Payment network
    Carina: AI Agent Gateway + Scout
    ────────────────────────────────────────
    Layer: Who owns the card
    Visa: Banks (Barclays, HSBC)
    Carina: Businesses (Glenn's company, your clients)
    ────────────────────────────────────────
    Layer: Who lends money
    Visa: Banks
    Carina: LLM providers (Anthropic, OpenAI)
    ────────────────────────────────────────
    Layer: What travels
    Visa: Transactions
    Carina: Agent actions -- tool calls, memory ops, channel messages
    ────────────────────────────────────────
    Layer: The toll
    Visa: Fraction of a cent per swipe
    Carina: Fraction of a penny per agent action
    ────────────────────────────────────────
    Layer: Why they pay
    Visa: No road = no commerce
    Carina: No Scout = no enterprise trust
    ────────────────────────────────────────
    Layer: Margin
    Visa: 67%
    Carina: Your goal: 70%+ (marginal cost near zero once infrastructure is built)
    
    
    
    What You Need to Build the Tollbooth
    
    1. Core -- Own the Road
    
    Right now: Carina is a product people install. That's a car, not a road.
    
    What changes: Carina becomes infrastructure. Every AI agent interaction that touches a business system routes through Carina's Gateway. If an agent wants to access a bank API, a healthcare record, a government service -- the request goes through Carina, verified by Scout, logged immutably. The agent doesn't have to be built on Carina. The AGENT CALLER does. The organisation that needs trust pays the toll.
    
    The technical shift:
    
    
    Today:       AI Agent -> Bank API
    Tomorrow:    AI Agent -> Carina Gateway -> Scout verify -> Bank API
                                          -> Audit log
                                          -> Compliance record
    
    
    Carina doesn't build the agent. It verifies the agent. That's the road.
    
    2. Trust -- The Only Road People Pay For
    
    Visa's road matters because banks trust it. Mastercard's road matters for the same reason. There is no third road anyone trusts.
    
    Scout is the trust layer. But right now Scout verifies Carina agents. For the tollbooth model, Scout needs to verify ANY agent -- regardless of what it's built on. OpenAI, Anthropic, LangChain, custom Python scripts. If it touches a regulated system, it passes through Scout.
    
    The Scout Road:
    
    
    Agent -> Scout Gateway
      -> Identity: ERC-8004 on-chain registration
      -> Behaviour: Real-time prompt injection detection
      -> Authorization: What is this agent allowed to access?
      -> Audit: Immutable record of every action
      -> Compliance: SOC2, ISO27001, GDPR report auto-generated
    
    
    The agent builder gets Scout verification. The business trusting the agent gets Scout protection. Both sides pay the toll.
    
    3. Integration -- The On-Ramps
    
    Visa built on-ramps: POS terminals, card readers, online payment gateways. Every merchant has a way to connect.
    
    Carina's on-ramps:
    
    | On-Ramp                 | What it Does                                                                  |
    |-------------------------|-------------------------------------------------------------------------------|
    | Scout SDK               | Any agent framework drops in, gets Scout governance. One import.              |
    | Scout Proxy             | Transparent HTTP proxy. Agent calls go through Scout without code changes.    |
    | OpenAI-compatible API   | Any tool that speaks OpenAI API speaks Carina. Already in prompts.            |
    | ACP Adapter             | Agent Communication Protocol. IDE agents route through Carina. Already built. |
    | n8n node                | Businesses using n8n workflows route AI calls through Scout.                  |
    | Zapier/Make integration | No-code automation platforms.                                                 |
    
    The more on-ramps, the more traffic on your road.
    
    4. Pricing -- The Toll Structure
    
    Visa charges a fraction. You charge per verified action. Not per agent. Not per seat. Per VERIFICATION.
    
    
    Free:       Basic prompt guard. Community trust.
                Carina agents only. Public trust score API.
    
    Monitor:    49 GBP/month. Real-time monitoring. Dashboard.
                Alerts to Slack/Teams/email. Up to 5 agents.
    
    Govern:     79 GBP/month. Full compliance. SOC2/ISO27001 reports.
                Immutable audit. Custom policy packs. Up to 20 agents.
    
    Enterprise: Custom. Unlimited agents. On-chain attestation.
                Custom compliance frameworks. SLA. Dedicated tenant.
    
    Per-action pricing (beyond included volume):
      - 0.001 GBP per verification call
      - 0.005 GBP per compliance report generation
      - 0.01 GBP per on-chain attestation
    
    
    The fraction is tiny. Multiplied by millions of agent actions per month across thousands of businesses, it becomes the 67% margin.
    
    5. The Unfair Advantage -- Why There Will Only Be Two Roads
    
    Visa and Mastercard exist because nobody can replicate 60 years of bank relationships, merchant agreements, and regulatory approvals in a weekend.
    
    Carina's moat:
    
    - MIT license. Free to build on. Free to fork. The road is open. The trust layer (Scout) is paid. This is the Red Hat model -- free software, paid enterprise trust.
    - Scout's on-chain trust. ERC-8004 agent registration. Public risk score API. Weekly attestations. Nobody else has this. Building it took months. Replicating it takes months.
    - Already live. Carina processes real agent traffic. Scout detects real threats. The infrastructure exists. Competitors are still writing READMEs.
    - First mover in AI agent governance. When regulators require AI agent audits, Scout is already the standard. The regulation IS the tollbooth. You didn't build the law -- you built the compliance before the law existed.
    
    
    
    What to Do Next
    
    Code
    
    1. Scout Proxy -- transparent HTTP proxy, any agent can route through it. One deploy, instant governance. (Write the prompt.)
    2. OpenAI-compatible endpoint -- already in prompts (gap-23). Build it. Every tool that speaks OpenAI API can route through Carina.
    3. Scout SDK -- already exists in 03-frontends/sdks/labyrinth-scout-sdk/. Make it drop-in for LangChain, CrewAI, AutoGPT.
    
    Business
    
    4. Scout as a standalone product. Right now Scout is positioned as Carina's security add-on. Reposition: Scout is the governance layer for ALL AI agents. Carina is one agent that uses it. "Built on Carina, verified by Scout."
    5. Scout marketplace. Companies list their agents on Scout. Verified. Scored. Public trust API. Like Visa listing which banks are on their network.
    
    Operations
    
    6. Self-serve onboarding for Scout. Right now Scout onboarding goes through you. Build the automated pipeline: sign up, get API key, drop in SDK, see dashboard. 15-minute setup.
    7. Usage-based billing. Track every verification call. Invoice monthly. The tollbooth needs a meter.
    
    The Visa Moment
    
    When a UK bank says "our AI agents must pass Scout verification before accessing customer data" -- that's your Visa moment. When an NHS trust says "all AI clinical tools must be Scout-governed" -- that's your second road. When regulators write "AI agents must maintain immutable audit trails" and Scout already does it -- that's your monopoly.
    
    You're not building an AI agent. You're building the road every AI agent travels on.



RESPONSE BY CURSOR

Your Visa analogy is directionally right, but the precise lesson is narrower than “high margins.” Visa’s power comes from owning the only interoperable settlement layer while outsourcing credit risk, inventory, and customer relationships to banks and merchants. Carina’s version of that is not “sell more Aiva seats.” It is make every AI action in production pass through your network, then charge a small toll per journey.

Here is how that maps to code, structure, business, and operations given what you already have (Carina kernel, Aiva as first app, Scout as governance).

1. Define what the “road” actually is
Visa does not own cards. It owns authorization + clearing + standards between two sides.

Carina’s road is:

Layer	What you own	What you do NOT own
Protocol
Agent identity, memory, channels, tool execution, skills, audit events
End-customer relationships (partners/Aivas do)
Settlement
Metering, billing, Scout telemetry, compliance exports
Model inference risk (meter it or BYOK)
Standards
Skill pack format, channel adapters, Scout policy schema
Vertical workflows (property, legal, etc.)
Tollable events (things you meter and log once, forever):

Inbound/outbound message on any channel
Tool call executed
Skill invoked / compound workflow step
Human handover (VA escalation)
Scout audit record written
Webhook / integration sync
If it is not an event on your bus, you cannot toll it. That is the architectural test.

2. Code and platform structure
A. Event bus first, apps second
Today you have products (Carina cloud, Aiva, Scout). For toll-booth economics you need one canonical event stream:

agent.action → { workspace, agent, channel, tool, outcome, scout_policy, bytes, latency }
Every product emits the same events. Billing, Scout, analytics, and partner dashboards all read from that stream. Do not build billing logic inside Aiva UI. Build it on the event layer.

Concrete moves:

SCOUT_KEY / telemetry pipeline you already wire: make it mandatory for “production” tier, not optional.
Public metering API: GET /v1/usage, webhooks for quota thresholds (you have pieces of this in Ops/billing docs).
Skill packs as packages, not features: third parties publish packs; Carina takes % of installs or per-invocation fee.
Channel adapters as plugins: WhatsApp, email, Slack should be “Carina Connect”; partners cannot bypass your gateway without losing Scout.
B. Split “kernel” from “applications” hard
Your incubation doc already says “Windows, not Word.” Operationalize it:

Repo / surface	Role
core.carinaai.uk
Kernel API, workers, channels, billing, Scout ingest
app.carinaai.uk
Carina workspace (power users, devs)
admin.hireaiva.co.uk
Aiva (one vertical app; proof, not the business)
Scout console
Governance product (standalone revenue)
Skill packs / Hub
Marketplace (third-party cargo)
Rule: Nothing in Aiva should be impossible to build as a skill pack on bare Carina. If it is, you are accidentally becoming Barclays (owning the app and the road).

C. Identity and portability = switching cost
Visa wins because re-plumbing every merchant is painful. Carina wins when:

One agent memory works across 40+ channels (you market this already)
Skills compound across sessions (your moat section on carinaai.uk)
Scout audit history is the compliance record customers cannot recreate elsewhere
Make export possible but make the audit chain and live governance non-portable without Scout. That is your version of “leave Visa’s network.”

D. API monetization before UI monetization
Your property-saas docs already say API revenue can exceed UI. For toll-booth mode:

Free self-host MIT = merchants accepting cash (adoption, no toll yet)
Paid cloud + Scout + metered API = every tap on the network
BYOK = they bring fuel (models); you still toll the road
Never sell unlimited inference on a flat seat. That is lending money at 0% interest.

3. Business model: three tolls, not one product
Visa has interchange + network fees + value-added services. Carina should have:

Toll 1: Platform usage (volume)
Small fee per event:

Per message, per tool call, per automation run
Tiered packs (Starter / Team / Business on Aiva are prototypes; generalize to credits on the kernel)
Toll 2: Trust (Scout)
Scout is your interchange on risk. Enterprises pay because:

Kill switch
Audit trail
Policy enforcement
Compliance exports
Sell Scout standalone to teams using Cursor, Codex, or custom agents (you already position this). That is tolling traffic that never touches Aiva.

Toll 3: Ecosystem (marketplace)
Skill pack revenue share (15-30%)
Certified partner / white-label license (annual + per-workspace)
“Powered by Carina” badge (like Visa logo on card; you have powered-by-carina.svg on hireaiva already)
Aiva’s role: It is not the toll booth. It is the flagship merchant that proves the road works, like Visa’s own marketing campaigns. hireaiva.co.uk sells the outcome; Carina sells the infrastructure.

4. Operations: what to centralize vs delegate
Centralize (you must own this)
Platform SRE, nginx, core API uptime
Scout ingest, audit storage, policy engine
Billing, metering, Stripe, dunning
Channel gateway reliability (one WhatsApp integration, not 50 broken ones)
Security certifications (SOC 2 path on Scout, not per-partner)
Delegate (partners / VAs / customers own this)
End-user support for vertical apps (“my property Aiva got it wrong”)
Domain training data and FAQs
Sales to SMBs in niche industries
Human VA judgment on escalations (you operate this today; long term license the playbook to regional VA partners)
Critical: VERLOX VA backup is a moat for Aiva, not the kernel business. If every Aiva customer needs your humans, you are Barclays (balance sheet risk). Path:

Now: VA backup differentiates Aiva
Next: VA handover as a Scout-governed skill any partner can fulfill
Later: VERLOX operates escalation for premium tier only; partners white-label the rest
5. Go-to-market sequence (practical)
Adoption
Toll
Scale
Self-host Carina free
Devs and agencies build
Scout on every prod agent
Metered cloud API
White-label partners
Skill marketplace
Phase 1 (now): Aiva + Scout on hireaiva proves revenue and governance story.
Phase 2: Publish “Build on Carina” partner program: agencies deploy for clients on Carina cloud; you bill per workspace + per event.
Phase 3: Scout-only customers (agents not built on Carina UI).
Phase 4: Marketplace; Carina becomes default rail for UK SMB AI employees.

6. Metrics that prove you are Visa, not a consultancy
Visa-like metric	Carina equivalent
Transactions/year
Agent events/year (messages + tool calls)
Take rate
Revenue / total event volume
Network participants
Workspaces + partners + channels connected
Marginal cost per txn
Infra cost per event (should → ~0)
% volume on-network
Actions that hit Scout telemetry vs shadow AI
If revenue scales with headcount (more VAs, more custom deployments), you are a services firm. If revenue scales with events while headcount is flat, you are building the booth.

7. What to avoid (the Barclays trap)
Custom enterprise builds that bypass standard events and billing
Flat unlimited AI on Team tier without credit caps
Owning vertical logic in core instead of skill packs
Aiva-only story in investor materials; lead with platform + Scout toll
Competing with partners in their verticals after certifying them
8. One sentence strategy
Carina is the authorization network for AI work; Scout is the compliance interchange; Aiva is the proof-of-concept merchant; everyone else builds the stores, but every sale runs on your rails.

Immediate next steps (90 days, aligned with your repo)
Unify metering on one event schema in core (message, tool, skill, escalation, audit).
Document partner API + white-label path (you have pieces in cloud, custom domains, SSO docs).
Scout standalone GTM: one line in prod config, sell governance without Carina workspace.
Skill pack submission flow on hub.carinaai.uk with rev-share terms.
Split P&L mentally: Platform (events × margin) vs Aiva (CAC + churn proof) vs Services (VA; cap exposure).
If you want, I can turn this into a one-page internal strategy doc under carina/01-devends/planning/strategy/ or a founder-facing outline for the INVESTORS / incubation narrative, with a explicit “toll events” table mapped to your current API routes.




RESPONSE BY CLAUDE

This is one of the most important questions you can ask about Carina's future. The Visa analogy is exact, not
  approximate. Let me map it precisely and tell you what to do.

  ---
  The structural insight, restated for Carina

  Visa's 67% margin comes from one design decision made in 1958: they separated the risk layer (banks) from the
  infrastructure layer (Visa). Banks lend. Visa routes. Banks default. Visa never does.

  Carina's current risk exposure follows the same pattern you should target:

  ┌────────────────────────────────┬───────────────────────────────────────────┬─────────────────┐
  │              Visa              │             Carina equivalent             │  Current state  │
  ├────────────────────────────────┼───────────────────────────────────────────┼─────────────────┤
  │ Card issuers carry credit risk │ Users bring their own keys (BYOK)         │ Partially there │
  ├────────────────────────────────┼───────────────────────────────────────────┼─────────────────┤
  │ Merchants build into prices    │ AI cost passed to workspace owners        │ Partially there │
  ├────────────────────────────────┼───────────────────────────────────────────┼─────────────────┤
  │ Visa owns the routing layer    │ Carina owns orchestration, memory, tools  │ Built           │
  ├────────────────────────────────┼───────────────────────────────────────────┼─────────────────┤
  │ Two roads for the planet       │ Carina + one other for AI workspace infra │ Not yet         │
  └────────────────────────────────┴───────────────────────────────────────────┴─────────────────┘

  The gap between where Carina sits now and where Visa sits is not technical. It is architectural and commercial. Here
  is what to do in each domain.

  ---
  Code

  1. Make the core embeddable, not just accessible.

  Right now Carina is a product you log into. The tollbooth model requires that Carina becomes infrastructure other
  products run on top of, invisibly. The next architectural layer to build:

  api.carinaai.uk  -  public authenticated gateway

  Every call goes through one endpoint. You meter at the gateway. Every partner who builds on Carina routes AI
  sessions, memory reads, skill executions, and tool calls through that gateway. That is the toll booth.

  Concretely in code:
  - GET /api/v1/session - start an AI session bound to a workspace
  - POST /api/v1/message - route a message through Carina brain with tool access
  - POST /api/v1/memory - write or retrieve workspace memory
  - GET /api/v1/skills - list available skills for this workspace
  - Each call records a usage_event row with partner_id, tokens, and tool calls

  The Propreneur bridge already proves the model works. Generalise it.

  2. Meter at every layer, not just the billing layer.

  The usageEvents table exists. Extend it:

  ALTER TABLE usage_events ADD COLUMN partner_id uuid;
  ALTER TABLE usage_events ADD COLUMN tool_calls integer DEFAULT 0;
  ALTER TABLE usage_events ADD COLUMN memory_ops integer DEFAULT 0;
  ALTER TABLE usage_events ADD COLUMN skill_calls integer DEFAULT 0;
  ALTER TABLE usage_events ADD COLUMN platform_fee_pence integer DEFAULT 0;

  This gives you the data to charge on multiple dimensions simultaneously, exactly like interchange (per transaction)
  plus assessment (volume) plus network fee (monthly). The customer sees a single monthly number. Underneath, four
  separate meters are running.

  3. Build partner API keys with scoped permissions.

  The byokKeys table pattern is correct. Clone it for platform API keys:

  workspace_partner_keys
  - id, workspace_id, partner_name
  - key_hash, scopes (json: ['session', 'memory', 'skills'])
  - rate_limit_rpm, monthly_usage_cap
  - revenue_share_bps  <- basis points, e.g. 50 = 0.5%

  When a partner calls the gateway using their key, you know who they are, what they are allowed to do, and how to
  calculate the toll.

  4. SSO as infrastructure lock-in.

  The SSO module you are building is more valuable than it appears. Every enterprise that configures their IdP through
  Carina becomes structurally dependent on Carina for auth. Switching means migrating auth. Nobody does that
  voluntarily. This is exactly how Visa embeds: once your BIN is registered to their network, ripping it out is a
  years-long project.

  ---
  Structure

  1. Separate the road from the vehicles.

  Rename the products in your internal architecture to reflect what they are:

  Carina Platform  (the road)
    └── Carina Workspace  (a vehicle Verlox built)
    └── Aiva              (another vehicle Verlox built)
    └── Propreneur bridge (a vehicle a partner built)
    └── [Future partner]  (a vehicle someone else will build)

  The platform is the business. The vehicles are product bets. Visa's product bets (Visa Checkout, Visa Direct) are
  secondary. The network is primary.

  2. Revenue share model, not licence fee.

  Do not charge partners a flat monthly fee. That is a SaaS model. The tollbooth model charges a fraction of every
  transaction:

  - Partner builds a property SaaS on Carina
  - Their users generate AI sessions
  - Each session costs the partner some amount in Carina platform fees
  - Partner builds that into their pricing
  - As the partner grows, your revenue grows with zero additional infrastructure cost

  The exact mechanism: platform_fee_bps on every usage_event attributed to a partner workspace. Aggregate monthly.
  Invoice via Stripe. 0.5% of their AI spend at low volume, negotiated down at enterprise volume. This is interchange.

  3. Tiered partner certification.

  Visa has issuing banks (full members), merchant acquirers (intermediaries), and merchants (end points). You need the
  same hierarchy:

  - Certified platform partners: access to full API, revenue share agreement, listed on carinaai.uk/partners
  - Integration partners: use pre-built connectors, flat monthly fee
  - Workspace users: current subscription model, no API access

  Do not try to serve all three with the same product. They have different risk profiles and different values.

  ---
  Business

  1. The network effect you must build.

  Visa's moat is the two-sided network. Every merchant accepts Visa because every cardholder has one. Every cardholder
  carries Visa because every merchant accepts it.

  Carina's equivalent: every AI skill published on the platform is available to every workspace. Every workspace that
  contributes memory patterns or validates skills makes the network more valuable for every other workspace. This only
  works if you build the right data structures:

  - Skills marked visibility: 'public' go into a curated marketplace
  - Workspace owners opt in to contributing anonymised usage patterns for skill improvement
  - The platform learns from aggregate usage; individual workspaces benefit from aggregate learning

  This is what Visa calls the network effect. The more transactions, the better the fraud models, the safer the
  network, the more merchants trust it.

  2. Carry no risk, own the infrastructure.

  The reason Visa's margin is 67% and a bank's margin is 25% is that Visa carries no credit risk. You must maintain
  this discipline for every product decision:

  - AI model costs: user pays via BYOK or Carina passes through at cost with a usage fee on top
  - Data liability: workspace data stays in the workspace; Carina processes but does not own
  - Compliance liability: workspace owners accept terms that put GDPR responsibility on them as data controllers
  - Model liability: Carina routes, does not generate; the model provider is the origin

  Every time a team member proposes "we should store X" or "we should host Y", the question is: does storing or
  hosting this create risk that reduces our margin? If yes, find a way to make the partner or user hold it instead.

  3. The silent wealth transfer.

  The Visa point about cash users subsidising rewards is worth applying. In Carina's model:

  - Low-usage workspaces on a flat monthly plan subsidise the infrastructure that high-usage workspaces consume
  - Simple skill users subsidise the memory and orchestration layer that power users rely on
  - This is fine and intentional; do not correct it with usage-based pricing for everyone immediately

  The flat subscription base gives you predictable revenue to fund infrastructure. The platform API with usage fees
  gives you margin expansion as volume grows. Run both simultaneously.

  ---
  Operations

  1. The toll booth never closes.

  Visa's uptime is not an engineering goal, it is a commercial contract. A merchant who cannot process cards loses
  every sale. The same applies once partners depend on Carina infrastructure.

  What this means operationally:
  - Move from a single VPS to a redundant deployment before launching the partner API
  - Publish an SLA. Start with 99.9% (allows 8.7 hours downtime per year). Target 99.95%.
  - Every incident that breaches SLA triggers a credit on the partner's next invoice. This makes downtime have a
  direct financial cost to you, which focuses engineering priorities correctly.
  - The UPTIME-MONITORS.md file you already have is a starting point. It needs to become a customer-visible status
  page at status.carinaai.uk.

  2. Audit as a product line.

  Visa sells transaction data back to banks as analytics. Carina should sell audit and intelligence back to partners:

  - GET /api/v1/analytics/usage - partner sees their AI spend by day, tool, skill, model
  - GET /api/v1/analytics/trends - benchmarked against anonymised platform averages
  - POST /api/v1/reports/compliance - export audit log in formats regulators accept

  This turns a compliance cost (you are already writing audit_log rows) into a revenue-generating feature for
  enterprise partners. It also deepens the switching cost: your partner's compliance reports reference Carina's audit
  trail. Migrating away means losing the audit history.

  3. Price the road separately from the vehicles.

  Operationally the hardest change: decouple Carina's pricing from features and attach it to usage. The current model
  charges for access to features (workspace plan). The tollbooth model charges for volume of use.

  This does not mean abandoning subscription. It means adding a second pricing dimension:

  Workspace plan  (flat monthly)  - access to the road
  Usage fee       (per unit)      - cost per vehicle on the road

  The ratio shifts over time. As volume grows, usage fee revenue overtakes subscription revenue. At that point you
  have the Visa model: flat fee becomes a floor, and the ceiling is unlimited because every additional transaction
  costs you near zero.

  ---
  What to build first

  In priority order:

  1. This quarter: Instrument every usage event with partner_id. You cannot charge for usage you cannot measure.
  2. This quarter: Launch api.carinaai.uk as a documented, authenticated gateway with one certified partner
  (Propreneur is already there).
  3. Next quarter: Publish the partner program page, revenue share terms, and certification process. The first three
  partners should be hand-selected and subsidised to prove the model.
  4. Six months: Skills marketplace with revenue share for skill pack authors. Every published skill that generates
  workspace usage pays the author a fraction and Carina a fraction.
  5. Twelve months: SOC 2 Type II certification. This is the equivalent of a bank BIN registration - it is the ticket
  that lets you sell to enterprise, which is where the Visa-level margin lives.

  The Visa model did not start at 259 billion transactions. It started with a single road between one bank and one set
  of merchants in Fresno, California, in 1958. The margin came from refusing to carry risk, owning the routing layer,
  and expanding the network until leaving was more expensive than staying.

  That is the plan.

