# Gap 11 - Prompt 02: Auto-Response Pipeline

**Gap:** 11 Find-Act Security Response
**Prompt number:** 02 of 06
**Name:** Auto-Response Pipeline
**Primary agent:** Claude Code
**Estimated hours:** 3-5 h
**Depends on:** Prompt 01 (action schema, playbook registry, store)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read First

Before writing a single line, read:

1. `console.labyrinthscout.com/src/actions/types.ts` - types from Prompt 01
2. `console.labyrinthscout.com/src/actions/playbook-registry.ts` - `findPlaybook()`, `PLAYBOOKS`
3. `console.labyrinthscout.com/src/actions/store.ts` - `createPendingAction()`, `logActionExecution()`
4. `console.labyrinthscout.com/src/alerts/dispatcher.ts` - how events flow after being saved
5. `console.labyrinthscout.com/src/alerts/types.ts` - `SecurityEvent`
6. `console.labyrinthscout.com/src/security/auto-remediation.ts` - existing `applyRemediation()`
7. `console.labyrinthscout.com/src/lib/instance-control.ts` - `suspendInstance()`, `publishControlMessage()`
8. `console.labyrinthscout.com/src/security/session-shield.ts` - `setShieldMode()`

All paths above are relative to `/opt/lampp/htdocs/verlox/carina/internal/servers/`.

---

## Context

This prompt creates the EventRouter: the component that receives every incoming `SecurityEvent`
immediately after it is saved to the database, classifies it using the playbook registry, and
takes the appropriate action.

For `category: 'auto'` playbooks: the router executes the action immediately and logs it.
For `category: 'human'` playbooks: the router creates a pending action record (for the human
to act on) and optionally performs any safe auto-actions defined for that playbook.
For `category: 'monitor'` playbooks: the router logs the event and does nothing else.

This is the connective tissue between event detection and action. Nothing waits for humans
unless the playbook says so.

---

## Step 1: Event Router

Create `console.labyrinthscout.com/src/actions/event-router.ts`:

```typescript
import { findPlaybook } from './playbook-registry.js';
import { createPendingAction, logActionExecution } from './store.js';
import { executeAutoAction } from './executor.js';
import type { SecurityEvent } from '../alerts/types.js';

export async function routeSecurityEvent(event: SecurityEvent): Promise<void> {
  const playbook = findPlaybook(event.event_type, event.severity);

  if (!playbook) {
    // No playbook matched. Log and do nothing.
    return;
  }

  if (playbook.category === 'monitor') {
    // No action. The event is already logged in security_events.
    return;
  }

  if (playbook.category === 'auto') {
    // Execute all actions in the playbook automatically.
    for (const action of playbook.actions) {
      const result = await executeAutoAction(action, event);
      await logActionExecution({
        pendingId: null,
        eventId: event.id,
        actionId: action.id,
        actionLabel: action.label,
        executedBy: 'system',
        executionType: 'auto',
        outcome: result.ok ? 'success' : 'failure',
        output: result.message,
        metadata: { playbookId: playbook.id },
      });
    }
    return;
  }

  if (playbook.category === 'human') {
    // Create a pending action record for the operator to act on.
    await createPendingAction(event.id, playbook.id);

    // If any actions in the playbook are marked as safe to auto-execute even for human playbooks,
    // run those immediately. Currently none are, but the architecture supports it.
    // This is where you would add: auto-restrict-session on breach, for example.
    const autoEarlyActions = playbook.actions.filter((a) => (a as any).autoEvenForHuman === true);
    for (const action of autoEarlyActions) {
      const result = await executeAutoAction(action, event);
      await logActionExecution({
        pendingId: null,
        eventId: event.id,
        actionId: action.id,
        actionLabel: action.label,
        executedBy: 'system',
        executionType: 'auto',
        outcome: result.ok ? 'success' : 'failure',
        output: result.message,
        metadata: { playbookId: playbook.id, earlyAuto: true },
      });
    }
  }
}
```

---

## Step 2: Action Executor

Create `console.labyrinthscout.com/src/actions/executor.ts`.

This is the low-level executor. It takes a `PlaybookAction` and a `SecurityEvent`, substitutes
the `{{placeholders}}` in `apiBody` with real values from the event, and calls the relevant
internal function directly (not via HTTP - internal function calls only).

```typescript
import type { PlaybookAction } from './types.js';
import type { SecurityEvent } from '../alerts/types.js';
import { suspendInstance } from '../lib/instance-control.js';
import { setShieldMode } from '../security/session-shield.js';
import { armGlobalKillSwitch } from '../killswitch/global-kill-switch.js';

export interface ExecutionResult {
  ok: boolean;
  message: string;
}

export async function executeAutoAction(
  action: PlaybookAction,
  event: SecurityEvent,
): Promise<ExecutionResult> {
  if (action.type !== 'button' || !action.apiEndpoint) {
    return { ok: false, message: 'Action type is not auto-executable' };
  }

  try {
    switch (action.id) {
      case 'terminate-session':
        // Use the existing session block mechanism
        // Import from wherever session termination is implemented
        // Return success/failure
        return await executeTerminateSession(event.session_id, event.instance_id);

      case 'restrict-session':
        return await executeRestrictSession(event.instance_id, 'restrict');

      case 'watch-session':
        return await executeRestrictSession(event.instance_id, 'elevated');

      case 'arm-killswitch':
        return await executeArmKillSwitch(event.instance_id);

      case 'run-session-audit':
        // Forensic snapshot is async and does not block. Just trigger it.
        return await executeTriggerAudit(event.session_id, event.instance_id);

      default:
        return { ok: false, message: `Unknown auto action: ${action.id}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Execution error: ${message}` };
  }
}

async function executeTerminateSession(
  sessionId: string,
  instanceId: string,
): Promise<ExecutionResult> {
  // Call the same function that /api/block-session uses.
  // Trace the import chain from src/api/block-session.ts to find the underlying function.
  // Do NOT make an HTTP call to localhost - call the function directly.
  try {
    // Implementation: find and call the underlying terminate function
    // from src/lib/instance-control.ts or wherever block-session delegates to.
    return { ok: true, message: `Session ${sessionId} terminated on instance ${instanceId}` };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

async function executeRestrictSession(
  instanceId: string,
  mode: 'elevated' | 'restrict' | 'lockdown',
): Promise<ExecutionResult> {
  try {
    await setShieldMode(instanceId, mode);
    return { ok: true, message: `Instance ${instanceId} moved to ${mode} mode` };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

async function executeArmKillSwitch(instanceId: string): Promise<ExecutionResult> {
  try {
    await armGlobalKillSwitch({ reason: `Auto-armed on breach event from ${instanceId}`, armed_by: 'system' });
    return { ok: true, message: 'Global kill switch armed' };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

async function executeTriggerAudit(
  sessionId: string,
  instanceId: string,
): Promise<ExecutionResult> {
  // Trigger forensic-snapshot.ts if it has an exported function, otherwise log intent.
  try {
    // Import from src/security/forensic-snapshot.ts if a trigger function exists.
    return { ok: true, message: `Forensic audit queued for session ${sessionId}` };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}
```

Implementation note: For each `case`, trace the actual import chain in the existing codebase.
Do not make localhost HTTP calls. Always call the underlying function directly. If a function
does not exist as a standalone export, refactor the relevant API handler to extract the core
logic into an exportable function.

---

## Step 3: Hook Into the Alert Dispatcher

Read `src/alerts/dispatcher.ts` in full. Find where events are saved to `security_events` and
alerts are dispatched. After the alert dispatch call (or after the DB insert if no alerts fire),
add a call to `routeSecurityEvent(event)`.

The call must be wrapped in a try/catch so a routing failure never breaks the alert dispatch.
If routing throws, log the error and continue. Routing is best-effort.

```typescript
// In dispatcher.ts, after saving the event and dispatching alerts:
try {
  await routeSecurityEvent(event);
} catch (err) {
  console.error('[event-router] Failed to route event:', err);
}
```

Do not block the alert dispatch on routing. If routing is slow, fire it with `void`:

```typescript
void routeSecurityEvent(event).catch((err) => {
  console.error('[event-router] Failed to route event:', err);
});
```

---

## Step 4: Breach Auto-Arm (Special Case)

For `breach_detected` events at severity `breach`, the kill switch should arm automatically
WITHOUT waiting for human approval. This is the one case where a human-category playbook
also has an immediate auto action.

Add a `breach_detected` auto-arm path in `event-router.ts`:

```typescript
// Special case: breach always auto-arms kill switch, then queues human review
if (event.event_type === 'breach_detected' && event.severity === 'breach') {
  const armResult = await executeAutoAction(
    {
      id: 'arm-killswitch',
      label: 'Arm global kill switch',
      type: 'button',
      description: 'Auto-armed on breach detection',
      destructive: true,
      reversible: true,
      requiresConfirmation: false,
      apiEndpoint: '/api/killswitch/arm',
      apiMethod: 'POST',
      apiBody: { reason: 'Auto-armed: breach_detected event' },
    },
    event,
  );
  await logActionExecution({
    pendingId: null,
    eventId: event.id,
    actionId: 'arm-killswitch',
    actionLabel: 'Arm global kill switch (auto)',
    executedBy: 'system',
    executionType: 'auto',
    outcome: armResult.ok ? 'success' : 'failure',
    output: armResult.message,
    metadata: { trigger: 'breach_auto_arm' },
  });
  // Then fall through to create the human pending action (for disarm decision, audit review, etc.)
}
```

---

## Verification

```typescript
// Quick unit test to verify routing logic (add to src/actions/__tests__/event-router.test.ts):

import { findPlaybook } from '../playbook-registry';

test('anomaly_detected critical routes to human playbook', () => {
  const p = findPlaybook('anomaly_detected', 'critical');
  expect(p?.category).toBe('human');
  expect(p?.id).toBe('anomaly-critical-playbook');
});

test('alert_test routes to monitor playbook', () => {
  const p = findPlaybook('alert_test', 'info');
  expect(p?.category).toBe('monitor');
});

test('breach_detected routes to human playbook', () => {
  const p = findPlaybook('breach_detected', 'breach');
  expect(p?.category).toBe('human');
});

test('unknown event type returns null', () => {
  const p = findPlaybook('made_up_event', 'info');
  expect(p).toBeNull();
});
```

Run with: `npx vitest run src/actions/__tests__/event-router.test.ts`
