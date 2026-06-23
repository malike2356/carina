# Prompt 08 - Odysseus Email, Notes, Calendar, and Taskflows

## Objective

Adopt the Odysseus productivity surface around email, notes, calendar, reminders, and scheduled action flows. This should close the last real workspace gaps, not add duplicate tools.

Reuse rule: adopt the workflow, then rewrite the surface copy. No Odysseus phrasing should ship unchanged.

---

## Read First

- `instructions/prompts/researched_gap/3-agents-to-adopt/odysseus/README.md`
- `core.carinaai.uk/src/gateway/email-api.ts`
- `core.carinaai.uk/src/gateway/notes-api.ts`
- `core.carinaai.uk/src/agents/cron-*`
- `core.carinaai.uk/docs/tools/email.md`
- `core.carinaai.uk/docs/configuration.md`

---

## What to Check

1. Whether email is triaged and actionable in the UI, not just available as a tool.
2. Whether notes are first-class enough for recurring work.
3. Whether calendar or CalDAV support is present and discoverable.
4. Whether taskflows and scheduled actions feel like a workspace feature, not a hidden backend feature.

---

## Deliverable

Implement the missing user-facing surfaces for daily work:

- a usable email flow
- notes and tasks that are easy to revisit
- calendar or reminder support if absent
- scheduled task handling that normal users can understand

---

## Acceptance Criteria

- Users can see and act on their email, notes, and scheduled work from the workspace.
- Calendar support is either present and surfaced, or explicitly documented as out of scope.
- No separate notes or task system is added if Carina already has one.
