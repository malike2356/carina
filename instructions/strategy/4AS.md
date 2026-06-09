AUTONOMOUS AGENT AS A SERVICE (AAAAS OR 4AS)

Moving Carina from "one branded persona running per-install" to genuine multi-tenant SaaS is mostly an identity, isolation, and billing problem layered on
  top of infrastructure you already have; not a rewrite of the agent itself. The core shift: every row in Postgres needs a tenant_id, every session needs to
  resolve to an account+plan (not just a chat ID), and the in-process Map<sessionId, CarinaOrchestrator> in GatewayRouter needs to become externally-resumable
  so you can run multiple stateless instances behind a load balancer.

  Main tradeoff to decide first: build tenancy/auth/billing yourself on the current Node/Postgres/Redis stack (more control, slower, but you avoid vendor
  lock-in and keep the self-hosted CLI story intact), versus bolting on an identity-and-billing platform (Clerk/WorkOS for auth, Stripe Billing for metering;
  Stripe is already a dependency) and focusing your engineering on the agent/skill layer that's actually your differentiator. Given Carina ships both as a
  self-hosted package and (per this direction) a hosted SaaS, I'd lean toward build the tenancy model yourself (it's not that hard with Postgres row-level
  security) but buy billing/metering (Stripe usage-based billing is mature and you're already integrated).

  Stack, mapped onto what you have:

  ┌───────────────────┬────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────┐
  │       Layer       │                   Keep / extend                    │                                     Add                                      │
  ├───────────────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
  │ Data isolation    │ Postgres 16 + pgvector; add tenant_id to every    │; │
  │                   │ table, enable row-level security policies          │                                                                              │
  ├───────────────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
  │ Auth/accounts     │ bcryptjs already present                           │ A real session/JWT layer (Lucia or a thin custom one; you don't need        │
  │                   │                                                    │ Clerk's weight unless you want SSO fast)                                     │
  ├───────────────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
  │                   │ Stripe (already a dependency) + the model_usage    │                                                                              │
  │ Billing/metering  │ cost-tracking table from the phase-5 model-routing │ Stripe Billing usage records wired to per-tenant token spend                 │
  │                   │  prompt                                            │                                                                              │
  ├───────────────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
  │ Session/agent     │ Redis (already used for session mapping)           │ Externalize CarinaOrchestrator state so any instance can pick up any session │
  │ state             │                                                    │; this is the part that currently won't horizontally scale                  │
  ├───────────────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
  │ Async work        │; │ BullMQ on the existing Redis instance, for scheduled                         │
  │                   │                                                    │ tasks/check-ins/briefings per tenant                                         │
  ├───────────────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
  │ LLM routing       │ Existing DeepSeek→Claude→OpenAI router             │ Per-tenant provider/model preferences and budget caps (same cost-tracker)    │
  ├───────────────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
  │                   │                                                    │ Per-tenant system-prompt overlay (NOT a full persona swap; keep "Carina" as │
  │ Branding/persona  │ Carina's system-prompt persona                     │  the product identity, let tenants customize tone/rules the way AGENTS.md    │
  │                   │                                                    │ does in self-hosted mode)                                                    │
  ├───────────────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
  │                   │                                                    │ A proper account/billing/usage dashboard (this is genuinely new surface area │
  │ Frontend          │ gateway/web                                        │; possibly worth a dedicated Next.js/SvelteKit app rather than extending    │
  │                   │                                                    │ the gateway's minimal web UI)                                                │
  ├───────────────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
  │                   │                                                    │ Per-tenant threat isolation in Scout's existing instance model; it's        │
  │ Security          │ Labyrinth Scout (separate product)                 │ already built for "many agent instances," which maps cleanly onto "many      │
  │                   │                                                    │ tenants"                                                                     │
  └───────────────────┴────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────┘

  The riskiest single piece is the session/agent externalization; that's the one that determines whether you can actually scale horizontally. Want me to go
  deeper on that, or sketch the tenant_id/RLS data-model migration as a concrete first step?

