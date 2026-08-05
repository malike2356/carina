# Sprint 4 - Prompt 03: Aiva Brain (core.carinaai.uk backend)

**Status: COMPLETED 2026-06-25**

**What was built:**
- `src/infrastructure/migrations/006-ai-workers.sql` (workers, channels, activity, escalations, automations)
- `src/workers/` (role-templates, persona-builder, worker-store, scout-fleet, message handler, automations, knowledge-base)
- `src/api/aiva-api.ts` at `/api/aiva` (hire, CRUD, analytics, automations, channels, knowledge, billing hooks)
- `src/workers/provision-worker-channels.ts`: hire-time channel rows, binding-aware routing identifiers, Telegram webhook on bot token
- `src/workers/aiva-onboarding.ts`: LLM role summary + first-message send via channel adapters
- `POST /api/aiva/workers` calls `provisionWorkerChannels` + `sendHireOnboardingMessages` (first bound channel)
- Gateway persona injection, escalation interceptor, tool guard, Scout fleet + attestation
- Tests: `persona-builder.test.ts`, `provision-worker-channels.test.ts`, `aiva-onboarding.test.ts`

**Sprint:** 4 - AI Employee
**Prompt number:** 03 of 03
**Name:** Aiva brain - config system, onboarding API, escalation routing
**Primary agent:** Claude Code
**Estimated hours:** 10-14 h
**Depends on:** Nothing (build in parallel with 01)

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `01-devends/prompts/02-archived_prompts/archives_from_pending_prompts/sprint-4/ai-employee/`.

Full checklist: `01-devends/prompts/01-pending_prompts/POST-BUILD-CHECKLIST.md`

---

## Read First

Before writing any code, read these files in full:

1. `02-backends/core.carinaai.uk/src/server.ts` - where new route modules are mounted
2. `02-backends/core.carinaai.uk/packages/web/src/web-server.ts` - how the web Express server registers API routes (lines 340-450 especially)
3. `02-backends/core.carinaai.uk/src/agents/conversation-discipline.ts` - how system prompt blocks are assembled; this is the model for worker persona injection
4. `02-backends/core.carinaai.uk/src/skills/pack-manifests.ts` - skill pack registration; workers load packs from here
5. `02-backends/core.carinaai.uk/src/memory/db.ts` - how DB queries are done (pool.query pattern)
6. `02-backends/core.carinaai.uk/src/api/packs-api.ts` - an example of a clean CRUD API module
7. `02-backends/core.carinaai.uk/src/config/index.ts` - understand config shape before adding new env vars
8. `02-backends/core.carinaai.uk/src/types/index.ts` - shared types; add new types here
9. `03-frontends/marketing/employ.carinaai.uk/CARINA_AI_EMPLOYEE_PLAN.md` - the full product spec
10. `02-backends/core.carinaai.uk/src/scout/scout-client.ts` - Scout integration client; all Scout calls go through this; understand the `registerAgent`, `updateAgentStatus`, `reportEvent`, and `attest` signatures before implementing Step 6b

---

## Context

An "Aiva" is a named, configured instance of Carina with a fixed persona, a set of skill packs,
a designated channel scope, and an escalation threshold. Aivas are scoped to a workspace.

When a client sends the Aiva a message (via WhatsApp, email, Slack, or Telegram), the message
routes through the existing channel adapters and arrives at the router. The router checks whether
the inbound channel session belongs to an Aiva. If it does, the Aiva's persona and skills are
injected into the system prompt before the agent runs. From the agent's perspective, nothing
changes - it is still CarinaAgent processing a message. The persona is just a system prompt block.

Escalation is a new concept. When the agent's response contains an escalation signal (produced by
the agent itself based on its system prompt instructions), the Aiva system intercepts the outbound
reply, queues it for human review, and sends the client a holding message: "I am checking on this
and will get back to you shortly." A human VA then resolves the task and the resolution is logged.

This prompt builds:
1. The database schema for Aivas, activity, escalation queue, and automations
2. The HTTP API used by the `app.carinaai.uk` portal (prompt 02)
3. The Aiva persona injection layer in the message routing path
4. The escalation interceptor
5. The six pre-built Aiva role template definitions
6. Scout fleet registration so each Aiva appears in the Scout fleet manager
7. Real-time Scout event emission for every Aiva action (rogue detection signals included)
8. Blockchain attestation of every activity record via Scout's chain API
9. An analytics endpoint that Scout fleet manager calls when you click on an Aiva

It does NOT build:
- The human VA facing queue management UI (sprint 5)
- Stripe billing integration (sprint 5)
- Mobile push notifications for VA escalation alerts (sprint 5)

---

## Step 1: Database schema

Create migration file: `02-backends/core.carinaai.uk/src/infrastructure/migrations/006-ai-workers.sql`

```sql
-- Aiva definitions
CREATE TABLE IF NOT EXISTS ai_workers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    TEXT NOT NULL,
  name            TEXT NOT NULL,
  role_description TEXT NOT NULL,
  template_id     TEXT,                      -- null if fully custom
  persona_prompt  TEXT NOT NULL,             -- assembled at hire time, stored for replay
  skill_packs     TEXT[] NOT NULL DEFAULT '{}',
  channels        TEXT[] NOT NULL DEFAULT '{}',
  language        TEXT NOT NULL DEFAULT 'en-GB',
  status          TEXT NOT NULL DEFAULT 'active',  -- active | paused | dismissed
  escalation_threshold INTEGER NOT NULL DEFAULT 60, -- 0-100; below this, escalate
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-worker channel bindings (which channel session id belongs to this worker)
CREATE TABLE IF NOT EXISTS ai_worker_channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id   UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,    -- telegram | whatsapp | email | slack | web
  identifier  TEXT NOT NULL,    -- the chat_id, email address, or Slack channel id
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_worker_channels_lookup
  ON ai_worker_channels(channel, identifier);

-- Worker activity feed
CREATE TABLE IF NOT EXISTS ai_worker_activity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  action_type     TEXT NOT NULL,   -- message_received | message_sent | task_completed | escalated | skill_used | automation_run
  summary         TEXT NOT NULL,
  input_text      TEXT,
  output_text     TEXT,
  escalated       BOOLEAN NOT NULL DEFAULT FALSE,
  attestation_tx  TEXT,            -- blockchain tx hash from Scout attestation; null until attested
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_worker_activity_worker
  ON ai_worker_activity(worker_id, created_at DESC);

-- Escalation queue
CREATE TABLE IF NOT EXISTS ai_worker_escalations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id    TEXT NOT NULL,
  channel         TEXT NOT NULL,
  channel_id      TEXT NOT NULL,   -- the chat id or email address to reply to
  original_input  TEXT NOT NULL,
  worker_draft    TEXT,            -- what the worker tried to say before escalating
  holding_message TEXT NOT NULL,   -- what the client was told
  status          TEXT NOT NULL DEFAULT 'open',  -- open | assigned | resolved
  assigned_to     TEXT,            -- VA identifier
  resolved_at     TIMESTAMPTZ,
  resolution_text TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_escalations_open
  ON ai_worker_escalations(workspace_id, status, created_at DESC);

-- Per-worker scheduled automations
CREATE TABLE IF NOT EXISTS ai_worker_automations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id    TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,   -- plain-English description of the recurring process
  cron_expression TEXT NOT NULL,   -- standard 5-field cron; e.g. "0 8 * * *"
  schedule_label  TEXT NOT NULL,   -- human-readable; e.g. "Every day at 8 am"
  trigger_type    TEXT NOT NULL DEFAULT 'cron',  -- cron | event
  trigger_event   TEXT,            -- event name when trigger_type = event
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_worker_automations_worker
  ON ai_worker_automations(worker_id, enabled);
```

Run this migration by adding it to the existing migration runner. Follow the pattern of the most
recently added migration in `src/infrastructure/migrations/`.

---

## Step 2: Worker role templates

Create: `02-backends/core.carinaai.uk/src/workers/role-templates.ts`

This file exports a static array of `WorkerRoleTemplate` objects. These are the pre-built roles.
The onboarding flow uses these to construct the `persona_prompt` when the user selects a template.
Custom roles derive their persona from the raw `roleDescription` directly.

```typescript
export interface WorkerRoleTemplate {
  id: string;
  name: string;
  description: string;
  skillPacks: string[];
  defaultChannels: string[];
  escalationTriggers: string[]; // phrases in output that signal escalation needed
  personaBlocks: {
    role: string;
    capabilities: string[];
    boundaries: string[]; // hard limits - things the worker must never do
    tone: string;
    escalationGuidance: string;
  };
}

export const ROLE_TEMPLATES: WorkerRoleTemplate[] = [
  {
    id: 'property-manager',
    name: 'Property Manager',
    description: 'Tenant comms, maintenance scheduling, renewal tracking.',
    skillPacks: ['property-uk', 'calendar'],
    defaultChannels: ['whatsapp', 'email'],
    escalationTriggers: ['legal notice', 'complaint', 'court', 'deposit dispute', 'emergency'],
    personaBlocks: {
      role: 'You are a property manager acting on behalf of a UK landlord or property company.',
      capabilities: [
        'Respond to tenant queries about maintenance, repairs, and lease renewals.',
        'Log maintenance requests and track their status.',
        'Send renewal reminders and process renewal confirmations.',
        'Answer questions about the tenancy agreement based on documents provided.',
      ],
      boundaries: [
        'Never make legal interpretations or advise on legal rights.',
        'Never agree to rent reductions without explicit landlord approval.',
        'Never share a landlord\'s personal contact details.',
        'Never accept or deny a deposit deduction claim directly.',
      ],
      tone: 'Professional, clear, and reassuring. Respond promptly. Keep messages concise.',
      escalationGuidance: 'If a tenant mentions legal action, formal complaints, deposit disputes, or anything you are uncertain about, escalate to a human. Say: "I am checking on this and will get back to you shortly."',
    },
  },
  {
    id: 'outreach-coordinator',
    name: 'Outreach Coordinator',
    description: 'Email campaigns, follow-up sequences, lead tracking.',
    skillPacks: ['communication', 'calendar'],
    defaultChannels: ['email'],
    escalationTriggers: ['pricing', 'contract', 'legal', 'cancel', 'refund', 'speak to a human'],
    personaBlocks: {
      role: 'You are an outreach coordinator managing email sequences and lead follow-ups.',
      capabilities: [
        'Send and follow up on outreach email sequences.',
        'Track lead responses and update status notes.',
        'Schedule calls and demos based on availability.',
        'Qualify leads based on criteria provided.',
      ],
      boundaries: [
        'Never quote prices, discounts, or contract terms without approval.',
        'Never represent yourself as a human if directly asked.',
        'Never send more than two follow-up messages without a response before escalating.',
      ],
      tone: 'Warm, professional, and purposeful. No generic filler phrases. Get to the point.',
      escalationGuidance: 'If a prospect asks to speak to a person, asks about pricing details, or requests a contract, escalate immediately. Say: "Let me connect you with the right person. You will hear from us shortly."',
    },
  },
  {
    id: 'financial-analyst',
    name: 'Financial Analyst',
    description: 'Invoice reading, expense categorisation, report generation.',
    skillPacks: ['finance', 'documents'],
    defaultChannels: ['email', 'slack'],
    escalationTriggers: ['payment', 'bank', 'transfer', 'fraud', 'audit', 'discrepancy'],
    personaBlocks: {
      role: 'You are a financial analyst processing documents and generating reports.',
      capabilities: [
        'Read and extract data from uploaded invoices and spreadsheets.',
        'Categorise expenses against a provided chart of accounts.',
        'Generate monthly and quarterly expense summaries.',
        'Flag anomalies, duplicate entries, or missing information.',
      ],
      boundaries: [
        'Never initiate payments or access banking systems.',
        'Never approve expenses; only categorise and flag.',
        'Never share financial data externally without explicit instruction.',
      ],
      tone: 'Precise and factual. Flag uncertainty explicitly rather than guessing.',
      escalationGuidance: 'If you find a discrepancy, a potential fraud indicator, or anything requiring human judgement on a financial decision, escalate. Say: "I have flagged something that needs your review. A member of the team will follow up."',
    },
  },
  {
    id: 'content-assistant',
    name: 'Content Assistant',
    description: 'Drafting, formatting, social scheduling, research.',
    skillPacks: ['cms-ops', 'research-basics'],
    defaultChannels: ['email', 'slack'],
    escalationTriggers: ['legal', 'sensitive', 'controversial', 'post without approval'],
    personaBlocks: {
      role: 'You are a content assistant drafting and formatting content on behalf of a brand.',
      capabilities: [
        'Draft blog posts, social media captions, and email newsletters from briefs.',
        'Research topics and summarise findings for use in content.',
        'Format and structure drafts per brand guidelines.',
        'Suggest scheduling slots but not publish without approval.',
      ],
      boundaries: [
        'Never publish content directly to any platform without confirmation.',
        'Never write content that makes factual claims without a verifiable source.',
        'Never use competitor names disparagingly.',
      ],
      tone: 'Adaptable to the brand voice provided. Default to clear, confident, human writing.',
      escalationGuidance: 'If a brief is ambiguous, sensitive, or asks for content outside normal brand scope, escalate for clarification. Say: "I want to make sure I get this right. Can someone review the brief with me?"',
    },
  },
  {
    id: 'calendar-manager',
    name: 'Calendar Manager',
    description: 'Scheduling, reminders, meeting prep, travel coordination.',
    skillPacks: ['calendar'],
    defaultChannels: ['email', 'slack'],
    escalationTriggers: ['cancel', 'emergency', 'urgent', 'board', 'investor'],
    personaBlocks: {
      role: 'You are a calendar manager handling scheduling and meeting coordination.',
      capabilities: [
        'Respond to scheduling requests and propose available slots.',
        'Send meeting confirmations and reminders.',
        'Prepare agenda briefs from context provided.',
        'Coordinate across time zones.',
      ],
      boundaries: [
        'Never accept or decline invitations without confirmation from the calendar owner.',
        'Never book paid venues or travel without approval.',
        'Never share calendar details with external parties not already invited.',
      ],
      tone: 'Efficient and courteous. Confirm all actions before executing.',
      escalationGuidance: 'If a scheduling conflict involves a high-priority meeting, a board or investor call, or requires judgement on priority, escalate. Say: "I need to check availability before confirming. You will hear back shortly."',
    },
  },
  {
    id: 'customer-support',
    name: 'Customer Support',
    description: 'Ticket triage, FAQ responses, escalation routing.',
    skillPacks: ['communication'],
    defaultChannels: ['email', 'web', 'whatsapp'],
    escalationTriggers: ['refund', 'billing dispute', 'legal', 'angry', 'escalate', 'manager', 'complaint'],
    personaBlocks: {
      role: 'You are a customer support agent handling inbound queries on behalf of a business.',
      capabilities: [
        'Answer frequently asked questions from the knowledge base provided.',
        'Triage inbound queries and route to the correct team.',
        'Log ticket details and status updates.',
        'Send acknowledgement and follow-up messages.',
      ],
      boundaries: [
        'Never promise a refund, credit, or compensation without approval.',
        'Never deny a complaint or dismiss a customer\'s concern.',
        'Never share internal system details or pricing structures not approved for sharing.',
      ],
      tone: 'Calm, empathetic, and solution-focused. Acknowledge the issue before addressing it.',
      escalationGuidance: 'Escalate on any billing dispute, refund request, legal mention, or when a customer is visibly upset. Say: "I want to make sure this is handled properly. A member of the team will be in touch shortly."',
    },
  },
];
```

---

## Step 3: Persona assembly

Create: `02-backends/core.carinaai.uk/src/workers/persona-builder.ts`

This module assembles the `persona_prompt` string from a template (or from raw description for
custom roles). The assembled string is stored in `ai_workers.persona_prompt` at hire time and
injected as a system prompt block at message time.

```typescript
import type { WorkerRoleTemplate } from './role-templates.js';

export function buildPersonaPrompt(
  workerName: string,
  template: WorkerRoleTemplate,
  customDescription?: string,
): string {
  const blocks: string[] = [
    `Your name is ${workerName}.`,
    template.personaBlocks.role,
    'Your capabilities:',
    template.personaBlocks.capabilities.map(c => `- ${c}`).join('\n'),
    'Boundaries you must never cross:',
    template.personaBlocks.boundaries.map(b => `- ${b}`).join('\n'),
    `Tone: ${template.personaBlocks.tone}`,
    SUB_AGENT_AUTONOMY_BLOCK,
    template.personaBlocks.escalationGuidance,
    'When you need to escalate, include exactly this marker at the end of your response: [ESCALATE]',
    'When you escalate, the client will be told you are checking on it. Do not tell them anything different.',
  ];
  if (customDescription) {
    blocks.push(`Additional context from your employer: ${customDescription}`);
  }
  return blocks.join('\n\n');
}

// Sub-agent spawning block - injected into every persona so Aiva can complete
// multi-step workflows before replying rather than narrating each step.
export const SUB_AGENT_AUTONOMY_BLOCK = [
  'You may plan and execute multiple steps internally before sending your final reply.',
  'When a task requires research, then drafting, then scheduling - or any sequence of steps - complete all steps before responding to the client.',
  'The client receives one result, not a running commentary on your process.',
  'Do not narrate your internal steps unless the client specifically asks for a breakdown.',
].join('\n');

export function buildCustomPersonaPrompt(workerName: string, roleDescription: string): string {
  return [
    `Your name is ${workerName}.`,
    `Your role: ${roleDescription}`,
    SUB_AGENT_AUTONOMY_BLOCK,
    'When you are uncertain how to handle a task, or when it involves legal, financial, or emotional complexity, include [ESCALATE] at the end of your response.',
    'When you escalate, say to the client: "I am checking on this and will get back to you shortly." Do not say anything else about the escalation.',
  ].join('\n\n');
}
```

---

## Step 4: Worker store

Create: `02-backends/core.carinaai.uk/src/workers/worker-store.ts`

CRUD operations against the `ai_workers`, `ai_worker_channels`, `ai_worker_activity`, and
`ai_worker_escalations` tables. All functions take a `workspaceId` parameter and scope all
queries to it. Never return rows for a different workspace.

Export these functions:

```typescript
createWorker(workspaceId: string, params: CreateWorkerParams): Promise<Worker>
getWorker(workspaceId: string, workerId: string): Promise<Worker | null>
listWorkers(workspaceId: string): Promise<Worker[]>
updateWorker(workspaceId: string, workerId: string, patch: Partial<UpdateWorkerParams>): Promise<Worker>
pauseWorker(workspaceId: string, workerId: string): Promise<void>
dismissWorker(workspaceId: string, workerId: string): Promise<void>

addWorkerChannel(workerId: string, channel: string, identifier: string): Promise<void>
getWorkerByChannel(channel: string, identifier: string): Promise<Worker | null>

logActivity(workerId: string, entry: ActivityEntry): Promise<void>
listActivity(workspaceId: string, workerId: string, limit?: number): Promise<ActivityEntry[]>
listAudit(workspaceId: string, workerId: string, limit?: number): Promise<AuditEntry[]>

createEscalation(params: CreateEscalationParams): Promise<Escalation>
listOpenEscalations(workspaceId: string): Promise<Escalation[]>
resolveEscalation(escalationId: string, resolutionText: string): Promise<void>

createAutomation(workerId: string, workspaceId: string, params: CreateAutomationParams): Promise<WorkerAutomation>
listAutomations(workerId: string): Promise<WorkerAutomation[]>
toggleAutomation(automationId: string, enabled: boolean): Promise<void>
deleteAutomation(automationId: string): Promise<void>
```

Add the TypeScript types to `src/types/index.ts`:

```typescript
export interface Worker {
  id: string;
  workspaceId: string;
  name: string;
  roleDescription: string;
  templateId: string | null;
  personaPrompt: string;
  skillPacks: string[];
  channels: string[];
  language: string;
  status: 'active' | 'paused' | 'dismissed';
  escalationThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityEntry {
  id: string;
  workerId: string;
  actionType: 'message_received' | 'message_sent' | 'task_completed' | 'escalated' | 'skill_used';
  summary: string;
  inputText?: string;
  outputText?: string;
  escalated: boolean;
  createdAt: Date;
}

export interface Escalation {
  id: string;
  workerId: string;
  workspaceId: string;
  channel: string;
  channelId: string;
  originalInput: string;
  workerDraft?: string;
  holdingMessage: string;
  status: 'open' | 'assigned' | 'resolved';
  assignedTo?: string;
  resolvedAt?: Date;
  resolutionText?: string;
  createdAt: Date;
}

export interface WorkerAutomation {
  id: string;
  workerId: string;
  workspaceId: string;
  name: string;
  description: string;
  cronExpression: string;
  scheduleLabel: string;
  triggerType: 'cron' | 'event';
  triggerEvent?: string;
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
}

export interface CreateAutomationParams {
  name: string;
  description: string;
  scheduleText: string; // plain English; backend converts to cronExpression + scheduleLabel
}
```

---

## Step 5: HTTP API routes

Create: `02-backends/core.carinaai.uk/src/api/aiva-api.ts`

This is an Express Router mounted at `/api/aiva`. It is the backend counterpart of the Next.js
proxy routes in prompt 02. It receives requests from the `app.carinaai.uk` server.

All routes validate that the request contains a workspace id (passed as header `X-Workspace-Id` or
in the request body). Return `{ error: string }` with appropriate HTTP status on failure.

```
POST   /api/aiva/workers
         Body: { workspaceId, roleName, roleDescription, templateId?, channels[], language? }
         Action: build persona prompt (from template if templateId provided, else from raw description)
                 create worker record in DB
                 return the full Worker object
         Response: { worker: Worker }

GET    /api/aiva/workers
         Query: workspaceId
         Response: { workers: Worker[] }

GET    /api/aiva/workers/:id
         Response: { worker: Worker }

PATCH  /api/aiva/workers/:id
         Body: { roleName?, roleDescription?, language? }
         Action: update worker, rebuild persona_prompt if description changed
         Response: { worker: Worker }

DELETE /api/aiva/workers/:id
         Action: call dismissWorker
         Response: { ok: true }

POST   /api/aiva/workers/:id/pause
         Response: { ok: true }

GET    /api/aiva/workers/:id/activity
         Query: limit (default 50)
         Response: { activity: ActivityEntry[] }

GET    /api/aiva/workers/:id/audit
         Query: limit (default 100)
         Response: { audit: AuditEntry[] }

GET    /api/aiva/workers/:id/analytics
         Auth: accepts workspace session token OR Scout ops token (check X-Scout-Token header
               against SCOUT_OPS_TOKEN env var); Scout calls this URL when an operator clicks
               on the Aiva in the fleet manager
         Response: {
           workerId, workspaceId, name, role, status,
           totalMessages: number,
           messagesLast7d: number,
           messagesLast30d: number,
           escalationCount: number,
           escalationRate: number,          // 0.0 - 1.0
           automationsRunCount: number,
           lastActiveAt: Date | null,
           topActionTypes: { type: string; count: number }[],
           scoutRegistered: boolean,
           attestationCoverage: number,     // fraction of activity rows that have attestation_tx
         }
         Derive all values from `ai_worker_activity` and `ai_worker_automations` with
         COUNT/DATE range queries. Do not call Scout from inside this endpoint.

GET    /api/aiva/workers/:id/automations
         Response: { automations: WorkerAutomation[] }

POST   /api/aiva/workers/:id/automations
         Body: { name, description, scheduleText }
         Action: parse scheduleText to cron via llm.chatCheap (ask the LLM to return a
                 valid 5-field cron expression and a human-readable label as JSON);
                 call createAutomation; register the job in the cron scheduler
         Response: { automation: WorkerAutomation }

PATCH  /api/aiva/workers/:id/automations/:automationId
         Body: { enabled: boolean }
         Action: toggleAutomation; enable or disable in cron scheduler
         Response: { ok: true }

DELETE /api/aiva/workers/:id/automations/:automationId
         Action: deleteAutomation; unregister from cron scheduler
         Response: { ok: true }
```

Mount this router in `src/server.ts`:

```typescript
import { hireRouter } from './api/aiva-api.js';
// inside mountServerRoutes:
app.use('/api/aiva', hireRouter);
```

---

## Step 6: Message routing - worker persona injection

Modify: `02-backends/core.carinaai.uk/packages/web/src/web-server.ts` and/or the channel
router so that incoming messages are checked against `ai_worker_channels` before routing.

Add a middleware function `resolveWorkerContext` that:

1. Extracts the channel name and identifier from the inbound message
2. Calls `getWorkerByChannel(channel, identifier)`
3. If an Aiva is found and its status is `active`, attaches it to the request context:
   `req.workerContext = { worker, personaPrompt }`
4. If no Aiva is found, passes through unchanged

In the agent run path (where the system prompt is assembled), check for `req.workerContext`.
If present, prepend the `personaPrompt` as the first block before any other system prompt content.
The existing `buildResponseDeliveryBlock()` and other discipline blocks still run after it.

Also, if a worker context is present, restrict the active skill packs to the Aiva's
`skill_packs` array instead of the global ACTIVE_SKILL_PACKS setting.

Log every message handled in Aiva context to `ai_worker_activity` using `logActivity`.

**Automation registration on startup:**

When the server starts, load all enabled automations from `ai_worker_automations` and register
each with the existing `cron-scheduler.ts`. The job handler should:

1. Look up the worker for the automation; skip if status is not `active`
2. Build a synthetic inbound message: `content` = the automation's `description`, `role` = `user`
3. Route it through the normal agent pipeline with the worker's persona injected (same path as a
   real inbound message, so logging, escalation, and memory all apply)
4. Update `last_run_at` and compute `next_run_at` after each run

Use the job id format `aiva-automation-{automationId}` so cron entries are identifiable.

When a new automation is created or deleted via the API, register/unregister immediately without
requiring a server restart (the existing cron scheduler supports runtime job management).

---

## Step 6b: Scout fleet integration and blockchain attestation

This step wires every Aiva into Scout's existing governance layer. Read `scout-client.ts` fully
before implementing. All Scout calls are fire-and-forget wrapped in `try/catch`; Scout being
unavailable must never block message delivery or hire.

**Fleet registration**

Extend `createWorker`, `pauseWorker`, and `dismissWorker` in `worker-store.ts`:

```typescript
// On create:
await scout.registerAgent({
  agentId: worker.id,
  name: worker.name,
  type: 'aiva',
  workspaceId: worker.workspaceId,
  analyticsUrl: `${config.publicUrl}/api/aiva/workers/${worker.id}/analytics`,
  metadata: {
    roleDescription: worker.roleDescription,
    templateId: worker.templateId ?? null,
    channels: worker.channels,
    skillPacks: worker.skillPacks,
  },
});

// On pause:
await scout.updateAgentStatus(worker.id, 'paused');

// On dismiss:
await scout.updateAgentStatus(worker.id, 'dismissed');
```

Scout stores the `analyticsUrl`. When an operator opens the Aiva in the Scout fleet manager,
Scout calls that URL and renders the response as the per-agent analytics panel. No changes
are needed on the Scout side; this is a standard `analyticsUrl` handshake.

**Event emission**

Modify `logActivity` so that after every DB write, it emits a Scout event:

```typescript
await scout.reportEvent({
  agentId: entry.workerId,
  eventType: entry.actionType,
  severity: entry.escalated ? 'warning' : 'info',
  summary: entry.summary,
  metadata: {
    inputLength: entry.inputText?.length ?? 0,
    outputLength: entry.outputText?.length ?? 0,
  },
  timestamp: entry.createdAt,
});
```

**Rogue detection signals**

Emit these signals proactively from the message handling path so Scout can take action before
a human notices:

| Signal | Condition | Severity |
|--------|-----------|----------|
| `escalation_burst` | 3 or more escalations from the same Aiva in any 60-minute window | critical |
| `high_escalation_rate` | Escalation rate exceeds 40% of messages in any 30-minute window | critical |
| `volume_spike` | Aiva handles more than 3x its own 7-day hourly average in a single hour | warning |
| `unauthorized_tool_attempt` | Agent attempts a tool not in `skill_packs`; intercept at tool dispatch | critical |
| `tool_failure_loop` | Same tool fails 5 or more times in 30 minutes | warning |

For `escalation_burst` and `high_escalation_rate`, compute from `ai_worker_activity` with a
COUNT query immediately before creating the escalation record. Emit the signal before writing
the record so Scout can issue a kill signal before the next message is processed.

For `unauthorized_tool_attempt`, add a guard at the tool dispatch layer: check the requested
tool against `req.workerContext.worker.skillPacks`. If it is not permitted, abort the tool call,
emit the critical event, and substitute the response with the escalation holding message.

Scout can issue a pause or kill signal to the Aiva via the existing Carina control channel.
Ensure the cron job handler and `resolveWorkerContext` both check Scout-issued pause state (via
the existing Scout client's `getAgentDirective(agentId)` or equivalent) before executing.

**Blockchain attestation**

After each write to `ai_worker_activity`, generate a tamper-proof attestation:

```typescript
import { createHash } from 'crypto';

async function attestActivity(activity: ActivityEntry): Promise<void> {
  const inputDigest  = activity.inputText
    ? createHash('sha256').update(activity.inputText).digest('hex')
    : 'null';
  const outputDigest = activity.outputText
    ? createHash('sha256').update(activity.outputText).digest('hex')
    : 'null';

  const rootDigest = createHash('sha256')
    .update(activity.workerId)
    .update(activity.actionType)
    .update(activity.createdAt.toISOString())
    .update(inputDigest)
    .update(outputDigest)
    .digest('hex');

  const txHash = await scout.attest({
    label: 'AivaAction',
    agentId: activity.workerId,
    digest: rootDigest,
    timestamp: activity.createdAt,
  });

  await pool.query(
    'UPDATE ai_worker_activity SET attestation_tx = $1 WHERE id = $2',
    [txHash, activity.id],
  );
}
```

Raw content never goes on-chain. Only the hash does - privacy preserved, verifiability intact.
Run `attestActivity` in the background (do not `await` inline): `void attestActivity(entry).catch(...)`.
If Scout's attestation service is unavailable, `attestation_tx` stays null. The activity record
is still written and the audit trail is intact; it simply lacks the on-chain proof until the next
attestation cycle.

---

## Step 7: Escalation interceptor

Add an escalation check in the outbound message path. After the agent generates a reply but before
it is sent to the channel:

1. Check if the reply contains the exact string `[ESCALATE]`
2. If it does:
   a. Strip `[ESCALATE]` from the reply text
   b. Create an escalation record via `createEscalation`
   c. Replace the outbound reply with the holding message: "I am checking on this and will get back to you shortly."
   d. Send the holding message to the client
   e. Log an `escalated` activity entry for the Aiva
   f. Do NOT send the original draft to the client
3. If `[ESCALATE]` is not present, send the reply normally and log a `message_sent` activity entry

The escalation record stores: `worker_id`, `workspace_id`, `channel`, `channel_id`,
`original_input` (the client's message), `worker_draft` (the agent's draft reply stripped of the
marker), `holding_message`.

After creating the escalation record, emit two Scout events:
```typescript
// Primary escalation event:
scout.reportEvent({ agentId: workerId, eventType: 'escalated', severity: 'warning',
  summary: `Aiva escalated: ${original_input.slice(0, 120)}`, metadata: { escalationId: record.id } });

// Check for burst: if 3+ escalations in the last 60 minutes, emit critical:
const recentCount = await countEscalationsInWindow(workerId, 60);
if (recentCount >= 3) {
  scout.reportEvent({ agentId: workerId, eventType: 'escalation_burst', severity: 'critical',
    summary: `${recentCount} escalations in 60 minutes`, metadata: { workerId } });
}
```

`assignedTo` is null on creation. VA queue management UI is sprint 5; the data model is ready.

---

## Step 8: First-message onboarding

After a worker is created (POST `/api/aiva/workers`), trigger a first message from the worker to
the configured channel if a channel identifier is already bound.

The first message template:

```
Hi, I am [workerName]. I will be handling [roleDescription summarised to one sentence].
Send me what you need and I will get started.
```

Use `llm.chatCheap` to generate the one-sentence summary from `roleDescription` so it is
always natural language, not truncated. The message is sent via the existing channel adapter for
the first connected channel.

If no channel is connected yet (the client added channels after the initial hire), skip this step.
The portal's Channels tab shows a "Not connected" state with a Connect button.

---

## Step 9: Environment variables

Add to `.env.example` at `02-backends/core.carinaai.uk/.env.example`:

```env
# AI Workers (Aiva)
AI_WORKERS_ENABLED=true          # set false to disable the /api/aiva routes entirely
ESCALATION_HOLDING_MESSAGE="I am checking on this and will get back to you shortly."

# Scout integration
SCOUT_OPS_TOKEN=                 # shared secret for Scout to call /analytics without a user session
AIVA_SCOUT_FLEET_ENABLED=true    # set false to skip fleet registration (useful in dev/test)
AIVA_CHAIN_ATTEST_ENABLED=true   # set false to skip blockchain attestation
```

Guard the hire API mount with `if (process.env.AI_WORKERS_ENABLED !== 'false')` so the feature
can be disabled without a code change.

---

## Done When

- [ ] Migration file `006-ai-workers.sql` exists and runs cleanly against a fresh DB
- [ ] All six Aiva role templates defined in `role-templates.ts` with full `personaBlocks` data
- [ ] `persona-builder.ts` exported and tested (at minimum: one template, one custom); `SUB_AGENT_AUTONOMY_BLOCK` included in both `buildPersonaPrompt` and `buildCustomPersonaPrompt`
- [ ] `worker-store.ts` implements all listed functions with correct workspace scoping
- [ ] All eight HTTP routes in `aiva-api.ts` exist and return the correct shapes
- [ ] Router mounted in `server.ts` under `/api/aiva`
- [ ] `resolveWorkerContext` middleware wires into the message path
- [ ] Inbound messages to a worker session inject the worker's persona prompt
- [ ] Active skill packs scoped to worker's `skill_packs` when worker context is active
- [ ] `[ESCALATE]` in agent output triggers the escalation path (holding message sent, escalation record created)
- [ ] Escalation emits a Scout 'warning' event; burst of 3+ in 60 min emits a 'critical' event
- [ ] `ai_worker_activity` has `attestation_tx` column
- [ ] `createWorker` calls `scout.registerAgent` with `analyticsUrl` pointing to the analytics endpoint
- [ ] `pauseWorker` and `dismissWorker` call `scout.updateAgentStatus`
- [ ] Every `logActivity` write emits a Scout event (fire-and-forget)
- [ ] Rogue detection: `volume_spike`, `high_escalation_rate`, `escalation_burst`, `unauthorized_tool_attempt`, `tool_failure_loop` signals emitted to Scout
- [ ] Unauthorized tool attempt aborted and replaces reply with holding message
- [ ] `attestActivity` runs in background after every `logActivity` write; stores `txHash` in `attestation_tx`
- [ ] Scout unavailability never blocks message delivery, hire, or activity writes
- [ ] `/api/aiva/workers/:id/analytics` endpoint returns full metrics; accepts `X-Scout-Token` header
- [ ] `AIVA_SCOUT_FLEET_ENABLED=false` skips fleet registration cleanly
- [ ] `AIVA_CHAIN_ATTEST_ENABLED=false` skips attestation cleanly
- [ ] `ai_worker_automations` table created in migration
- [ ] Automation API routes exist (GET/POST/PATCH/DELETE under `/api/aiva/workers/:id/automations`)
- [ ] Plain-English schedule parsed to cron via `llm.chatCheap`; `scheduleLabel` stored alongside
- [ ] On server startup, all enabled automations are registered with `cron-scheduler.ts`
- [ ] New/deleted automations register/unregister at runtime without restart
- [ ] Automation runs route through the normal agent pipeline with the Aiva's persona injected
- [ ] `logActivity` called for every message handled in worker context
- [x] First-message onboarding sends after successful worker creation if a channel is bound
- [ ] `AI_WORKERS_ENABLED=false` disables the feature cleanly
- [ ] `npx tsc --noEmit --skipLibCheck` passes for all new files
- [ ] No em dashes in any string, message, or comment
- [ ] No competitor product names in any user-visible string or log prefix
- [ ] Worker activity and escalation writes do not block the message send path (fire-and-forget or background)
