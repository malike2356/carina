# VERLOX Ltd: Business Plan
## Carina, Aiva, and Scout

**Prepared by:** Laud Paul-Gablah, Founder, VERLOX Ltd
**Contact:** lordsesame@gmail.com
**Date:** June 2026
**Classification:** Confidential; prepared for mentor review and incubation programme access

---

## Table of Contents

1. Executive Summary
2. The Problem
3. The Solution
4. Products in Detail
5. Market Opportunity
6. Business Model and Revenue
7. What Has Already Been Built
8. Competitive Position
9. Go-to-Market Strategy
10. Roadmap and Milestones
11. Financial Projections
12. Team
13. The Ask

---

## 1. Executive Summary

Every business is adopting AI agents. None of them have governance.

No kill switch. No audit trail. No compliance evidence. No human oversight when the AI makes a mistake at 3 AM. This is not a theoretical risk. It is happening today, in production, at companies of every size.

VERLOX is building the infrastructure layer that makes AI agents safe enough to trust in serious business contexts. The platform has three interconnected products:

**Carina** is the AI agent operating system. It runs autonomous AI workers across email, WhatsApp, Slack, Telegram, and web. Businesses use it to automate tasks, manage workflows, and deploy AI across their operations. The open-source core is MIT-licensed. The hosted, white-labelled, and enterprise versions are commercial.

**Aiva** is the commercial AI employee built on Carina. Businesses hire a named AI worker in three minutes. The AI handles email, scheduling, data entry, customer support, and any task that can be described in plain English. What makes Aiva unique among every competitor: when the AI cannot handle something, a real human VA from VERLOX's operating VA business steps in, invisibly, in the same channel. No other AI employee company has this.

**Scout** is the trust and governance layer. It monitors every action every AI agent takes, maintains a complete and immutable audit trail, provides a kill switch that stops all agents instantly, and generates compliance evidence packages for SOC 2, ISO 27001, GDPR, and the EU AI Act. Scout is sold embedded in every Carina and Aiva deployment and standalone to companies running any other AI platform.

The business model is modelled on Visa, not Barclays. Visa does not lend money. It routes messages about money and charges a fraction of every transaction. VERLOX does not run AI workloads for clients. It provides the infrastructure through which AI work flows, and charges a metered toll on every event. As partner volume grows, VERLOX's margin grows with no proportional increase in headcount.

This is not a pitch deck. The technology exists. The code is running. What remains is integration, sales, and the network that an incubation programme provides.

Key facts as of June 2026:
- Core platform: 2,050+ TypeScript source files, 984 test files
- Scout: 11,463+ source files, 57 API modules, live on Base Sepolia blockchain
- Mobile application: 583 screens built in React Native
- Channel adapters: 8 built and tested (Discord, Email, Slack, SMS, Teams, Telegram, Web, WhatsApp)
- Skills packs: 23 vertical packs covering automation, data science, legal, finance, devops, and more
- Revenue model: instrumented and partially live (Stripe billing, usage events, partner keys)

---

## 2. The Problem

Three separate problems are converging into one crisis. Companies are not prepared.

### Problem One: AI Agents Are Being Deployed Without Oversight

Seventy-five percent of enterprises are piloting AI agents today. These agents have access to email accounts, internal databases, customer records, cloud servers, and code repositories. They send messages on behalf of humans. They modify files. They make decisions.

None of them are being monitored.

An AI agent that misunderstands one instruction can delete a production database in seconds. An agent running overnight with no human in the loop can cascade a small error into a full outage before anyone wakes up. An agent given access to email can send confidential information to the wrong recipient.

When a board asks "is our AI governed?", the answer today is silence. When a regulator asks for an AI audit trail, there is nothing to produce. When something goes wrong, no one knows exactly what the agent did or why.

This is not hypothetical. It is a gap that grows more dangerous every month as adoption accelerates.

### Problem Two: AI Employees Are Not Actually Reliable

The market for AI employees is growing fast. Businesses want to hire an AI that handles email, books meetings, processes invoices, answers customer questions, and works 24 hours a day without sick days or a pension contribution.

The current options are inadequate. Pure AI employee platforms have no governance. When the AI fails or hallucinates, there is no safety net. The client finds out when a customer complains or a task simply did not happen. At the same time, enterprise AI platforms that do offer oversight cost six figures and require months of implementation. Small and medium businesses are locked out.

The result: businesses either accept unreliable AI with no fallback, or they keep paying human staff for work that AI should handle.

### Problem Three: Compliance Is No Longer Optional

SOC 2. ISO 27001. GDPR. The EU AI Act. These are not theoretical future requirements. They are blocking enterprise procurement today. Investors are asking for compliance posture. Customers are asking for data processing agreements. Auditors are asking for evidence.

Existing compliance tooling was built for large enterprises with dedicated teams. Small and medium companies must figure it out themselves or ignore it and hope no one asks.

The cost of ignoring it is not just a fine. It is losing enterprise contracts, being blocked from government procurement, and having investors walk away.

---

## 3. The Solution

VERLOX's answer is one platform with three products that each address a distinct layer of the problem.

### The Metaphor: Visa, Not Barclays

Visa's 67% gross margin is not a product decision. It is an architectural one. Visa separated two things most companies keep fused: the risk layer (banks lend, default, carry bad debt) and the infrastructure layer (Visa routes messages and audits transactions). Visa never touches money. It touches messages about money and charges a fraction of every one.

VERLOX operates the same way. Partners and clients bring their own AI workloads. VERLOX provides the infrastructure through which that work flows: the routing, the governance, the metering, the compliance. Every AI action on VERLOX infrastructure generates a metered event. VERLOX earns a fraction. The more AI work flows through the platform, the more VERLOX earns, with no proportional increase in cost.

The platform grows like a road, not like a factory. Building a factory requires labour and materials proportional to output. Building a road requires the upfront construction, then collects a toll on every vehicle, forever.

### The Three Products

**Carina** is the road. An AI agent operating system that businesses use to deploy autonomous AI workers. Open-source core (MIT licence) for adoption and distribution. Commercial hosted, white-label, and enterprise tiers for revenue.

**Aiva** is the leading vehicle on the road. VERLOX's own commercial AI employee product, built entirely on Carina. It proves the platform works, generates direct revenue, and validates the use cases that partners will build on top.

**Scout** is the toll booth and compliance checkpoint. It monitors every AI action on Carina infrastructure, generates governance evidence, and is sold as a standalone product to companies using any AI platform. Two revenue streams from one technology investment.

---

## 4. Products in Detail

### 4.1 Carina: The AI Agent Operating System

Carina is best understood as an operating system for AI agents.

A conventional operating system (Windows, Linux) provides: a process scheduler, a memory manager, a filesystem, security, and networking. Applications run on top. The OS does not dictate what applications do. It provides the infrastructure on which applications run.

Carina provides the AI equivalent:

| OS Component | Carina Component |
|---|---|
| Process scheduler | Agent orchestrator, cron scheduler, background worker system |
| Memory manager | PostgreSQL with pgvector, RAG pipeline, session search, episodic memory |
| Filesystem | Skills packs, knowledge chunks, workspace files, resource store |
| Security | Scout (kill switch, egress filter, prompt injection shield, audit log) |
| Networking | 18 channel adapters across messaging, email, web, and API |
| Userspace | Multi-tenant isolation, white-label workspaces, per-tenant billing |

A property management company deploys Carina with a property domain pack. A law firm deploys it with a legal workflow pack. A logistics company builds its own route optimization pack and deploys it on the same infrastructure. Carina does not constrain the use case. It provides the AI foundation. The business builds the application.

**Key technical capabilities (built and verified):**
- 71 distinct tools available to agents (file system, browser automation, shell, subagents, scheduling, messaging, data retrieval)
- 23 vertical skill packs covering automation, data science, devops, finance, legal, marketing, recruitment, research, sales, and more
- 30+ AI model providers supported, with automatic fallback and cost-aware routing
- 8 communication channel adapters: Discord, Email, Slack, SMS, Microsoft Teams, Telegram, Web, WhatsApp
- Multi-tenant architecture with row-level data isolation
- Docker-based self-hosting for operators who want full data control
- MIT-licensed core on npm as `carina-agent`

**Self-hosting is the adoption engine, not the product.** The developer who installs `npm install -g carina-agent` is building something on top of Carina. When they take it to production, they need Scout. When their clients need an AI employee, they point them to Aiva. The open-source core is the top of the funnel.

**White-labelling is a key commercial lever.** A partner who builds a property management SaaS on Carina can deploy it under their own brand. Carina runs invisibly underneath. VERLOX earns a per-event toll on every AI action in that product. The partner earns the subscription. Both grow together.

### 4.2 Aiva: The AI Employee

Aiva is VERLOX's commercial AI employee product. It is the proof that Carina works for real business workflows.

A business visits the Aiva portal, describes what they need, names their AI worker, and has a functional AI employee in three minutes. No technical setup. No API keys. No developer required.

Aiva works across the same channels Carina supports: email, WhatsApp, Slack, Telegram, and web chat. A client emails their Aiva. Their Aiva responds. A client sends a WhatsApp message. Their Aiva replies, updates a spreadsheet, books a meeting, and follows up in the morning.

**Pre-built roles:**
- Property Manager (handles tenancy queries, maintenance coordination, compliance alerts)
- Outreach Coordinator (manages lead emails, follow-up sequences, CRM updates)
- Financial Analyst (processes invoices, reconciles expenses, generates summaries)
- Content Assistant (drafts, edits, schedules social media and blog content)
- Calendar Manager (books meetings, manages availability, sends reminders)
- Customer Support (answers FAQs, escalates complex issues, logs interactions)
- Custom role on request

**The differentiator that cannot be forked:**

When Aiva cannot handle something, a real human VA from VERLOX's operating VA business steps in. In the same channel. Invisible to the client. The client never knows whether they are talking to the AI or the human. The service continues without interruption.

No AI employee competitor has this. Spinnable.ai, Lindy, and similar products are pure AI. When the AI fails, the client finds out. VERLOX already operates a VA business with real clients and real workflows. Aiva is trained on those workflows. The human team is the safety net that makes enterprise adoption possible.

That VA team cannot be replicated by copying the code. It is the moat.

**Scout-governed from day one.** Every Aiva action is monitored, logged, and auditable. A client's IT team can see exactly what their Aiva did, when, and why. A compliance officer can generate an evidence package in one click. No other AI employee platform provides this. This is what makes the pricing premium defensible in enterprise conversations.

### 4.3 Scout: The Trust and Governance Layer

Scout is the product that makes CISOs say yes.

When enterprise procurement asks "is your AI secure?", most AI vendors cannot answer that question definitively. Scout makes the answer concrete, auditable, and verifiable.

Scout operates as a security information and event management (SIEM) system purpose-built for AI agents. It classifies threats across three categories:

- Type 1 (runtime): abnormal agent behaviour, unexpected tool execution, resource exhaustion
- Type 2 (privilege): permission boundary violations, unauthorised data access, lateral movement
- Type 3 (reasoning compromise): prompt injection, jailbreak attempts, adversarial instruction injection

**Core capabilities:**

The kill switch halts every AI agent across every instance instantly. One button from the dashboard or API call. When a board asks "what happens if the AI does something wrong?", this is the answer. It closes enterprise deals.

The audit trail records every action every agent takes, cryptographically signed and immutable. Every tool call, every model request, every response, every escalation. Timestamped and searchable. This is what an auditor asks for and what no other AI platform currently provides.

Compliance export generates evidence packages for SOC 2, ISO 27001, GDPR, and the EU AI Act. A process that currently takes compliance teams months of manual document gathering takes minutes in Scout. This is a direct, measurable time saving for every enterprise customer.

The prompt injection shield operates as a three-layer defence: regex pattern matching, LLM-based intent classification, and tool result scanning. Adversarial inputs attempting to override agent behaviour are detected and blocked before execution.

Egress filtering prevents agents from exfiltrating sensitive data outside approved channels. Honeypots detect data leakage by planting verifiably fake credentials. If those credentials appear anywhere outside the system, Scout flags an active leak.

**Blockchain verification:**

Scout maintains on-chain agent identity and verification records on Base (Ethereum L2) under ERC-8004 (agent identity) and ERC-8126 (verification attestation). This means any third party can verify that a Carina agent is who it claims to be, that its security posture has been independently attested, and that its risk score is current. The public trust API at `carinaai.uk/trust` provides this in one API call.

This is a genuine industry first. No other AI agent platform has on-chain verifiable security attestations. As the EU AI Act and similar frameworks demand proof of AI governance, this becomes a procurement requirement, not a nice-to-have.

**Scout tiers:**

| Tier | Price | What It Provides |
|---|---|---|
| Scout Monitor | GBP 49/month | Observe. Real-time monitoring, threat detection, audit log, 6-channel alerting. |
| Scout Govern | GBP 99/month | Act. Everything in Monitor plus kill switch, compliance export, injection shield, egress control, honeypots, forensic tools. |
| Enterprise | Custom | Dedicated infrastructure, custom data retention, SLA, SOC 2 Type II evidence, regulatory engagement support. |

Scout is also sold as a standalone product to companies running AI agents on any other platform (LangChain, CrewAI, custom builds). This is a significant commercial extension: the governance layer does not require Carina. This means every AI deployment in the market is a potential Scout customer.

---

## 5. Market Opportunity

Three markets are converging. VERLOX is positioned at the intersection of all three.

### Market Sizing

| Market | Size (2026) | CAGR | Projected (2030) |
|---|---|---|---|
| AI Agent Platforms | GBP 4.2 billion | 38% | GBP 15.5 billion |
| AI Workforce / AI Employees | GBP 1.1 billion | 45% | GBP 4.9 billion |
| AI Governance and Compliance | GBP 890 million | 52% | GBP 3.8 billion |

Gartner projects that by 2028, 75% of enterprise software will include AI agent capabilities. Each of those deployments is a candidate for Scout. The compliance automation market as a whole exceeds GBP 15 billion and grows because companies are structurally unable to hire enough compliance staff. They must automate.

### Why Now

The EU AI Act entered into force in August 2024. The first prohibited practices provisions apply from February 2025. High-risk AI system requirements apply from August 2026. Companies that deploy AI agents in customer-facing or decision-making contexts are already asking for compliance evidence their vendors cannot provide.

GDPR enforcement for AI systems is accelerating. The ICO has issued guidance that AI decision-making requires explainability and audit capability. VERLOX builds both.

The window to establish infrastructure-layer positioning is open now, before a well-funded competitor owns it. Infrastructure plays win by being first and being embedded. The Visa/Mastercard duopoly exists because they became the standard when card payments were new. The AI governance standard has not been set yet.

### Target Customers

**Primary - Small and medium technology companies and professional services firms:**
Any company with 10 to 500 staff that is adopting AI tools and needs to demonstrate governance to customers or auditors. This includes technology agencies, law firms, accountancy practices, recruitment firms, marketing agencies, property management companies, and healthcare adjacent services. The UK alone has over 50,000 such firms. Across Europe, the total addressable market in this segment is several hundred thousand companies.

**Secondary - Enterprise:**
Financial services, NHS trusts, legal practices, and government-adjacent organisations that require SOC 2, ISO 27001, or GDPR compliance evidence. These are larger contracts with longer sales cycles but higher lifetime value and stronger network effects (an NHS trust recommending Scout to another trust is a category-defining reference).

**Tertiary - Developer community:**
The open-source Carina community generates Scout leads organically. A developer self-hosts Carina for a client, builds something useful, and then needs Scout when they take it to production with real client data. This is a zero-cost acquisition channel.

---

## 6. Business Model and Revenue

The architecture is designed to generate compounding revenue from multiple streams, all from the same infrastructure investment.

### Revenue Stream One: Platform Subscriptions (Carina)

| Tier | Price | Includes |
|---|---|---|
| Self-Hosted | Free | MIT-licensed core. Self-managed infrastructure. Full agent capability. No Scout. Community support. |
| Cloud | GBP 29/month per workspace | Hosted on VERLOX infrastructure. All agent capabilities. Basic usage analytics. |
| Cloud Plus Scout Monitor | GBP 78/month per workspace | Cloud tier plus Scout monitoring, threat alerts, audit log search. |
| Cloud Plus Scout Govern | GBP 128/month per workspace | Cloud tier plus full Scout governance suite, kill switch, compliance export. |
| Enterprise | Custom | Dedicated deployment, SSO, data residency, SLA, custom Scout retention, SOC 2 evidence package. |

### Revenue Stream Two: AI Workforce Subscriptions (Aiva)

| Tier | Price | Includes |
|---|---|---|
| Starter | GBP 149/month | One named AI worker. All pre-built roles. Email and WhatsApp channels. Human VA backup included. |
| Team | GBP 349/month | Up to 5 named AI workers. All channels. Priority human VA backup. Usage dashboard. |
| Business | GBP 699/month | Up to 15 AI workers. White-label option. Dedicated human VA liaison. Compliance reporting. |
| Enterprise | Custom | Unlimited AI workers. Custom roles. Full integration support. Dedicated VA team. SLA. |

Human VA oversight is included at every tier. It is not a premium add-on. This is a deliberate positioning decision: the inclusion of human oversight is the reason the pricing is premium and the reason enterprise procurement can say yes.

### Revenue Stream Three: Scout Standalone

Scout is sold independently to companies using any AI platform:

- Monitor: GBP 49/month per agent cluster
- Govern: GBP 99/month per agent cluster
- Enterprise: custom

This creates a second sales motion that does not require a Carina or Aiva conversation. A CTO at a company already using LangChain or CrewAI can subscribe to Scout directly. The governance product is platform-agnostic.

### Revenue Stream Four: Platform Metered Billing (Tollbooth)

Every AI action on VERLOX infrastructure generates a metered event. Beyond the included monthly volume for each tier, partners and enterprise clients pay per event:

| Event Type | Billing Unit |
|---|---|
| AI message (input plus output tokens) | Per 1,000 tokens at cost plus margin |
| Tool call executed | Flat micro-fee per call |
| Skill pack invoked | Flat micro-fee per invocation |
| Scout audit record | Flat micro-fee per record |
| Webhook delivered | Flat micro-fee per webhook |
| Memory operation | Flat micro-fee per read/write |

This is usage-based billing layered on top of subscription. At low volumes, clients stay within their included allowance. As AI adoption grows inside a client's organisation, their usage grows and their metered spend grows with it, without a sales conversation. Revenue expands automatically.

### Revenue Stream Five: Marketplace (Skill Packs)

Third parties publish skill packs to the Carina marketplace. Every installation of a paid pack generates a split:
- Pack author receives their configured revenue share
- VERLOX receives its platform share
- A transaction fee applies

The schema and submission infrastructure exist. The marketplace creates an ecosystem where the platform becomes more valuable as more authors publish, and VERLOX earns passively on every transaction indefinitely.

### Revenue Stream Six: Partner API (White-Label)

Technology companies who want to embed AI employee or AI governance capabilities in their own products become certified VERLOX platform partners. They get API access, white-label deployment rights, and a revenue share arrangement. VERLOX earns a percentage of every event their product generates. The partner earns their subscription revenue.

This is the purest expression of the Visa model. VERLOX builds the road. Partners build businesses on it. VERLOX earns a toll on every journey.

Partner tiers already designed in the codebase:
- Starter: GBP 99/month, up to 5 client workspaces, revenue share at agreed basis points
- Agency: GBP 299/month, up to 25 client workspaces, higher revenue share
- Enterprise: custom, unlimited client workspaces, custom revenue share, dedicated support

### Unit Economics

The 65% margin floor is already encoded in the platform (`MARGIN_FLOOR = 0.65` in `margin-report.ts`). The per-event billing system is designed to pass through AI model costs plus a margin that maintains this floor. The hosted infrastructure cost (server, bandwidth, model API calls) scales with usage. The marginal cost of one additional client workspace is low. The marginal cost of one additional partner routing millions of events is near zero above the infrastructure cost.

This is the structural reason the Visa model creates exceptional returns at scale. VERLOX is building toward those unit economics from the architecture level.

---

## 7. What Has Already Been Built

This section addresses the question that matters most for any investor or incubation programme: is this real, or is it a pitch?

The code is real. The metrics below are drawn directly from the production codebase, not from projections.

### Core Platform (core.carinaai.uk)

| Metric | Count |
|---|---|
| TypeScript source files | 2,050+ |
| Test files | 984 |
| Distinct tools in agent toolset | 71 |
| Skill packs | 23 |
| Channel adapters (built and tested) | 8 |
| CLI commands | 49 |
| Supported AI model providers | 30+ |
| Hosted SaaS tables (partner, org, billing) | Active in production |
| Partner API key infrastructure | Built (tollbooth sprint) |
| Usage event metering | Built |
| Stripe billing integration | Built |

**Skill packs cover:** automation, borehole Africa, core engineering ops, CMS operations, creative basics, data science, devops, extended email, finance, UK legal, marketing, media, meeting management, ML ops, productivity, recruitment, research, sales and CRM, smart home, social media, and a developer template.

**Channel adapters cover:** Discord, Email, Slack, SMS, Microsoft Teams, Telegram, Web, and WhatsApp, all tested with automated test suites.

**The tollbooth infrastructure built in the most recent sprint:**
- `platform_events` table: canonical event schema with `partner_id`, `org_id`, `event_type`, `tokens_in`, `tokens_out`, `model`, `latency_ms`
- Partner API key management: create, scope, rate-limit, revoke, hash-store
- API gateway at `api.carinaai.uk`: authenticated, rate-limited, scoped partner endpoints
- Stripe metered usage records, wired to event volume
- Partner admin console: usage dashboard, partner management, marketplace submission review, SLA credits
- Partner self-service developer portal: key management, usage charts, CSV export

### Scout (console.labyrinthscout.com)

| Metric | Count |
|---|---|
| TypeScript source files | 11,463+ |
| API route modules | 57 |
| Alert channel adapters | 6 (Discord, Email, Slack, SMS, Telegram, WhatsApp) |
| On-chain status | Live on Base Sepolia (ERC-8004 agent identity + ERC-8126 verification) |
| Public trust API | Live at carinaai.uk/trust |

Scout is not a concept. It is a running system with a verified on-chain security posture, a live public trust API, and 57 distinct API endpoints covering every aspect of AI agent governance.

### Frontend Applications

| Application | Platform | Scale |
|---|---|---|
| app.carinaai.uk | Next.js web app | Full workspace UI, billing, developer portal, onboarding |
| admin.carinaai.uk | Next.js admin panel | Platform admin, partner management, marketplace |
| carina-desktop | Tauri (Rust + TypeScript) | Desktop application |
| carinaMobile | React Native / Expo | 583 screens built |

The mobile application alone represents an enormous engineering investment. 583 screens is a full-featured mobile product.

### Infrastructure

- Docker Compose production deployment
- VPS on Contabo (server: `aman`)
- PostgreSQL (core data) + SQLite (app layer)
- Redis (sessions, caching, background jobs)
- Nginx reverse proxy with TLS
- GitHub Actions CI pipeline
- Base Sepolia blockchain integration (live)

---

## 8. Competitive Position

### The Landscape

The AI agent space is crowded at the application layer. ChatGPT, Claude, Copilot, Gemini, and dozens of vertical products compete for end-user attention. This is not where VERLOX competes.

VERLOX competes at the infrastructure and governance layer, where there is almost no competition.

### Direct Agent Comparisons

| Capability | Hermes | OpenClaw | ChatGPT / Claude | Carina (built) |
|---|---|---|---|---|
| General-purpose agent | Yes | Partial | Yes | Yes |
| Multi-tenant SaaS | No | No | Yes (closed) | Yes |
| White-label / partner API | No | No | No | Yes |
| Prompt injection shield | Partial | Limited | No | Scout 3-layer |
| Kill switch | No | No | No | Yes |
| Immutable audit trail | No | No | No | Yes |
| Compliance export (SOC 2 etc.) | No | No | No | Yes |
| On-chain trust attestation | No | No | No | Yes (live) |
| Open source | MIT | MIT | No | MIT (core) |
| Human VA fallback (AI employee) | No | No | No | Yes (Aiva) |
| Skill marketplace | Partial | Limited | Plugins (closed) | Yes (built) |
| Per-event metered billing | No | No | Yes (closed) | Yes |
| Revenue share for partners | No | No | No | Yes |

### The Governance Gap

Every AI agent platform in the market has the same structural weakness: they are optimised for capability and ignore governance. This is rational at the product development stage. It becomes a commercial liability the moment enterprise procurement gets involved.

CISOs do not block AI adoption because they dislike AI. They block it because they cannot answer the audit question: "Tell me exactly what your AI systems did, when they did it, and prove it has not been tampered with." No current AI platform can answer that question. Scout is built to answer it.

This is VERLOX's wedge into enterprise: not competing on raw AI capability (where Anthropic and OpenAI have structural advantages), but competing on the governance layer that makes enterprise adoption possible.

### The VA Moat

Aiva's human VA backing is not replicable by a software competitor. A company can fork Carina's open-source code. They cannot fork a trained, operational VA team with real client workflows. Building that team takes time, capital, and operational expertise. VERLOX already has it. Aiva is built on top of a running business, not a promise.

---

## 9. Go-to-Market Strategy

### Phase One: Land with Governance (Months 1 to 6)

The first sale is not a Carina sale. It is a Scout sale.

Every company that has deployed AI agents in the last 12 months has a CISO or IT lead who is quietly worried about governance. They do not have the budget for a full enterprise AI platform. They have GBP 49 to GBP 99 per month to know what their AI is doing.

The Scout Monitor tier at GBP 49 is the entry product. Low barrier. Clear value. No commitment to migrate their entire AI stack. This is the conversation that opens the account.

Once Scout is installed and the governance dashboard is showing the client what their AI is doing, two things happen. First, they see the value and upgrade to Scout Govern for the kill switch and compliance export. Second, the conversation about Carina and Aiva begins naturally, because the client is now in a governance conversation with VERLOX and trust is established.

**Initial target:** 50 Scout Monitor subscribers in the first six months. At GBP 49 per month, this generates GBP 2,450 MRR. Small, but it funds the sales motion and builds the reference base for the next phase.

### Phase Two: Expand with Aiva (Months 4 to 12)

The Aiva sales motion is separate from the Scout motion and runs in parallel.

The target for Aiva is the small business owner who wants the result (an AI employee who reliably handles work), not the technology. This is an inbound marketing play: content, testimonials, comparison pages, and referrals from the VA business's existing client network.

Aiva converts on the human backup story. When a prospective client asks "what happens when the AI gets it wrong?", the answer is "a trained VA steps in automatically, in the same channel, and you never notice." That answer closes deals that pure AI employee products cannot close.

**Initial target:** 20 Aiva Starter subscribers in the first six months. At GBP 149 per month, this generates GBP 2,980 MRR. Combined with Scout, that is approaching GBP 5,500 MRR at the six-month mark.

### Phase Three: Scale with Partners (Months 6 to 18)

The platform partner programme is the multiplier.

A technology company that builds property management software does not want to build an AI employee feature from scratch. They want to embed VERLOX's AI employee capability in their product in days. The partner API and white-label system make this possible.

One partner with 100 client workspaces generates more ARR than 100 direct clients, with a fraction of the sales effort. VERLOX earns a per-event toll on every AI action in that partner's product. The partner earns the subscription revenue from their clients. Both grow together.

The target for year two is five certified platform partners. This is achievable because the technology and commercial infrastructure already exist. What is needed is the network to reach the right companies, which is exactly what an incubation programme provides.

### Enterprise Pipeline (Months 12 to 36)

Enterprise requires a longer sales cycle but produces transformative contract values and category-defining reference customers.

Target enterprise sectors:
- Financial services: FCA-regulated firms face explicit AI governance requirements under SYSC rules. Scout is the compliance answer.
- NHS and healthcare: NHS-DSP Toolkit compliance for AI systems. Scout's audit trail satisfies this requirement.
- Legal: SRA guidelines on AI. A law firm that can show a complete AI audit trail differentiates on governance.
- Government procurement: G-Cloud framework listings require security evidence. Scout provides it.

One NHS trust or financial services firm as a reference customer changes the enterprise conversation permanently.

---

## 10. Roadmap and Milestones

### Now to 90 Days: Integration and Launch

- Complete Aiva onboarding portal (self-serve signup, role configuration, channel binding)
- Wire Stripe billing to Aiva subscriptions
- Public launch of Aiva with the five pre-built roles
- Five beta customers on Aiva Starter, providing feedback
- Scout Monitor publicly available at GBP 49/month
- Publish partner programme page and developer documentation
- Submit to Anthropic and OpenAI partner programmes (distribution)

### 90 Days to 6 Months: Traction

- 20 Aiva subscribers across Starter and Team tiers
- 50 Scout Monitor subscribers
- First platform partner signed (technology company building on Carina)
- Skills marketplace launched (third-party pack submissions, approval, and distribution)
- Status page at `status.carinaai.uk` live with SLA monitoring
- SOC 2 Type II audit process initiated

### 6 Months to 12 Months: Scale

- GBP 15,000 MRR (combined Aiva, Scout, and platform subscriptions)
- Three certified platform partners, generating metered revenue
- Enterprise pilot with a financial services or legal firm
- Base mainnet registration for Scout trust attestation (upgrade from testnet)
- First marketplace revenue from third-party skill pack authors

### 12 Months to 36 Months: Category Establishment

- GBP 75,000 MRR across all revenue streams
- Ten or more certified platform partners
- SOC 2 Type II certification complete
- NHS or financial services enterprise reference customer
- Marketplace with 50+ certified skill packs generating passive revenue
- Series A fundraise (or profitability, depending on growth rate)

---

## 11. Financial Projections

The following projections are conservative and based on the initial sales motion targeting Scout and Aiva direct subscriptions, with partner revenue entering from month seven.

### Monthly Recurring Revenue Projection

| Month | Aiva MRR | Scout MRR | Platform MRR | Partner MRR | Total MRR |
|---|---|---|---|---|---|
| Month 3 | GBP 1,490 | GBP 980 | GBP 580 | - | GBP 3,050 |
| Month 6 | GBP 4,470 | GBP 3,430 | GBP 1,450 | GBP 500 | GBP 9,850 |
| Month 9 | GBP 8,940 | GBP 6,860 | GBP 3,480 | GBP 2,200 | GBP 21,480 |
| Month 12 | GBP 14,900 | GBP 11,270 | GBP 5,800 | GBP 5,400 | GBP 37,370 |
| Month 18 | GBP 26,820 | GBP 19,600 | GBP 11,600 | GBP 16,200 | GBP 74,220 |

These projections assume:
- Aiva: 10 Starter subscribers by month 3, growing to 50 by month 9, with 20% upgrading to Team
- Scout: 20 Monitor subscribers by month 3, with 15% upgrading to Govern
- Platform: 20 Cloud workspace subscriptions by month 3, growing as Aiva clients add direct workspace access
- Partner: first partner live at month 7, three partners by month 12 at average GBP 1,800/month each

### Cost Structure

The largest ongoing costs are AI model API calls (passed through to clients at cost plus margin), infrastructure (server, bandwidth), and the VA team (included in Aiva pricing and already operational). The VA team cost is a step function, not a linear one: the same team serves 5 Aiva clients and 50 Aiva clients before a headcount addition is needed.

Development cost at current stage is founder time (effectively zero in cash terms). Once funded, a first engineering hire extends capacity without changing the unit economics materially.

### Path to Break-Even

At GBP 9,850 MRR (month 6 projection), monthly operating costs (infrastructure: approximately GBP 400, model APIs: approximately GBP 800 at forecast volume, VA team: approximately GBP 3,500) total approximately GBP 4,700. Contribution margin is strongly positive from month 6 onward.

The business does not require large-scale fundraising to reach break-even. The ask (detailed below) is for acceleration, not survival.

---

## 12. Team

**Laud Paul-Gablah, Founder and CEO**

18 years in systems design and infrastructure. MSc in Cybersecurity with Distinction, University of Portsmouth. Founder and operator of VERLOX Ltd and its VA business since 2011.

Built and deployed production systems serving thousands of users across multiple industries. Designed and built the entire Carina, Aiva, and Scout codebase solo to the current state: 2,050+ source files in the core platform, 11,463 files in Scout, 583 mobile screens, 984 test files, 71 agent tools, and the full tollbooth commercial infrastructure.

The founding story is not a competitive differentiator in itself. But it is evidence of what this founder can execute with no team, no funding, and no runway. With support, the execution rate accelerates.

Arrived in the UK in January 2024 with GBP 80 and a scholarship that was never paid. Earned an MSc with Distinction while working three jobs. Has been building VERLOX and Carina since then.

**On the need for a team:**

The current state of the product represents one founder working full time. The next phase requires:
- A sales and business development hire to work the Scout and Aiva pipelines while the founder continues building
- A marketing hire or contractor to produce content, run comparison page SEO, and manage the developer community
- Potentially a second engineer to accelerate the Aiva onboarding portal and the skills marketplace

All of these can be deferred until MRR justifies them. The roadmap above reaches positive contribution margin before any additional hires are required.

---

## 13. The Ask

VERLOX is seeking engagement with an incubation programme and introduction to investors for two reasons: access to a network that accelerates the enterprise sales motion, and capital to fund the Aiva launch and the first six months of the Scout sales motion.

### What an Incubation Programme Provides

**Mentorship on go-to-market.** The technology is built. The gap is sales strategy: how to identify the right first enterprise customer, how to structure the partner programme commercial terms, how to position Carina for procurement conversations without getting lost in technical detail.

**Network.** One warm introduction to a CISO, IT director, or CTO at a company deploying AI agents is worth months of cold outreach. The right introduction to a legal firm, an NHS trust, or a financial services company converts the Scout story from a product pitch to a compliance conversation, which is a different and much faster sale.

**Credibility.** An incubation programme's name alongside VERLOX's enterprise positioning signals legitimacy to procurement. This is not vanity. It is a concrete commercial advantage that accelerates the first enterprise contract.

**Investor introductions.** Seed capital to fund the Aiva launch and six months of the Scout sales motion, while the founder continues building.

### Capital Requirement

The Aiva public launch requires:
- Email ingestion pipeline completion (the AI reads and processes inbound email): approximately 3 to 4 weeks of engineering time
- Aiva onboarding portal (self-serve signup, role configuration): approximately 2 to 3 weeks
- Stripe billing wire-up for Aiva subscriptions: approximately 1 week

Total engineering time to launch: approximately 6 to 8 weeks at current velocity.

Operating costs for the first six months post-launch (infrastructure, VA team, initial marketing):
- Infrastructure and hosting: GBP 400/month (GBP 2,400 total)
- VA team operational cost during the Aiva ramp: GBP 3,500/month (GBP 21,000 total)
- Marketing (content, SEO, developer community): GBP 1,500/month (GBP 9,000 total)
- Legal and compliance (terms of service, data processing agreements, GDPR framework): GBP 5,000 one-time

**Total six-month requirement: approximately GBP 40,000 to GBP 50,000.**

This is not a large seed round. It is the bridge between the current state (built but not publicly launched) and the first meaningful MRR milestone (GBP 10,000 MRR at month six), at which point the business funds itself.

### What Investors Receive

- Equity in a technology company with working infrastructure, not a prototype
- Exposure to three converging markets (AI platforms, AI workforce, AI governance)
- A moat that is not just code (the VA team and operational workflows)
- A founder with a demonstrated ability to build complex systems alone at speed
- A revenue model (tollbooth infrastructure) designed for compounding margin at scale
- The only AI agent platform with blockchain-verified security attestation, currently live

---

## Closing Statement

The AI governance problem is real, urgent, and underserved. The technology to solve it exists. VERLOX has built it, largely alone, in a condensed timeframe that demonstrates both technical capability and founder commitment.

Carina is the road. Scout is the toll booth. Aiva is the proof that the road works.

The platform earns a toll on every AI action that runs through it. As AI adoption grows, the platform earns more without proportional cost increases. As the governance requirement becomes unavoidable, Scout becomes the compliance layer that every AI deployment must have.

The moment for infrastructure positioning is now. The standard has not been set. VERLOX is positioned to set it.

---

*VERLOX Ltd. Registered in England and Wales. Founder: Laud Paul-Gablah. Contact: lordsesame@gmail.com*

*Carina is MIT-licensed and available at carinaai.uk. Scout is available at labyrinthscout.com. This document is confidential and prepared for mentor and investor review only.*
