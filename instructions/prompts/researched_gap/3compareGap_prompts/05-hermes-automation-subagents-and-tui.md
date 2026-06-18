# Prompt 05 - Hermes Automation, Subagents, and TUI

## Objective

Adopt the Hermes features that make the agent feel operational rather than conversational: terminal UI behavior, subagent delegation, scheduled automation, and action-oriented session control.

Reuse rule: keep the orchestration pattern, rewrite the presentation. No verbatim Hermes labels, banners, or control text.

---

## Read First

- `instructions/prompts/researched_gap/3-agents-to-adopt/hermes-agent/README.md`
- `core.carinaai.uk/src/tui/`
- `core.carinaai.uk/src/agents/`
- `core.carinaai.uk/src/cli/registry.ts`
- `core.carinaai.uk/src/agents/cron-scheduler.ts`
- `core.carinaai.uk/src/agents/subagent-*`

---

## What to Check

1. What the current TUI already gives the user and what is still missing from the Hermes-style terminal experience.
2. Whether delegation, parallel work, and subagent wake behavior are complete or only partially present.
3. Whether scheduled tasks and unattended execution are exposed in a way people can actually use.
4. Whether interrupt, redirect, retry, and history flows are discoverable and stable.

---

## Deliverable

Bring over the operational behavior that matters:

- better terminal control for serious users
- subagent flows that reduce context cost
- scheduled automation that is visible and manageable

---

## Acceptance Criteria

- A user can start work in terminal, delegate part of it, and see the result come back cleanly.
- Scheduled work can be created, inspected, and managed without digging through internals.
- TUI changes do not break the current CLI or workspace flows.
