# Carina Identity and Purpose

## What Carina Is

Carina is an autonomous AI agent platform built by VERLOX Ltd. It is not a single chatbot or a
single-purpose tool. It is an operating system for AI agents: the infrastructure on which AI
workers, automations, and domain-specific applications are built and run.

The analogy is accurate, not marketing. A conventional OS (Linux, Windows) provides process
scheduling, memory management, a filesystem, security, and networking. Applications run on top
without needing to re-implement those primitives. Carina provides the AI equivalent: agent
orchestration, persistent memory, tool execution, channel routing, security governance, and
multi-tenant isolation. Products (Aiva, partner deployments, custom installations) run on top.

## The Three Products Built on Carina

**Carina (the platform):** The open-source core is MIT-licensed and distributed as `carina-agent`
on npm. The hosted and white-label versions are commercial. The platform handles all AI
orchestration, memory, tools, channels, and billing. Operators self-host via Docker Compose or use
the VERLOX-managed cloud.

**Aiva (the AI employee):** A commercial product built entirely on Carina. Businesses hire a named
AI worker who operates 24/7 across email, WhatsApp, Slack, Telegram, and web. When the AI reaches
its confidence threshold, a real human VA from VERLOX's operating VA business steps in invisibly.
This human backup is trained on real client workflows and cannot be replicated by competitors who
only have software.

**Scout (the governance layer):** Labyrinth Scout monitors every action every AI agent takes. It
provides a kill switch, immutable audit trail, compliance exports (SOC 2, ISO 27001, GDPR, EU AI
Act), prompt injection shielding, egress filtering, and honeypot-based leak detection. Scout runs
embedded in every Carina and Aiva deployment and is also sold standalone to companies using any
other AI platform.

## Core Principles

Carina is built around five commitments:

1. **Security first.** Scout is not optional for production. Every tool call is logged. Every
   session is auditable. The kill switch can halt all agents instantly.

2. **Multi-model, not locked in.** Carina supports 30+ AI providers including Anthropic, Google
   Gemini, OpenAI, DeepSeek, Groq, Mistral, Ollama (local), and more. It routes between them
   based on capability, cost, and availability.

3. **Channel-agnostic.** The same agent logic runs across Discord, Email, Slack, SMS, Microsoft
   Teams, Telegram, web chat, and WhatsApp. Adding a new channel does not require changing agent
   code.

4. **Open source at the core.** The Carina agent is MIT-licensed. This drives developer adoption,
   feeds the Scout upsell funnel, and provides credibility for enterprise conversations.

5. **Tollbooth infrastructure model.** VERLOX earns a metered toll on every AI action flowing
   through Carina infrastructure. Partners build products on top. As partner volume grows, VERLOX
   revenue grows without proportional headcount increases.

## Who Carina Is For

- **Businesses** that want to deploy AI workers without managing AI infrastructure
- **Technology partners** who want to embed AI capabilities in their own products via the partner API
- **Developers** who want a self-hosted, extensible AI agent with a full tool set
- **Enterprises** that need AI governance, compliance evidence, and audit trails

## What Carina Is Not

Carina is not a competitor to Anthropic Claude or OpenAI ChatGPT at the model level. It uses those
models as providers. Carina competes at the infrastructure and governance layer: orchestration,
memory, tool execution, channel delivery, and compliance. No other platform combines all of these
with an open-source core and production-grade security.

## Repository and Deployment

- GitHub: `malike2356/carina-ai`
- npm package: `carina-agent`
- Docker image: `verlox/carina`
- Scout Docker: `verlox/scout`
- Dev workspace: `/opt/lampp/htdocs/verlox/carina`
- Production: Contabo VPS (`aman`), Ubuntu 24.04, Docker Compose
- Core backend: `core.carinaai.uk` (Express/Node.js, PostgreSQL, Redis)
- Scout console: `console.labyrinthscout.com` (port 4444)
- Workspace app: `app.carinaai.uk` (Next.js)
- Admin panel: `admin.carinaai.uk` (Next.js)
- Mobile app: React Native / Expo (`carinaMobile/`)
- Desktop app: Tauri + TypeScript (`carina-desktop/`)
