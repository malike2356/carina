# The Carina Platform

*Prepared for Lord McMensa - June 2026 - Confidential*

| Carina: the AI workspace on which any governed AI product can be built. |
| :---- |

# **Executive Summary**

Businesses are moving from AI chatbots to AI agents. These agents read emails, update CRMs, book meetings, message customers, run workflows, and make decisions across business systems. That shift creates a new problem: once AI can take action, companies need governance, auditability, security, and a way to stop the system when something goes wrong.

I am building Carina as the workspace and infrastructure layer for this new market. The idea is simple: people and companies should be able to build AI products on Carina the same way businesses build on cloud platforms today, but with governance, human oversight, compliance, and commercial rails included from the start.

The current platform has four connected products:

| Product | Position |
| :---- | :---- |
| Carina Mutant | Open-source agent core for developers, agencies, and companies building AI products |
| Carina Aiva | Managed AI employee product for businesses that want AI staff without technical setup |
| Petraclus | AI-native cybersecurity product built on the Carina agent core |
| Labyrinth Scout | Governance, audit, kill switch, and compliance layer for AI agents |

Each product can stand alone. Together, they create a platform strategy: Mutant brings builders in, Aiva proves the managed business use case, Petraclus opens the security market, and Scout becomes the trust layer that every serious AI deployment needs.

# **What I Have Built**

This is not only an idea or a slide deck. There is already a substantial codebase, working product architecture, commercial infrastructure, and deployment pathway.

Carina is designed around one belief: the future will not belong to one AI app. It will belong to the workspace where many AI apps, agents, workflows, and vertical products can be built, governed, monetised, and scaled.

## **1. Carina Mutant - The Open-Source Agent Core**

Carina Mutant is the open-source agent core. It is the engine under the wider platform: memory, tools, workflows, model routing, communication channels, role configuration, and multi-tenant product infrastructure.

Developers, agencies, consultants, and companies can install Mutant, self-host it, and build AI products on top of it. This gives Carina a community and developer adoption route while keeping the commercial products separate.

Key capabilities:

* Agent memory and workspace context.
* Tool execution and workflow automation.
* Communication channels including email, WhatsApp, Slack, Telegram, Teams, Discord, SMS, and web.
* Model routing across multiple AI providers, with cost routing and fallback.
* Skill packs and playbooks for vertical use cases.
* Self-hosted deployment path.
* MIT-licensed core available through the public Carina Mutant project.

The strategic role of Mutant is distribution. Builders can start with the open-source core. As they move toward production, they need hosted management, billing, governance, keys, compliance, and support. That is where the commercial platform earns revenue.

## **2. Carina Aiva - The Managed AI Employee**

Carina Aiva is the commercial managed product built on the Carina platform. It is for businesses that do not want to configure infrastructure. They want to hire an AI employee, give it a role, connect it to business channels, and let it handle work under supervision.

Aiva can support roles such as:

* Customer support assistant.
* Property management assistant.
* Admin and scheduling assistant.
* Sales outreach coordinator.
* Financial admin assistant.
* Content and operations assistant.

The business owner can name the AI employee, describe the role, connect channels, and start delegating work. Aiva handles email, WhatsApp, bookings, customer queries, follow-ups, admin tasks, and routine operations.

The important differentiator is the human safety net. When Aiva cannot confidently complete a task, a trained human VA can step in behind the scenes in the same channel. The customer does not experience a visible AI failure. The work continues. This creates a practical moat because most AI employee products are pure AI. When they fail, the customer sees the failure. Aiva combines AI speed with human reliability.

Every paid Aiva plan includes Scout Govern at no extra cost. That means approval workflows, kill switch, audit trail, injection protection, and compliance export are included from day one.

## **3. Petraclus - AI-Native Cybersecurity**

Petraclus is the cybersecurity product in the Carina family. It is built on the same agent core but focused on security operations.

It is designed for:

* Security consultancies.
* Red teams.
* Internal security teams.
* Managed service providers.
* Organisations that need governed AI assistance for cyber workflows.

Petraclus extends the Carina agent platform with cybersecurity capabilities such as:

* OSINT and reconnaissance.
* Vulnerability assessment.
* Web application testing workflows.
* Digital forensics and incident response support.
* Security reporting.
* Local SIEM-style summaries.
* Human approval before active or risky actions.

Petraclus is positioned as early access. The aim is not to sell it as an uncontrolled hacking tool. The aim is to sell a governed AI security analyst that helps security teams work faster while keeping approval, audit, and policy controls in place.

As part of the commercial model, Petraclus Pro and Team subscribers receive 50% off Scout for their first year. This encourages serious security users to adopt the governance layer while keeping Scout as its own paid product.

## **4. Labyrinth Scout - AI Governance and Trust**

Scout is the governance and trust layer for AI agents. It answers the question that companies, auditors, CISOs, and regulators will increasingly ask:

What did the AI do, why did it do it, who approved it, what data did it touch, and can you prove it?

Scout provides:

* Kill switch: halt AI agents across connected systems.
* Audit trail: record tool calls, model requests, decisions, approvals, and policy events.
* Prompt injection shield: detect and block adversarial instructions.
* Egress filtering: reduce the risk of sensitive information leaving the system.
* Human approval workflows: require sign-off before sensitive actions.
* Compliance exports: prepare evidence for governance reviews, audits, and regulated customers.

Scout is bundled into paid Aiva plans because Aiva must be safe enough for business use. Scout is sold separately for Carina Mutant users and for companies running other AI systems. It can govern LangChain, CrewAI, custom agent stacks, and internal AI deployments, not only Carina products.

Enterprise trust features, including deeper attestation and on-chain trust plumbing, remain gated for paid enterprise deployments. The open platform can prepare the integration points, but the full enterprise trust package is a commercial upgrade.

# **What Is Already Built**

The codebase is broad and production-oriented. It includes front-end products, back-end services, mobile application work, deployment scripts, billing infrastructure, security tooling, and documentation.

| Area | Status and Scale |
| :---- | :---- |
| Carina Mutant core | 2,050+ source files, 984 automated tests, live codebase |
| Agent tooling | 300+ tools and 23 skill packs across multiple domains |
| Communication channels | WhatsApp, email, Slack, Teams, Telegram, Discord, SMS, and web |
| AI model providers | 30+ supported providers with routing and fallback |
| Aiva managed product | Web and mobile product surfaces, role-based AI employee workflow |
| Aiva mobile application | React Native mobile application with hundreds of screens |
| Scout governance platform | Dedicated governance console, APIs, audit, policy, and monitoring modules |
| Petraclus security product | Early access product direction with security tooling and governed workflows |
| Billing infrastructure | Stripe checkout, subscription logic, pricing API, metered usage direction |
| Partner and platform architecture | API keys, marketplace direction, product packaging, and multi-product positioning |

There are still launch and hardening tasks to complete, but the foundation is not theoretical. The main need now is commercial focus, mentoring, access to the right networks, and disciplined execution.

# **Market Timing**

The market is moving quickly from AI experimentation to AI deployment. The more AI agents are allowed to act inside businesses, the more companies will need governance, evidence, and operational controls.

Several forces support the timing:

* Businesses are already adopting AI assistants for admin, customer support, sales, and operations.
* AI agents are becoming capable of taking actions across real business systems.
* The EU AI Act entered into force in August 2024, with high-risk system obligations applying from August 2026.
* GDPR and sector-specific compliance expectations are increasing around AI use.
* Companies deploying AI in customer-facing or decision-making roles will need audit trails, approval controls, and evidence packs.
* Cybersecurity teams need AI assistance, but they cannot use uncontrolled autonomous tooling in serious environments.

This creates an opening for a platform that combines AI productivity with governance from the start. Carina is not just trying to be another AI assistant. The position is broader: the workspace and trust layer for businesses building and using AI agents.

# **Commercial Model**

The commercial model has multiple revenue streams from the same infrastructure.

## **Aiva Subscriptions**

Aiva is the most direct route to revenue because it solves an immediate business problem: admin, customer communication, bookings, follow-up, and operations.

Current pricing direction:

* Starter: from £149 per month.
* Growth or Team: from £349 per month.
* Additional AI employee seats: from £49 per month.
* Scout Govern included on every paid Aiva plan.

This is priced against labour, not ordinary software. A part-time VA can cost hundreds of pounds per month. Aiva offers a lower-cost AI employee with governance and human backup.

## **Scout Subscriptions**

Scout can be sold to any company deploying AI agents, whether or not they use Carina.

Current pricing direction:

* Scout Monitor: £49 per month.
* Scout Govern: £79 per month.
* Enterprise trust and attestation features: paid enterprise package.

This is the tollbooth opportunity. As more businesses deploy agents, they need governance across every agent action. Scout can become the layer that records, controls, and proves what happened.

## **Petraclus Subscriptions**

Petraclus targets cybersecurity teams and consultancies. Pricing is still best held for early access and general availability, but the structure is clear:

* Free or limited access tier for evaluation.
* Pro tier for individual security operators or small consultancies.
* Team tier for security teams.
* Scout discount for Pro and Team subscribers in the first year.

## **Platform Usage and Marketplace Revenue**

As Mutant adoption grows, the platform can earn from:

* Usage-based billing for hosted events, actions, memory operations, and tool calls.
* Paid skill packs and playbooks.
* Revenue share on third-party marketplace submissions.
* Partner API usage when other companies embed Carina, Aiva, or Mutant in their own products.
* Managed hosting, support, and enterprise packages.

The long-term goal is that builders use Carina as the workspace, customers use products built on Carina, and the platform earns from governance, usage, billing, and distribution.

# **Why This Can Become Defensible**

The opportunity is not only the individual apps. The defensibility comes from combining five layers:

* Agent core: the open-source Mutant engine that brings builders in.
* Managed product: Aiva, which proves the AI employee use case with real businesses.
* Vertical product: Petraclus, which proves Carina can produce specialist AI products for regulated or high-value domains.
* Governance layer: Scout, which becomes necessary as agents move from chat to action.
* Commercial rails: billing, keys, usage tracking, marketplace, partner API, and deployment workflows.

This gives Carina a platform shape rather than a single-product shape. A competitor can copy a chatbot interface. It is harder to copy an open-source core, managed AI employee, security vertical, governance console, billing system, and developer ecosystem all working together.

# **Six-Month Focus**

The next six months should be focused, not scattered.

Priority 1: launch Aiva commercially.

* Finalise onboarding and checkout.
* Package the first 3 to 5 AI employee roles.
* Recruit the first small VA backup team.
* Target businesses where admin cost and response time are obvious pain points.

Priority 2: make Scout commercially credible.

* Package Monitor and Govern clearly.
* Produce short compliance and security materials.
* Run demos for technical buyers.
* Use Aiva as the proof that Scout is already governing live AI employees.

Priority 3: open Mutant as the builder channel.

* Make installation simple.
* Publish a clean developer story.
* Encourage developers and agencies to build on it.
* Use keys, hosting, governance, and support as commercial upgrade paths.

Priority 4: keep Petraclus in controlled early access.

* Focus on security teams and consultancies.
* Keep risky workflows approval-led.
* Use Scout as the trust layer for every serious deployment.

# **What I Need Help With**

The technology foundation is in place. The next requirement is not only more code. It is access, credibility, and commercial guidance.

## **Incubation**

An incubation programme would help with:

* Go-to-market strategy.
* Product packaging and positioning.
* Introductions to early customers.
* Investor readiness.
* Operational discipline.
* Credibility when speaking to enterprise buyers.

The best introductions would be to:

* Businesses that spend heavily on admin, customer support, operations, or virtual assistants.
* Security consultancies and managed service providers.
* Companies beginning to deploy AI agents internally.
* Compliance, governance, and risk leaders.
* Investors interested in AI infrastructure, applied AI, cybersecurity, or developer platforms.

## **Investment**

I am not seeking a large round at this stage. The right early support should cover at least six months of focused execution.

Use of funds:

* Infrastructure and hosting.
* Final launch engineering and DevOps.
* Product polish across Aiva, Scout, Mutant, and Petraclus.
* Human VA backup capacity for Aiva.
* Marketing, content, and community.
* Legal, privacy, and compliance setup.
* Early sales and customer acquisition.

The goal is to reach the point where Aiva and Scout begin funding the business while Mutant and Petraclus expand the platform opportunity.

# **The Ask**

I would value your help in three areas:

1. Advice on how to sharpen this into an incubation and investor-ready story.
2. Introductions to an incubation programme that fits AI infrastructure, AI governance, or cybersecurity.
3. Introductions to potential early customers, mentors, or investors who would understand the platform opportunity.

The platform is ready enough to begin serious conversations. It is the foundation for AI products that can be built, governed, monetised, and trusted. The market is moving quickly. I want to move with the right people around the table.

**Laud Paul-Gablah**

Product Architect

carinaai.uk - hireaiva.co.uk - labyrinthscout.com
