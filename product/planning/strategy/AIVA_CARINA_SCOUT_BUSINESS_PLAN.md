# Aiva, Carina, and Scout Business Plan

Prepared for mentor and investor conversations  
Company: VERLOX Ltd  
Date: June 2026

## 1. Executive Summary

VERLOX is building an AI work infrastructure company with three connected products:

- **Carina**: the open source AI workspace and agent runtime.
- **Aiva**: a managed AI employee product built on Carina for business owners who want outcomes, not infrastructure.
- **Scout**: the governance, monitoring, and control layer for AI agents in production.

The immediate commercial product is Aiva. Aiva lets a small business hire an AI worker that can handle customer questions, messages, follow-ups, bookings, admin workflows, and recurring tasks across channels such as email, WhatsApp, Telegram, Slack, and web. It is powered by Carina, which provides the agent runtime, memory, tools, channels, and skills. It is protected by Scout, which provides audit logs, monitoring, policy enforcement, alerting, and kill switch controls.

The long-term company is not just an AI assistant business. The ambition is to become the trusted workspace and control layer through which AI work is executed. Aiva proves that Carina can run useful AI employees for real businesses. Scout makes that work governable enough for companies to trust. Over time, Carina becomes the platform other people build on, Aiva becomes the flagship application, and Scout becomes the trust layer that can govern any agent, including agents not built directly inside Carina.

The core thesis is simple: AI agents will become common in businesses, but businesses will not let autonomous systems touch customers, data, payments, or production workflows without memory, audit, control, approvals, and accountability. VERLOX is building that missing layer.

## 2. The Problem

AI adoption is moving faster than business operations can safely absorb.

Most current AI products are still chat windows. They answer questions, but they do not reliably own workflows. They often lack durable memory, channel continuity, auditability, handoff, and operational controls. This creates a gap between what businesses want from AI and what they can safely deploy.

Small businesses want:

- Someone to answer customer queries.
- Someone to follow up leads.
- Someone to handle recurring admin.
- Someone to keep context across email, chat, web, and documents.
- Someone to escalate when human judgement is needed.

Developers and technical teams want:

- A flexible agent runtime.
- Tool execution.
- Memory and workflow context.
- Integrations across channels.
- Model choice and bring-your-own-key support.
- A way to govern agent behavior once it touches real systems.

Enterprises and regulated teams want:

- Audit trails.
- Kill switches.
- Alerts.
- Policy enforcement.
- Data controls.
- Evidence for compliance and incident review.

The market is producing agents, but not enough operational infrastructure around them. That is the opportunity.

## 3. The Product Stack

### 3.1 Carina: The AI Workspace and Runtime

Carina is the underlying AI agent engine. It is designed to be self-hosted, extensible, and useful across many channels and workflows.

Current product capabilities visible in the codebase and marketing site include:

- Open source core under MIT license.
- Persistent memory.
- Skill generation and skill packs.
- 71 tools.
- 40+ channels.
- 23 LLM providers.
- CLI, web, messaging, and API surfaces.
- Workspace features such as notes, documents, calendar, email, research, kanban, image handling, and model comparison.
- Safety flagging for risky commands.
- Billing and usage-metering foundations.
- Stripe checkout paths.
- Carina Cloud and Ops plan structures.
- Scout telemetry integration through a `SCOUT_KEY`.

Carina is the platform layer. It is intended for developers, agencies, teams, and later ecosystem partners who want to build AI workflows or products without starting from scratch.

### 3.2 Aiva: The Managed AI Employee

Aiva is the business-facing product built on Carina. It packages the runtime into a simpler promise: hire an AI employee.

Aiva is aimed at business owners who do not want to self-host, configure models, or reason about agent infrastructure. They want an assistant that can do useful work quickly.

Current Aiva positioning and product structure include:

- "Hire an Aiva" workflow in the cloud app.
- Role creation in plain English.
- Role templates.
- Channel selection across email, WhatsApp, Slack, Telegram, and web.
- English UK, English US, French, Spanish, and Arabic language options.
- Worker creation through `/api/aiva/workers`.
- Worker management pages.
- Billing, subscription, and slot-limit handling.
- A 15-day free trial.
- Current listed pricing:
  - Starter: GBP 49 per month.
  - Team: GBP 99 per month.
  - Business: GBP 299 per month.
  - Enterprise: custom.
- Human VA backup as a service differentiator.
- Scout governance monitoring included in Aiva plans.

Aiva is the first commercial proof that Carina can power AI workers for real businesses.

### 3.3 Scout: The Governance and Control Layer

Scout is the trust product. It monitors agent behavior, detects risky patterns, and gives teams control over agent execution.

Current Scout product and pricing structure include:

- Standalone Scout site and console.
- Node.js SDK package.
- Live security dashboard.
- Prompt injection detection.
- Audit logs.
- Event acknowledgement.
- Browser dashboard alerts.
- Kill switch and tool quarantine.
- Outbound alerts via Telegram, email, and Slack.
- Honeypots and deception features.
- GDPR exports.
- Public trust API.
- Enterprise options including on-premise or VPC deployment.
- Current listed pricing:
  - Scout Monitor: GBP 49 per month.
  - Scout Govern: GBP 79 per month.
  - Enterprise: custom.

Scout is important because it turns agent execution into something businesses can supervise, audit, and trust.

## 4. Product Vision

The vision is to become the trusted operating layer for AI work.

In the short term, this means selling Aiva to businesses that need practical automation and admin support.

In the medium term, this means turning Carina into the platform on which agencies, developers, and partners build their own AI workers, workflows, and vertical products.

In the long term, this means Scout becomes the governance layer used by any production AI agent, whether the agent was built on Carina, another framework, or a custom internal system.

The strategic direction is:

- **Aiva proves demand**: businesses will pay for AI workers that handle real work.
- **Carina scales supply**: developers and partners can build many AI workflows on the same runtime.
- **Scout creates trust**: governed agents can safely move into higher-value workflows involving customers, data, approvals, and production systems.

This creates a platform opportunity. The company can earn revenue from subscriptions today, then add usage-based, governance, API, marketplace, and partner revenue over time.

## 5. Target Customers

### 5.1 Initial Customer Segment: UK Small Businesses

The first customers for Aiva are small businesses that have repetitive communication and admin work but cannot afford a large operations team.

Examples:

- Service businesses.
- Agencies.
- Consultants.
- Local operators.
- Online businesses.
- Admin-heavy teams.
- Businesses with customer messages across email, WhatsApp, web forms, and social channels.

They feel the pain immediately: missed leads, slow replies, manual follow-ups, inconsistent admin, and limited staff capacity.

Aiva gives them an AI worker with human backup and governance included.

### 5.2 Second Customer Segment: Developers and Technical Teams

Carina serves developers, builders, and agencies that want to build AI workflows without building the entire runtime.

They care about:

- Open source.
- Self-hosting.
- Tool execution.
- Model choice.
- Channel support.
- Persistent memory.
- Skill packs.
- API access.
- Governance through Scout.

This group can become both customers and distribution partners.

### 5.3 Third Customer Segment: Governance Buyers

Scout serves teams that already use AI agents and now need oversight.

These buyers may not need Aiva. They may already use Cursor, Codex, Claude Code, OpenAI tools, custom scripts, or internal agents. Their problem is not agent creation. Their problem is control.

Scout can become a standalone governance product for this group.

## 6. Value Proposition

### For Business Owners

Aiva gives business owners a way to delegate daily work without hiring a full-time employee or learning AI infrastructure.

The value is:

- Faster customer response.
- Fewer missed leads.
- Less manual admin.
- Continuity across channels.
- A worker that remembers business context.
- Human VA backup when needed.
- Built-in governance and audit.

### For Developers and Agencies

Carina reduces the time and risk of building agent products.

The value is:

- Agent runtime already built.
- Tools and channels already integrated.
- Memory and skills already available.
- Open source adoption path.
- Commercial cloud and governance path.
- Future marketplace opportunity.

### For Teams Deploying Agents in Production

Scout gives teams confidence that AI agents can be observed and controlled.

The value is:

- Visibility into every tool call and model decision.
- Audit history.
- Kill switch.
- Policy enforcement.
- Alerts.
- Exportable evidence.
- A control layer that can sit above multiple agents.

## 7. Market Timing

The timing is favorable because AI is moving from experimentation to workflow execution.

The first wave of AI adoption was chat: ask a model a question and receive an answer. The next wave is agentic work: systems that take action, use tools, send messages, call APIs, update records, and make decisions inside business workflows.

This creates two simultaneous markets:

- Businesses want AI employees that perform work.
- Businesses also need governance before letting those agents operate freely.

Many companies are currently stuck between excitement and fear. They want the productivity upside, but they are concerned about hallucination, data leakage, uncontrolled spending, destructive actions, and lack of accountability.

VERLOX sits directly in that gap. Aiva makes AI useful. Scout makes it governable. Carina makes it extensible.

## 8. Business Model

The business model has three layers.

### 8.1 Subscription Revenue

Current listed subscription paths:

- Aiva Starter: GBP 49 per month.
- Aiva Team: GBP 99 per month.
- Aiva Business: GBP 299 per month.
- Scout Monitor: GBP 49 per month.
- Scout Govern: GBP 79 per month.
- Carina Cloud or Ops plans: currently represented around GBP 19 to GBP 49 per month in the codebase and pricing paths.
- Enterprise: custom.

This gives the company a near-term SaaS revenue path with simple packaging.

### 8.2 Usage and Metering Revenue

The larger opportunity is usage-based revenue. Carina already contains usage records, model usage tracking, credit gating, billing tables, top-up packs, and subscription infrastructure.

The long-term metered units can include:

- Messages.
- Tool calls.
- Automation runs.
- Agent actions.
- Scout audit events.
- Governance checks.
- Human handoffs.
- Premium channel usage.
- API calls.

This is where the company can move beyond flat SaaS pricing. If AI work volume grows, revenue can grow with the number of useful actions running through the platform.

### 8.3 Ecosystem and Partner Revenue

Once Carina has enough adoption, the company can add:

- Skill pack marketplace.
- Revenue share on paid workflows.
- Certified partner program.
- White-label Aiva deployments.
- Agency licenses.
- Enterprise governance contracts.
- Managed escalation services.

The strategic goal is not to personally build every vertical AI worker. The goal is to build the runtime, trust layer, and commercial rails that allow many AI workers to exist.

## 9. Competitive Positioning

The market has many AI assistants, agent frameworks, automation tools, and governance tools. VERLOX is differentiated by combining all three layers:

- A practical business-facing AI employee product.
- An open source agent runtime.
- A dedicated governance and control product.

Most competitors sit in only one category:

- Chatbots answer questions but do not own workflows.
- Automation tools execute workflows but often lack agent memory and governance.
- Agent frameworks help developers build but do not provide a complete business product.
- Security tools monitor systems but are not deeply tied to agent execution.

VERLOX has a stronger combined story:

- Aiva proves business value.
- Carina proves technical extensibility.
- Scout proves operational trust.

The positioning should be:

> Aiva is the AI employee businesses can hire today. Carina is the runtime it runs on. Scout is the control layer that makes AI work safe enough for production.

## 10. Defensibility and Moat

The moat is not one model or one prompt. Models will change. The defensibility comes from the operating layer around AI work.

Key defensibility factors:

### 10.1 Workflow Memory

Carina is designed around persistent memory and skills. The more work runs through the system, the more context and reusable workflow knowledge it accumulates.

### 10.2 Channel Distribution

Carina already positions around 40+ channels. Businesses do not want an isolated AI window. They want work handled wherever customers and teams already communicate.

### 10.3 Governance History

Scout creates audit history and operational evidence. Once a business relies on Scout for compliance and incident review, switching away is harder than switching chatbots.

### 10.4 Open Source Adoption

Carina Core being MIT licensed lowers adoption friction. Developers can inspect it, self-host it, and build on it. The commercial layer can monetize cloud, governance, enterprise deployment, and usage.

### 10.5 Integrated Stack

The combination of Aiva, Carina, and Scout is stronger than each product alone. Aiva creates demand, Carina creates extensibility, Scout creates trust.

## 11. Go-to-Market Strategy

### Phase 1: Sell Aiva Directly

The first commercial push should focus on Aiva because it is the easiest product for non-technical buyers to understand.

Target message:

> Hire an AI employee to handle your messages, follow-ups, and admin. Powered by Carina. Protected by Scout. Backed by humans when it matters.

Channels:

- Founder-led sales.
- Warm network.
- Local business communities.
- LinkedIn founder content.
- Demo-led outreach.
- Mentor and investor network.
- Incubator introductions.
- Case-study driven landing pages.

Sales motion:

- Offer 15-day free trial.
- Set up first Aiva quickly.
- Focus on one painful workflow first.
- Show response time, message volume, and saved admin time.
- Upsell Team or Business when more roles or channels are needed.

### Phase 2: Productize Onboarding

To scale Aiva, onboarding must become repeatable.

Needed assets:

- Clear buyer personas.
- Role templates.
- Demo scripts.
- Setup checklist.
- First-week success plan.
- ROI calculator.
- Customer case study format.
- Human escalation process.
- Support playbook.

The goal is to reduce founder effort per customer while keeping quality high.

### Phase 3: Sell Scout to Technical Teams

Scout should be positioned as the control layer for production AI agents.

Target message:

> If an AI agent can touch data, customers, tools, or production systems, it needs Scout.

Channels:

- Developer communities.
- AI engineering content.
- Security and compliance content.
- Open source Carina adoption.
- SDK distribution.
- Integration guides.

The initial technical sale can be simple: one config key for Carina users, SDK or proxy path for other agents.

### Phase 4: Build the Partner Ecosystem

Once the platform is stable and early customers are live, VERLOX can invite agencies, consultants, and developers to build on Carina.

Partner opportunities:

- Agencies deploy Aiva-like workers for niche businesses.
- Developers publish skill packs.
- Consultants build business-specific workflows.
- Scout certifies production deployments.
- VERLOX earns platform, governance, and marketplace revenue.

## 12. Product Roadmap

### Next 90 Days

- Convert the business plan into a concise pitch deck.
- Define the first three Aiva customer profiles.
- Create demo workflows for each profile.
- Make Aiva onboarding repeatable.
- Tighten pricing and plan language across the sites.
- Standardize telemetry and usage events across Aiva, Carina, and Scout.
- Build a basic customer success dashboard: active Aivas, messages handled, escalations, response time, and Scout events.
- Create one mentor-ready live demo.
- Create one investor-ready product walkthrough.

### 3 to 6 Months

- Launch focused Aiva pilots.
- Capture measurable case studies.
- Improve role templates and first-run setup.
- Make Scout onboarding self-serve.
- Create public integration docs for Scout SDK.
- Add more billing and usage reporting.
- Improve analytics for churn, activation, and expansion.
- Package Business tier for higher-value customers.

### 6 to 12 Months

- Launch partner program.
- Create a skill pack submission and review process.
- Add marketplace foundations.
- Expand Scout to govern agents outside Carina.
- Build enterprise deployment path.
- Add stronger audit export and compliance reporting.
- Develop white-label packaging for agencies.

### 12 to 24 Months

- Move toward a platform model where third parties build AI workers on Carina.
- Make Scout a recognized trust layer for production AI agents.
- Monetize per-event usage at scale.
- Build a marketplace for skills, workflows, and certified agents.
- Position VERLOX as infrastructure for governed AI work.

## 13. Key Metrics

The business should track metrics that prove both immediate SaaS traction and long-term platform potential.

### Aiva Metrics

- Number of active Aivas.
- Active customers.
- Trial-to-paid conversion.
- Monthly recurring revenue.
- Churn.
- Expansion from Starter to Team or Business.
- Messages handled.
- Human escalations.
- Average response time.
- Customer time saved.
- Customer satisfaction.

### Carina Metrics

- Installs.
- Active workspaces.
- Active channels.
- Tool calls.
- Skill invocations.
- API usage.
- Cloud conversion.
- Developer retention.
- Partner-built workflows.

### Scout Metrics

- Active Scout instances.
- Monitored agents.
- Events ingested.
- Threats detected.
- Policy blocks.
- Kill switch events.
- Audit exports.
- Standalone Scout revenue.

### Platform Metrics

- Total agent actions.
- Revenue per agent action.
- Gross margin per event.
- Percentage of actions covered by Scout.
- Number of partners.
- Marketplace revenue when launched.

## 14. Financial Model Direction

The near-term financial model is straightforward SaaS:

- Aiva subscriptions.
- Scout subscriptions.
- Carina Cloud or Ops subscriptions.
- Enterprise contracts.

The medium-term model adds usage:

- Additional message volume.
- Additional worker slots.
- Governance event volume.
- Premium channels.
- API calls.
- Credit top-ups.

The long-term model adds ecosystem revenue:

- Skill pack marketplace.
- Partner revenue share.
- Certified deployments.
- White-label licenses.
- Enterprise governance.

The important strategic point for investors is that VERLOX is not limited to selling one AI assistant. Aiva is the entry point. The larger upside is the infrastructure layer underneath it.

## 15. Operational Plan

### Product and Engineering

Priorities:

- Keep Carina stable as the runtime.
- Keep Aiva simple for business users.
- Keep Scout reliable as the governance layer.
- Standardize metering and events.
- Reduce manual setup work.
- Improve observability.
- Maintain strong security practices.

### Sales and Customer Success

Priorities:

- Sell narrow workflows first.
- Avoid over-customization.
- Capture measurable outcomes.
- Build repeatable onboarding.
- Use human VA backup carefully as a premium support layer, not as the main delivery model.
- Turn successful deployments into case studies.

### Governance and Trust

Priorities:

- Make audit logs easy to understand.
- Make Scout dashboards useful to non-technical operators.
- Create clear incident and escalation workflows.
- Document what Scout does and does not guarantee.
- Prepare for future compliance needs.

## 16. Risks and Mitigation

### Risk: The Company Becomes a Services Business

If every Aiva customer needs heavy custom work, margins and scale suffer.

Mitigation:

- Productize onboarding.
- Use templates.
- Limit custom work by tier.
- Push repeatable workflows into skill packs.
- Treat human VA support as an escalation layer, not the core product.

### Risk: AI Output Quality Is Inconsistent

AI workers can make mistakes, especially in open-ended workflows.

Mitigation:

- Start with constrained workflows.
- Use clear role definitions.
- Add approval gates.
- Use Scout monitoring.
- Escalate uncertain cases to humans.
- Improve knowledge and training over time.

### Risk: The Market Is Crowded

Many companies are building AI assistants and agent frameworks.

Mitigation:

- Lead with the full stack: Aiva plus Carina plus Scout.
- Focus on governed AI work, not generic chat.
- Build trust and operational proof.
- Use open source as distribution.
- Build partner and marketplace paths.

### Risk: Security and Compliance Expectations Increase

Customers may expect stronger certifications and formal audits.

Mitigation:

- Use Scout as the compliance foundation.
- Build exportable audit evidence.
- Prepare SOC 2 readiness.
- Offer enterprise deployment options.
- Keep security documentation current.

## 17. Why This Fits an Incubation Program

This business is a strong incubation candidate because it has:

- A clear market problem.
- A working product stack.
- A practical initial product in Aiva.
- A platform vision through Carina.
- A trust and governance angle through Scout.
- A founder-led path to early customers.
- A technical moat already visible in the codebase.
- Multiple revenue paths.
- Clear investor narrative.

The incubation program can help with:

- Customer discovery.
- Product positioning.
- Sales discipline.
- Investor readiness.
- Pilot introductions.
- Enterprise mentor access.
- Governance and compliance strategy.
- Pricing and packaging.

## 18. Funding Use

Initial funding would be used to turn the working product stack into a repeatable commercial business.

Priority uses:

- Product polish for Aiva onboarding.
- Scout self-serve onboarding.
- Customer success and support systems.
- Security and reliability improvements.
- Sales materials and demo assets.
- Pilot program execution.
- Case study development.
- Cloud infrastructure.
- Part-time or contractor support for design, frontend, DevOps, or customer operations.

The goal of the first funding stage is not to build from zero. It is to commercialize what already exists and prove repeatable demand.

## 19. The Ask

We are looking for help with:

- Entering an incubation program.
- Sharpening the investor narrative.
- Finding the first serious pilot customers.
- Validating pricing and packaging.
- Connecting with mentors in SaaS, AI infrastructure, security, and go-to-market.
- Preparing for angel or pre-seed investment.

The ideal early investor or mentor understands that this is not just another chatbot. It is an attempt to build the operating and governance layer for AI work.

## 20. Closing Narrative

Aiva is the product customers can understand today: an AI employee that helps with business communication and admin.

Carina is the engine that makes Aiva possible: memory, tools, channels, skills, and workspace execution.

Scout is the layer that makes the future safe enough to scale: monitoring, audit, policy, and control.

Together, they form a path from product to platform. The short-term business is selling useful AI workers. The long-term business is becoming the trusted infrastructure through which AI work runs.

That is the opportunity VERLOX is building toward.
