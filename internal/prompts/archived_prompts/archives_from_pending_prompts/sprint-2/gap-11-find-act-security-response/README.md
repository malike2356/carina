# Gap 11: Find-Act Security Response

**Date:** 2026-06-21
**Status:** PROMPTS WRITTEN - Ready for implementation
**Total Prompts:** 6
**Estimated Days:** 4-5 with 1 agent (Claude Code)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## The Problem

Labyrinth already finds threats. It does not consistently act on them.

When Labyrinth detects `anomaly_detected`, it sends a Telegram message and logs the event. An
operator reads the message, opens the dashboard, stares at a row in a table, and then has to
figure out what to do next. Nothing in the product tells them what the event means in plain terms,
what options they have, or how to execute a fix. They either do nothing or improvise.

This is the gap this sprint closes.

---

## The Find-Act Pattern

Every security event falls into one of three categories:

**Category A - Auto-resolved:** The system acts immediately without human involvement. Safe,
reversible, low-risk fixes for unambiguous events. Logged and surfaced in the dashboard, but
no human decision required.

**Category B - Human-action required:** The event is ambiguous, high-risk, or irreversible. The
system presents the operator with: (1) a plain-English explanation of what happened and why it
matters, and (2) concrete options to resolve it - a button that fires the fix, a script to run,
or a numbered list of manual steps. The operator clicks; the system executes and audits.

**Category C - Monitor-only:** Low-severity informational events. No action taken. Logged.
Surface in dashboard in a lower-priority list.

---

## Architecture Overview

```
SecurityEvent (existing)
        |
        v
  EventRouter (new, Prompt 02)
   |          |           |
   v          v           v
Auto-Act   Human-Act   Monitor
(fires      (queues     (log only)
 immediately) pending
             action)
                |
                v
          PendingAction table (new, Prompt 01)
                |
                v
         Dashboard modal (new, Prompt 03)
         Telegram guidance (new, Prompt 05)
                |
                v
       Operator clicks Resolve
                |
                v
         Resolve API (new, Prompt 04)
                |
                v
         ActionExecution table (new, Prompt 01)
                |
                v
         Audit view in dashboard (new, Prompt 06)
```

---

## What Already Exists (Do Not Duplicate)

- `src/security/auto-remediation.ts` - `RemediationCase`, `applyRemediation()`, `rollbackRemediation()`
  - Handles: `suspicious_egress`, `repeated_injection`, `unknown_plugin`, `risky_burst`, `stale_marker`
  - These are technical cases fired by the anomaly detector, NOT connected to `SecurityEvent` types
- `src/api/auto-remediation.ts` - HTTP wrapper for the above
- `src/api/kill.ts` - suspend an instance
- `src/api/block-session.ts` - block a session
- `src/api/quarantine.ts` - quarantine a session
- `src/killswitch/global-kill-switch.ts` - arm/disarm kill switch
- `src/security/session-shield.ts` - shield modes (normal, elevated, restrict, lockdown)
- `src/alerts/` - alert dispatch (Telegram, email, Discord, etc.)
- `src/alerts/types.ts` - `SecurityEvent`, `AlertSeverity`

The new code wires these existing primitives to a unified event-action system. It does not
reimplement them.

---

## Prompt Order and Dependencies

```
Prompt 01: Event-Action Schema and Registry
    - DB tables: pending_actions, action_executions, action_playbooks
    - TypeScript types and store functions
    - No dependencies

Prompt 02: Auto-Response Pipeline
    - EventRouter: classify incoming SecurityEvent, fire auto-actions, queue human-actions
    - Hooks into the alert dispatcher after event is saved
    - Depends on Prompt 01

Prompt 03: Human-Action Modal UI (dashboard)
    - New dashboard widget: pending actions list
    - Modal: plain-English summary + action buttons + guided steps
    - Depends on Prompt 01 (tables) and Prompt 04 (API endpoints)

Prompt 04: Resolve API Endpoints
    - POST /api/actions/:actionId/execute
    - POST /api/actions/:actionId/dismiss
    - GET  /api/actions/pending
    - Depends on Prompt 01

Prompt 05: Telegram Action Guidance
    - Extend TelegramAdapter.formatMessage() to include action hints
    - For human-action events: link directly to dashboard pending-action view
    - Depends on Prompt 01 (action classification logic)

Prompt 06: Action Audit Trail and Dashboard View
    - Dashboard widget showing all action_executions with outcome and who acted
    - Filterable by event type, action type, operator, date range
    - Depends on Prompts 01, 03, 04
```

---

## Acceptance Criteria (for the whole gap)

When an `anomaly_detected` event with severity `critical` arrives:

1. The system logs it to `security_events` (already works).
2. The EventRouter classifies it as Category B (human-action).
3. A row is inserted into `pending_actions` with the relevant playbook.
4. The Telegram message includes: plain-English summary + "Open dashboard to resolve" link.
5. The dashboard shows a highlighted pending action card with a count badge.
6. Clicking the card opens a modal with:
   - What happened (plain English, no JSON, no UUIDs)
   - What is at risk
   - Available actions as buttons (e.g., "Terminate session", "Block user", "Increase monitoring")
   - A "Show steps" toggle for each action that reveals the manual equivalent
7. Clicking an action button calls the Resolve API, which executes the action and logs it.
8. The pending action is marked resolved. The card disappears from the pending list.
9. The action appears in the audit trail widget with: who acted, what action, what event, when, outcome.
10. A `breach_detected` event with severity `breach` triggers auto-arm of the kill switch AND
    queues a human-action for review, without waiting for operator input on the auto part.
