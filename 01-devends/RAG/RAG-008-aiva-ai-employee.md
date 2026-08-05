# Aiva: The AI Employee

## What Aiva Is

Aiva is VERLOX's commercial AI employee product. It is built entirely on the Carina platform.
Businesses hire a named AI worker who operates 24/7 across email, WhatsApp, Slack, Telegram,
and web. The AI worker handles the assigned tasks autonomously and escalates to a human VA from
VERLOX's operating VA business when it reaches its confidence threshold.

Aiva is the commercial proof of the Carina platform. Every feature Aiva uses is built on
Carina infrastructure: the channel adapters, the tool runtime, the memory system, Scout
governance, and the billing layer.

Boundary rule: Carina is the shared platform runtime. Aiva is the product surface on top of it.
Keep Aiva-specific branding, routes, entitlements, pricing, onboarding, and persona packs thin.
Do not fork the platform into a second runtime just to separate the product name.

## Key Source Files

```
core.carinaai.uk/src/
  api/aiva-api.ts                  Core Aiva REST API (worker management)
  api/aiva-email-api.ts            Email-specific Aiva routes
  api/aiva-propreneur-webhook-api.ts  Propreneur integration webhook
  workers/knowledge-base.ts        Per-worker knowledge base management
  ingestion/email/                 Email ingestion pipeline
    email-connection-store.ts
    email-parser.ts
    email-poller.ts
    imap-connector.ts
```

## Aiva Worker Concept

Each Aiva client gets one or more "workers." A worker is:
- A named AI persona (e.g., "Sarah, your Property Manager")
- A role configuration (pre-built role or custom)
- A knowledge base (documents and FAQ pairs specific to that business)
- Channel bindings (which WhatsApp number, which email inbox, which Slack workspace)
- Scout governance (audit trail, kill switch scope, egress rules)
- A billing record in the Aiva subscription system

Workers are stored in the PostgreSQL `aiva_workers` table. Knowledge base entries are in
`aiva_knowledge_base`. Email connections are in the email connection store.

## Pre-Built Roles

Aiva ships with six pre-built role templates that define the worker's system prompt, tool access,
and behavioural guidelines:

| Role | Primary Tasks |
|---|---|
| Property Manager | Tenancy queries, maintenance coordination, compliance alerts, rent reminders |
| Outreach Coordinator | Lead emails, follow-up sequences, CRM updates, appointment booking |
| Financial Analyst | Invoice processing, expense categorization, cashflow summaries, budget review |
| Content Assistant | Draft writing, editing, social media scheduling, content calendar management |
| Calendar Manager | Meeting booking, availability management, reminders, rescheduling |
| Customer Support | FAQ answering, issue logging, escalation routing, satisfaction follow-up |

Custom roles can be configured by describing the role in the Aiva onboarding portal.

## The Human VA Fallback (The Key Differentiator)

When Aiva's AI reaches a confidence threshold below the configured minimum for a task, it
escalates to a human VA from VERLOX's operating VA business. The escalation:

1. Is invisible to the client (the client sees continuous responses from "Sarah")
2. Happens in the same channel (no switching to a different interface)
3. Is logged in Scout (who handled which message: AI or human)
4. Has a defined SLA (the VA responds within the agreed time window)

This human backup is what separates Aiva from pure AI employee competitors. It is backed by
a running business with trained staff, not a promise. Competitors cannot replicate this by
forking the Carina codebase because the staff cannot be forked.

## Email Ingestion Pipeline

The most distinctive technical capability for Aiva: automated email reading, classification, and
data extraction. The pipeline runs in `src/ingestion/email/`:

**IMAP Connector (`imap-connector.ts`):** Establishes and maintains a persistent IMAP connection
to the client's email account. Handles reconnection on drop. Monitors the inbox for new messages.

**Email Poller (`email-poller.ts`):** Polls for new messages at a configurable interval. Uses the
connection store to manage credentials per worker. Triggers the parser on each new message.

**Email Parser (`email-parser.ts`):** Classifies incoming emails by type (query, complaint, data,
action required, informational) and extracts structured data (dates, addresses, names, amounts,
reference numbers) using a combination of regex and LLM extraction.

**Email Connection Store (`email-connection-store.ts`):** Manages IMAP credentials per Aiva
worker. Stored encrypted in PostgreSQL.

When a new email arrives in the monitored inbox, the pipeline: reads it, classifies it, extracts
structured data, routes it to the assigned Aiva worker's session, and the worker composes a
response that is sent back via the same email thread.

## Aiva Knowledge Base

Each worker has its own knowledge base separate from the global RAG system (`src/workers/
knowledge-base.ts`). Limits:

| Metric | Limit |
|---|---|
| Total characters per worker | 50,000 (Business plan) |
| Per document | 20,000 characters |
| Per FAQ pair | 500 characters |

The knowledge base is injected into the worker's persona prompt at session start. This is how
the worker knows about the specific business: "Our company was founded in 2019. Our main product
is X. Common questions include..."

## Aiva Billing and Subscriptions

Aiva subscriptions are managed through the core backend's billing layer:

- `src/api/billing-routes.ts`: Stripe webhook handling
- `src/workers/aiva-subscription-store.ts`: Subscription state queries (what plan a worker is on)
- `KNOWLEDGE_CHAR_LIMIT`, `DOC_CHAR_LIMIT`, `FAQ_PAIR_CHAR_LIMIT`: Plan-gated limits in
  `knowledge-base.ts`

The `isBusinessPlan()` check in `knowledge-base.ts` gates the higher character limits to Business
and above tier subscribers.

## Aiva and Propreneur Integration

`src/api/aiva-propreneur-webhook-api.ts` is a dedicated webhook handler for the Propreneur
property management platform. When Propreneur generates an event (new tenancy, maintenance
request, rent arrear), it posts to this webhook, which routes it to the relevant Aiva worker
as a context injection, so the worker is always aware of live property portfolio state.

## Pricing

Current commercial plan labels in the Aiva billing UI:

| Tier | Positioning | Includes (high level) |
|---|---|---|
| Starter | One AI Employee, always on | 1 worker, limited channels/tasks, Scout Govern, basic approvals, email support |
| Growth | Scale your AI team | More workers and channels, higher task allowance, advanced approvals, priority support |
| Business | Unlimited workforce for agencies | Unlimited workers/channels (plan gates), higher allowance, white-label options, priority support |

Exact Stripe prices and entitlements live in billing config and the Stripe source-of-truth file for VERLOX; do not invent pound amounts from older docs. Human VA oversight remains part of the Aiva offer where the plan includes it.

## Aiva Onboarding Flow (Current State)

As of July 2026, Aiva is live for workspace users: hire workers, connect channels (including Telegram), Approvals, Calendar, Documents, Tools, Training, Automations, Schedules, Knowledge, and Ask Carina help. Stripe billing for Aiva is wired. Prefer live UI paths over older "onboarding in progress" notes.
