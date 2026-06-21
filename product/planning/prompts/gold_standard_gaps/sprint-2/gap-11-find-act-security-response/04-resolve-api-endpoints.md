# Gap 11 - Prompt 04: Resolve API Endpoints

**Gap:** 11 Find-Act Security Response
**Prompt number:** 04 of 06
**Name:** Resolve API Endpoints
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** Prompt 01 (schema, store), Prompt 02 (executor)

---

## Read First

Before writing a single line, read:

1. `console.labyrinthscout.com/src/api/events.ts` - pattern for event-related API routes
2. `console.labyrinthscout.com/src/api/auto-remediation.ts` - existing remediation API structure
3. `console.labyrinthscout.com/src/middleware/plan-gate.ts` - the plan-gate middleware (check
   if it applies to new operator endpoints)
4. `console.labyrinthscout.com/src/server.ts` - how routers are mounted (the route prefix pattern)
5. `console.labyrinthscout.com/src/actions/store.ts` - store functions from Prompt 01
6. `console.labyrinthscout.com/src/actions/executor.ts` - `executeAutoAction()` from Prompt 02
7. `console.labyrinthscout.com/src/actions/playbook-registry.ts` - `findPlaybook()`

All paths are relative to `/opt/lampp/htdocs/verlox/carina/internal/servers/`.

---

## Context

This prompt adds the HTTP endpoints that the dashboard modal (Prompt 03) calls when an operator
clicks an action button. All endpoints require operator authentication. All executions are logged
to `action_executions` via the store from Prompt 01.

The resolve flow is:
1. Operator opens pending action modal (GET /api/actions/pending)
2. Operator clicks an action button
3. Dashboard calls POST /api/actions/:pendingId/execute with { action_id: string }
4. API looks up the pending action and its playbook
5. API finds the matching PlaybookAction by action_id
6. API calls executeAutoAction() from Prompt 02
7. API logs the execution
8. API marks the pending action as resolved
9. Returns: { ok: true, message: string }

---

## Step 1: Create the Actions Router

Create `console.labyrinthscout.com/src/api/actions.ts`:

```typescript
import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import {
  listPendingActions,
  countPendingActions,
  getPendingAction,
  resolvePendingAction,
  dismissPendingAction,
  logActionExecution,
} from '../actions/store.js';
import { executeAutoAction } from '../actions/executor.js';
import { findPlaybook, PLAYBOOKS } from '../actions/playbook-registry.js';
import { pool } from '../db.js';

export const actionsRouter: IRouter = Router();

// GET /api/actions/pending
// Returns all unresolved pending actions with joined event data and playbook details.
// Used by the dashboard widget to render the pending actions list.
actionsRouter.get('/pending', async (_req: Request, res: Response): Promise<void> => {
  try {
    const pending = await listPendingActions();

    // Enrich each pending action with its playbook from the in-memory registry.
    // This avoids a DB join on the JSONB actions column.
    const enriched = pending.map((p) => {
      const playbook = PLAYBOOKS.find((pb) => pb.id === p.playbookId) ?? null;
      return { ...p, playbook };
    });

    res.json({ pending: enriched, count: enriched.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// GET /api/actions/pending/count
// Returns only the count of pending actions. Used to update the dashboard badge.
actionsRouter.get('/pending/count', async (_req: Request, res: Response): Promise<void> => {
  try {
    const count = await countPendingActions();
    res.json({ count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// GET /api/actions/pending/:id
// Returns a single pending action with playbook details.
actionsRouter.get('/pending/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const pending = await getPendingAction(req.params.id);
    if (!pending) {
      res.status(404).json({ error: 'Pending action not found' });
      return;
    }
    const playbook = PLAYBOOKS.find((pb) => pb.id === pending.playbookId) ?? null;
    res.json({ ...pending, playbook });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/actions/:pendingId/execute
// Executes a specific action from the pending action's playbook.
// Body: { action_id: string, dry_run?: boolean }
actionsRouter.post('/:pendingId/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const { pendingId } = req.params;
    const body = req.body as Record<string, unknown>;

    if (typeof body.action_id !== 'string' || !body.action_id) {
      res.status(400).json({ error: 'action_id is required' });
      return;
    }

    const pending = await getPendingAction(pendingId);
    if (!pending) {
      res.status(404).json({ error: 'Pending action not found' });
      return;
    }
    if (pending.status !== 'pending') {
      res.status(409).json({ error: `Pending action is already ${pending.status}` });
      return;
    }

    const playbook = PLAYBOOKS.find((pb) => pb.id === pending.playbookId);
    if (!playbook) {
      res.status(500).json({ error: 'Playbook not found for this pending action' });
      return;
    }

    const action = playbook.actions.find((a) => a.id === body.action_id);
    if (!action) {
      res.status(400).json({ error: `Action '${body.action_id}' not found in playbook` });
      return;
    }

    // Determine the operator identity. Use session/auth from the request if available.
    // Fall back to 'operator' if auth is not yet wired.
    const operatorId =
      (req as any).user?.username ??
      (req as any).operator?.id ??
      req.headers['x-operator-id'] as string ??
      'operator';

    const isDryRun = body.dry_run === true;

    // Build a mock SecurityEvent from the pending action data for the executor.
    // The executor only needs session_id and instance_id from the event.
    const mockEvent = {
      id: pending.eventId,
      session_id: pending.sessionId ?? '',
      instance_id: pending.instanceId ?? '',
      event_type: pending.eventType ?? '',
      severity: pending.eventSeverity ?? 'info',
      description: pending.eventDescription ?? '',
      created_at: new Date(),
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
    };

    let result: { ok: boolean; message: string };

    if (isDryRun) {
      result = { ok: true, message: `Dry run: would execute "${action.label}"` };
    } else {
      result = await executeAutoAction(action, mockEvent);
    }

    // Log the execution regardless of outcome.
    await logActionExecution({
      pendingId,
      eventId: pending.eventId,
      actionId: action.id,
      actionLabel: action.label,
      executedBy: operatorId,
      executionType: 'manual',
      outcome: isDryRun ? 'dry_run' : result.ok ? 'success' : 'failure',
      output: result.message,
      metadata: { playbookId: playbook.id, dry_run: isDryRun },
    });

    if (result.ok && !isDryRun) {
      // Mark the pending action resolved.
      await resolvePendingAction(pendingId, operatorId, action.id);
    }

    if (!result.ok && !isDryRun) {
      res.status(500).json({ ok: false, error: result.message });
      return;
    }

    res.json({ ok: true, message: result.message, dry_run: isDryRun });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/actions/:pendingId/dismiss
// Dismisses a pending action without executing any action.
// Body: { notes?: string }
actionsRouter.post('/:pendingId/dismiss', async (req: Request, res: Response): Promise<void> => {
  try {
    const { pendingId } = req.params;
    const body = req.body as Record<string, unknown>;

    const pending = await getPendingAction(pendingId);
    if (!pending) {
      res.status(404).json({ error: 'Pending action not found' });
      return;
    }
    if (pending.status !== 'pending') {
      res.status(409).json({ error: `Pending action is already ${pending.status}` });
      return;
    }

    const operatorId =
      (req as any).user?.username ??
      (req as any).operator?.id ??
      req.headers['x-operator-id'] as string ??
      'operator';

    const notes = typeof body.notes === 'string' ? body.notes : 'Dismissed by operator';

    await dismissPendingAction(pendingId, operatorId, notes);

    // Log the dismissal as an execution record so it appears in the audit trail.
    await logActionExecution({
      pendingId,
      eventId: pending.eventId,
      actionId: 'dismiss',
      actionLabel: 'Dismissed without action',
      executedBy: operatorId,
      executionType: 'manual',
      outcome: 'success',
      output: notes,
      metadata: {},
    });

    res.json({ ok: true, message: 'Pending action dismissed' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/actions/acknowledge
// Acknowledges a security event (marks it reviewed). Used by the acknowledge-monitor action.
// Body: { event_id: string }
actionsRouter.post('/acknowledge', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    if (typeof body.event_id !== 'string') {
      res.status(400).json({ error: 'event_id required' });
      return;
    }

    // Update the security_event to mark it acknowledged if that column exists,
    // or just log the acknowledgment to action_executions.
    // Check if security_events has an 'acknowledged' column (it may from the original schema).
    await pool.query(
      `UPDATE security_events SET mitigated = TRUE WHERE id = $1`,
      [body.event_id],
    );

    const operatorId =
      (req as any).user?.username ??
      (req as any).operator?.id ??
      'operator';

    await logActionExecution({
      pendingId: null,
      eventId: body.event_id,
      actionId: 'acknowledge-monitor',
      actionLabel: 'Acknowledged and monitoring',
      executedBy: operatorId,
      executionType: 'manual',
      outcome: 'success',
      output: 'Event acknowledged by operator',
      metadata: {},
    });

    res.json({ ok: true, message: 'Event acknowledged' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
```

---

## Step 2: Mount the Router

In `console.labyrinthscout.com/src/server.ts`, add:

```typescript
import { actionsRouter } from './api/actions.js';
// ... (in the route mounting section)
app.use('/api/actions', actionsRouter);
```

Place it near the other `/api/...` mounts. Check the ordering - if there is an auth middleware
that protects `/api/*` routes, `actionsRouter` must be mounted inside that protection.

---

## Step 3: Authorization

All routes in `actionsRouter` are operator-only. Before creating the router or at the router
level, apply whatever auth middleware the other protected routes use. Read `src/server.ts` and
`src/middleware/` to understand the existing auth pattern and replicate it.

Do NOT invent a new auth system. Use whatever is already there.

---

## Verification

```bash
# Start server
npm run build && node dist/server.js &

# Create a test pending action directly in the DB
psql $SCOUT_DATABASE_URL -c "
  INSERT INTO pending_actions (event_id, playbook_id)
  SELECT id, 'anomaly-critical-playbook'
  FROM security_events
  LIMIT 1;
"

# Check the list endpoint
curl -s http://localhost:4444/api/actions/pending | jq '.count'
# Should be 1

# Check count endpoint
curl -s http://localhost:4444/api/actions/pending/count | jq '.'

# Get the pending action id
PENDING_ID=$(psql $SCOUT_DATABASE_URL -t -A -c "SELECT id FROM pending_actions WHERE status='pending' LIMIT 1;")

# Execute an action (dry run first)
curl -s -X POST http://localhost:4444/api/actions/$PENDING_ID/execute \
  -H 'Content-Type: application/json' \
  -d '{"action_id":"acknowledge-monitor","dry_run":true}' | jq '.'
# Should return: { ok: true, message: "Dry run: would execute \"Acknowledge and continue monitoring\"" }

# Dismiss the action
curl -s -X POST http://localhost:4444/api/actions/$PENDING_ID/dismiss \
  -H 'Content-Type: application/json' \
  -d '{"notes":"Test dismissal"}' | jq '.'
# Should return: { ok: true, message: "Pending action dismissed" }

# Verify it's gone from pending list
curl -s http://localhost:4444/api/actions/pending | jq '.count'
# Should be 0

# Verify it appears in action_executions
psql $SCOUT_DATABASE_URL -c "SELECT action_id, executed_by, outcome FROM action_executions ORDER BY executed_at DESC LIMIT 2;"
```
