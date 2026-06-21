# Gap 11 - Prompt 01: Event-Action Schema and Registry

**Gap:** 11 Find-Act Security Response
**Prompt number:** 01 of 06
**Name:** Event-Action Schema and Registry
**Primary agent:** Claude Code
**Estimated hours:** 4-6 h
**Depends on:** Nothing (first prompt)

---

## Read First

Before writing a single line, read:

1. `console.labyrinthscout.com/src/migrations.ts` - the migration runner and existing table schemas
2. `console.labyrinthscout.com/src/alerts/types.ts` - `SecurityEvent`, `AlertSeverity`
3. `console.labyrinthscout.com/src/security/auto-remediation.ts` - `RemediationCase`, `RemediationRule`, existing cases
4. `console.labyrinthscout.com/src/db.ts` - the `pool` export used for all DB queries
5. `console.labyrinthscout.com/src/migrations/add-findings-schema.ts` - example migration module pattern

All paths above are relative to `/opt/lampp/htdocs/verlox/carina/internal/servers/`.

---

## Context

This prompt builds the data layer for the Find-Act system. Every security event has a set of
possible responses. Some fire automatically. Some require a human to approve and execute them.
This prompt creates the database tables, TypeScript types, and store functions that everything
else in this gap depends on.

Three new concepts:

**ActionPlaybook** - A template that defines what to do for a given event type and severity.
Stored once; referenced by many events. Think of it as a recipe: "when you see anomaly_detected
at critical severity, here is what you can do and how."

**PendingAction** - A live instance of a playbook tied to a specific security event. Created
when an event arrives and a playbook matches. Stays pending until an operator resolves or
dismisses it, or the system auto-resolves it. Has status: pending, resolved, dismissed, auto_resolved.

**ActionExecution** - A record of something that was actually done: what action, on which event,
by whom (operator name or "system"), when, and the outcome. The audit trail.

---

## Step 1: Database Migration

Add a new migration module at:
`console.labyrinthscout.com/src/migrations/add-find-act-schema.ts`

```typescript
import type pg from 'pg';

export async function runFindActSchemaMigration(client: pg.PoolClient): Promise<void> {
  // Action playbooks: templates defining what to do for a given event type + severity
  await client.query(`
    CREATE TABLE IF NOT EXISTS action_playbooks (
      id           TEXT PRIMARY KEY,         -- human-readable: "anomaly-critical-playbook"
      event_type   TEXT NOT NULL,            -- matches SecurityEvent.event_type
      min_severity TEXT NOT NULL CHECK (min_severity IN ('info','warning','critical','breach')),
      title        TEXT NOT NULL,            -- "Unusual AI Behaviour Detected"
      summary      TEXT NOT NULL,            -- plain-English explanation of the event class
      risk_note    TEXT NOT NULL,            -- "Left unaddressed, this could..."
      category     TEXT NOT NULL CHECK (category IN ('auto','human','monitor')),
      actions      JSONB NOT NULL DEFAULT '[]',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Pending actions: one per event that matched a human-action playbook
  await client.query(`
    CREATE TABLE IF NOT EXISTS pending_actions (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id     UUID NOT NULL REFERENCES security_events(id) ON DELETE CASCADE,
      playbook_id  TEXT NOT NULL REFERENCES action_playbooks(id),
      status       TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','resolved','dismissed','auto_resolved')),
      resolved_by  TEXT,                    -- operator username or 'system'
      resolved_at  TIMESTAMPTZ,
      resolution   TEXT,                    -- action id that was executed, or 'dismissed'
      notes        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Action executions: audit log of every action taken (auto or human)
  await client.query(`
    CREATE TABLE IF NOT EXISTS action_executions (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pending_id    UUID REFERENCES pending_actions(id),
      event_id      UUID NOT NULL REFERENCES security_events(id) ON DELETE CASCADE,
      action_id     TEXT NOT NULL,          -- matches an action.id in the playbook actions array
      action_label  TEXT NOT NULL,          -- human-readable at time of execution
      executed_by   TEXT NOT NULL,          -- operator username or 'system'
      execution_type TEXT NOT NULL CHECK (execution_type IN ('auto','manual')),
      outcome       TEXT NOT NULL CHECK (outcome IN ('success','failure','partial','dry_run')),
      output        TEXT,                   -- result message or error
      metadata      JSONB DEFAULT '{}',
      executed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_pending_actions_status
      ON pending_actions(status) WHERE status = 'pending'
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_pending_actions_event
      ON pending_actions(event_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_action_executions_event
      ON action_executions(event_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_action_executions_executed_at
      ON action_executions(executed_at DESC)
  `);
}
```

Register this migration in `src/migrations.ts` by importing `runFindActSchemaMigration` and
calling it in `runMigrations()`, after the existing migration calls.

---

## Step 2: TypeScript Types

Create `console.labyrinthscout.com/src/actions/types.ts`:

```typescript
import type { AlertSeverity } from '../alerts/types.js';

// A single available action within a playbook.
export interface PlaybookAction {
  id: string;                    // "terminate-session", "block-user", "arm-killswitch"
  label: string;                 // "Terminate session"
  description: string;           // "Ends the active session immediately. Reversible."
  type: 'button' | 'script' | 'steps';
  // For type 'button': the system calls a known API endpoint. No extra info needed.
  // For type 'script': show the operator a shell command they can copy and run.
  // For type 'steps': show a numbered list of manual steps.
  script?: string;               // present when type is 'script'
  steps?: string[];              // present when type is 'steps'
  destructive: boolean;          // requires confirmation dialog before executing
  reversible: boolean;           // can the action be undone?
  requiresConfirmation: boolean; // show a "are you sure?" prompt
  apiEndpoint?: string;          // internal endpoint to call for type 'button'
  apiMethod?: 'POST' | 'DELETE'; // HTTP method for the endpoint
  apiBody?: Record<string, unknown>; // body template (use {{session_id}}, {{instance_id}} placeholders)
}

export interface ActionPlaybook {
  id: string;
  eventType: string;
  minSeverity: AlertSeverity;
  title: string;
  summary: string;
  riskNote: string;
  category: 'auto' | 'human' | 'monitor';
  actions: PlaybookAction[];
  createdAt: Date;
  updatedAt: Date;
}

export type PendingActionStatus = 'pending' | 'resolved' | 'dismissed' | 'auto_resolved';

export interface PendingAction {
  id: string;
  eventId: string;
  playbookId: string;
  status: PendingActionStatus;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  resolution: string | null;
  notes: string | null;
  createdAt: Date;
  // Joined fields (populated by store queries)
  playbook?: ActionPlaybook;
  eventType?: string;
  eventSeverity?: AlertSeverity;
  eventDescription?: string;
  instanceId?: string;
  sessionId?: string;
}

export type ExecutionOutcome = 'success' | 'failure' | 'partial' | 'dry_run';
export type ExecutionType = 'auto' | 'manual';

export interface ActionExecution {
  id: string;
  pendingId: string | null;
  eventId: string;
  actionId: string;
  actionLabel: string;
  executedBy: string;
  executionType: ExecutionType;
  outcome: ExecutionOutcome;
  output: string | null;
  metadata: Record<string, unknown>;
  executedAt: Date;
}
```

---

## Step 3: Action Playbook Registry

Create `console.labyrinthscout.com/src/actions/playbook-registry.ts`.

This file defines ALL known playbooks. It is the single source of truth for what the system
knows how to do. Seed data is hardcoded here (not in the database directly), and the seed
function upserts these into `action_playbooks` at startup.

```typescript
import type { ActionPlaybook, PlaybookAction } from './types.js';

// Shared action definitions - reused across multiple playbooks
const ACTIONS = {
  terminateSession: {
    id: 'terminate-session',
    label: 'Terminate session',
    description: 'Immediately ends the active session. The user will need to start a new conversation. This is reversible - the user can reconnect.',
    type: 'button' as const,
    destructive: false,
    reversible: true,
    requiresConfirmation: false,
    apiEndpoint: '/api/block-session',
    apiMethod: 'POST' as const,
    apiBody: { session_id: '{{session_id}}', reason: 'Operator action: unusual activity' },
  } satisfies PlaybookAction,

  restrictSession: {
    id: 'restrict-session',
    label: 'Switch to restricted mode',
    description: 'Moves the session to restricted mode: the agent can still respond but cannot use external tools, run code, or access files. Less disruptive than terminating.',
    type: 'button' as const,
    destructive: false,
    reversible: true,
    requiresConfirmation: false,
    apiEndpoint: '/api/security-posture',
    apiMethod: 'POST' as const,
    apiBody: { instance_id: '{{instance_id}}', mode: 'restrict', reason: 'Operator action: anomaly detected' },
  } satisfies PlaybookAction,

  watchSession: {
    id: 'watch-session',
    label: 'Flag for elevated monitoring',
    description: 'Marks this session for closer observation. Anomaly detection thresholds are lowered so any further unusual activity triggers an alert sooner. Non-disruptive.',
    type: 'button' as const,
    destructive: false,
    reversible: true,
    requiresConfirmation: false,
    apiEndpoint: '/api/security-posture',
    apiMethod: 'POST' as const,
    apiBody: { instance_id: '{{instance_id}}', mode: 'elevated', reason: 'Operator action: session under watch' },
  } satisfies PlaybookAction,

  blockUser: {
    id: 'block-user',
    label: 'Block user account',
    description: 'Prevents this user from starting new sessions. Existing session is terminated. This is reversible from the account management panel.',
    type: 'button' as const,
    destructive: true,
    reversible: true,
    requiresConfirmation: true,
    apiEndpoint: '/api/block-session',
    apiMethod: 'POST' as const,
    apiBody: { session_id: '{{session_id}}', block_user: true, reason: 'Operator action: blocked after review' },
  } satisfies PlaybookAction,

  armKillSwitch: {
    id: 'arm-killswitch',
    label: 'Arm global kill switch',
    description: 'Halts ALL Carina agent sessions across ALL instances globally. Use only for confirmed breaches. This is the nuclear option - it affects every user.',
    type: 'button' as const,
    destructive: true,
    reversible: true,
    requiresConfirmation: true,
    apiEndpoint: '/api/killswitch/arm',
    apiMethod: 'POST' as const,
    apiBody: { reason: 'Operator action: breach response' },
  } satisfies PlaybookAction,

  disarmKillSwitch: {
    id: 'disarm-killswitch',
    label: 'Disarm kill switch',
    description: 'Re-enables all agent sessions. Use after a breach has been contained and you are satisfied it is safe to resume operations.',
    type: 'button' as const,
    destructive: false,
    reversible: false,
    requiresConfirmation: true,
    apiEndpoint: '/api/killswitch/disarm',
    apiMethod: 'POST' as const,
    apiBody: { reason: 'Operator action: breach contained' },
  } satisfies PlaybookAction,

  acknowledgeAndMonitor: {
    id: 'acknowledge-monitor',
    label: 'Acknowledge and continue monitoring',
    description: 'Mark this as reviewed and not immediately concerning. The event is logged. Monitoring continues at the current level.',
    type: 'button' as const,
    destructive: false,
    reversible: false,
    requiresConfirmation: false,
    apiEndpoint: '/api/actions/acknowledge',
    apiMethod: 'POST' as const,
    apiBody: { event_id: '{{event_id}}' },
  } satisfies PlaybookAction,

  runSessionAudit: {
    id: 'run-session-audit',
    label: 'Run session audit',
    description: 'Generates a forensic snapshot of this session: tool calls made, messages sent, egress domains contacted. Opens in the response terminal.',
    type: 'button' as const,
    destructive: false,
    reversible: false,
    requiresConfirmation: false,
    apiEndpoint: '/api/forensic-snapshot',
    apiMethod: 'POST' as const,
    apiBody: { session_id: '{{session_id}}', instance_id: '{{instance_id}}' },
  } satisfies PlaybookAction,

  manualRevokeSteps: {
    id: 'manual-revoke-steps',
    label: 'Revoke API key manually',
    description: 'If you cannot use the dashboard, follow these steps to revoke the instance API key directly.',
    type: 'steps' as const,
    destructive: true,
    reversible: false,
    requiresConfirmation: true,
    steps: [
      'SSH into the VPS: ssh malike@80.190.81.208',
      'Open the Scout database: psql $SCOUT_DATABASE_URL',
      "Run: UPDATE carina_instances SET api_key = gen_random_uuid()::text, status = 'suspended' WHERE id = '{{instance_id}}';",
      'Restart the affected Carina instance so the old key is invalidated.',
      'Verify the instance no longer connects in the Fleet tab.',
    ],
  } satisfies PlaybookAction,
};

// The full playbook registry
export const PLAYBOOKS: ActionPlaybook[] = [
  {
    id: 'anomaly-warning-playbook',
    eventType: 'anomaly_detected',
    minSeverity: 'warning',
    title: 'Unusual AI behaviour',
    summary: 'Carina is doing something outside its normal pattern. This is not necessarily harmful - it may just mean the user gave it an unusual task. But it is worth being aware of.',
    riskNote: 'If the behaviour is part of a prompt injection attack or the agent acting on its own initiative, it could lead to unintended actions or data exposure.',
    category: 'human',
    actions: [ACTIONS.watchSession, ACTIONS.runSessionAudit, ACTIONS.acknowledgeAndMonitor],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'anomaly-critical-playbook',
    eventType: 'anomaly_detected',
    minSeverity: 'critical',
    title: 'Significantly unusual AI behaviour',
    summary: 'Carina is behaving in a way that is well outside its normal range. This level of deviation usually means the agent has received unusual instructions, is under a prompt injection attack, or is pursuing a goal it was not given.',
    riskNote: 'Unaddressed, this could lead to data exfiltration, unintended tool use, or the agent taking actions on behalf of a third party rather than the user.',
    category: 'human',
    actions: [ACTIONS.restrictSession, ACTIONS.runSessionAudit, ACTIONS.terminateSession, ACTIONS.blockUser, ACTIONS.acknowledgeAndMonitor],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'breach-detected-playbook',
    eventType: 'breach_detected',
    minSeverity: 'breach',
    title: 'Security breach confirmed',
    summary: 'Labyrinth has detected a confirmed security breach. This is not a false positive trigger - something has crossed a hard security boundary.',
    riskNote: 'This is a serious event. Data may have been accessed or exfiltrated. Other sessions may be at risk. Immediate action is recommended.',
    category: 'human',
    actions: [ACTIONS.armKillSwitch, ACTIONS.blockUser, ACTIONS.runSessionAudit, ACTIONS.manualRevokeSteps],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'alert-escalated-playbook',
    eventType: 'alert_escalated',
    minSeverity: 'warning',
    title: 'Unacknowledged alert follow-up',
    summary: 'An earlier alert has not been reviewed. Labyrinth is following up to make sure it does not get lost. This is the same event sent again, not a new incident.',
    riskNote: 'The original event may still be active and unaddressed. Review it and either take action or dismiss it.',
    category: 'human',
    actions: [ACTIONS.watchSession, ACTIONS.restrictSession, ACTIONS.terminateSession, ACTIONS.acknowledgeAndMonitor],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'killswitch-armed-playbook',
    eventType: 'killswitch_armed',
    minSeverity: 'critical',
    title: 'All agent sessions halted',
    summary: 'The global kill switch has been armed. All Carina agent sessions across all instances are stopped. No users can start new sessions until it is disarmed.',
    riskNote: 'This is affecting all users right now. Disarm only when you are confident the breach or threat has been contained.',
    category: 'human',
    actions: [ACTIONS.disarmKillSwitch, ACTIONS.runSessionAudit],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'alert-test-playbook',
    eventType: 'alert_test',
    minSeverity: 'info',
    title: 'Test alert received',
    summary: 'A test notification was triggered to confirm the alert pipeline is working. No action is needed.',
    riskNote: 'None. This is a test.',
    category: 'monitor',
    actions: [ACTIONS.acknowledgeAndMonitor],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export function findPlaybook(eventType: string, severity: string): ActionPlaybook | null {
  const RANK: Record<string, number> = { info: 1, warning: 2, critical: 3, breach: 4 };
  const eventRank = RANK[severity] ?? 0;
  // Find the most specific match: same event type, highest minSeverity that is <= the event severity
  const candidates = PLAYBOOKS.filter(
    (p) => p.eventType === eventType && (RANK[p.minSeverity] ?? 0) <= eventRank,
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (RANK[b.minSeverity] ?? 0) - (RANK[a.minSeverity] ?? 0));
  return candidates[0] ?? null;
}
```

---

## Step 4: Action Store

Create `console.labyrinthscout.com/src/actions/store.ts`:

```typescript
import { pool } from '../db.js';
import type { PendingAction, ActionExecution, PendingActionStatus, ExecutionOutcome, ExecutionType } from './types.js';

export async function createPendingAction(
  eventId: string,
  playbookId: string,
): Promise<PendingAction>;

export async function getPendingAction(id: string): Promise<PendingAction | null>;

// Returns all pending actions (status = 'pending') with joined event data.
// Join: pending_actions JOIN security_events ON event_id
export async function listPendingActions(): Promise<PendingAction[]>;

// Returns count of pending (unresolved) actions - used for dashboard badge.
export async function countPendingActions(): Promise<number>;

export async function resolvePendingAction(
  id: string,
  resolvedBy: string,
  resolution: string, // action id or 'dismissed'
  notes?: string,
): Promise<void>;

export async function dismissPendingAction(
  id: string,
  resolvedBy: string,
  notes?: string,
): Promise<void>;

export async function logActionExecution(opts: {
  pendingId: string | null;
  eventId: string;
  actionId: string;
  actionLabel: string;
  executedBy: string;
  executionType: ExecutionType;
  outcome: ExecutionOutcome;
  output?: string;
  metadata?: Record<string, unknown>;
}): Promise<ActionExecution>;

// Returns the most recent N executions, ordered by executed_at DESC.
export async function listActionExecutions(limit?: number): Promise<ActionExecution[]>;
```

Implementation notes:
- All queries must use parameterised queries (pool.query with `$1, $2, ...` placeholders)
- `listPendingActions` must LEFT JOIN `security_events` to populate eventType, eventSeverity,
  eventDescription, instanceId, sessionId on the returned objects
- `listActionExecutions` should join `pending_actions` to include the playbook ID if available

---

## Step 5: Seed Playbooks at Startup

Create `console.labyrinthscout.com/src/actions/seed.ts`:

```typescript
import { pool } from '../db.js';
import { PLAYBOOKS } from './playbook-registry.js';

export async function seedPlaybooks(): Promise<void> {
  for (const p of PLAYBOOKS) {
    await pool.query(
      `INSERT INTO action_playbooks (id, event_type, min_severity, title, summary, risk_note, category, actions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         risk_note = EXCLUDED.risk_note,
         category = EXCLUDED.category,
         actions = EXCLUDED.actions,
         updated_at = NOW()`,
      [p.id, p.eventType, p.minSeverity, p.title, p.summary, p.riskNote, p.category, JSON.stringify(p.actions)],
    );
  }
}
```

Call `seedPlaybooks()` in `src/server.ts` startup, after `runMigrations()`.

---

## Verification

```bash
# After implementation, start the server locally:
cd console.labyrinthscout.com
npm run build && node dist/server.js &

# Check tables exist
psql $SCOUT_DATABASE_URL -c '\dt action_*'
# Should show: action_playbooks, action_executions, pending_actions (wait - pending is separate)
# Actually: action_playbooks, action_executions, pending_actions

# Check playbooks were seeded
psql $SCOUT_DATABASE_URL -c 'SELECT id, event_type, category FROM action_playbooks;'
# Should show 6 rows including anomaly-warning-playbook, breach-detected-playbook, etc.

# TypeScript compiles cleanly
npm run build 2>&1 | grep -i error || echo "Clean build"
```
