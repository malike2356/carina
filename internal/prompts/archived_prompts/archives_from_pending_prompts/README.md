# Archived pending prompts

Completed, superseded, or non-coding prompts moved out of `pending_prompts/`.

Agents must not re-run prompts marked **COMPLETED** or **SUPERSEDED** here.
Check this tree before starting work in `pending_prompts/`.

## Layout

Paths mirror the former `pending_prompts/` tree:

```
archives_from_pending_prompts/sprint-2/gap-06-webui/01-hermes-pty-bridge.md
```

## What belongs here

| Category | Examples |
|----------|----------|
| COMPLETED implementation | `sprint-2/gap-04-desktop/`, `sprint-1/gap-10-incident-blog/` |
| SUPERSEDED / verified built | `sprint-2/_superseded/` |
| Planning only (no code) | `sprint-4/plan/`, `labyrinth_magister/` |
| Historical indexes | `_reference/BUILD-QUEUE.md`, `AUDIT-STATE-2026-06-20.md` |

## Active pending work

Only `pending_prompts/sprint-4/action/` remains for new implementation.

## Adding new archives

When you finish a coding prompt, follow `pending_prompts/POST-BUILD-CHECKLIST.md`.
Move the file here with the same relative path under `archives_from_pending_prompts/`.
