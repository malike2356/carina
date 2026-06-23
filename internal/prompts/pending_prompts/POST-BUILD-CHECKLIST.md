# Post-build checklist (MANDATORY for every implementation agent)

When you finish a prompt in `pending_prompts/`, you must archive it so no other agent re-implements the same work.

## When to run this

Run these steps only after:

- Every item in the prompt's "Done When" section is satisfied
- You have run the validation commands listed in the prompt (tests, typecheck, manual checks)
- The implementation is committed or ready to commit

Do not archive partial work. Do not skip this because "the code is done"; the prompt file itself must leave `pending_prompts/`.

## Steps

### 1. Mark COMPLETED

At the top of the prompt file (line 3, directly under the `#` title), add or update:

```markdown
**Status: COMPLETED YYYY-MM-DD**
```

Replace `YYYY-MM-DD` with today's date.

Add a short "**What was built:**" bullet list naming the key files, routes, or features you shipped.

If this was the last open prompt in the gap folder, apply the same status line to that gap's `README.md`.

### 2. Move to archived_prompts

Move the completed prompt file from:

`carina/internal/prompts/pending_prompts/`

to:

`carina/internal/prompts/archived_prompts/archives_from_pending_prompts/`

Keep the same relative path. Example:

| From | To |
|------|-----|
| `pending_prompts/sprint-4/action/01-deploy-scripts.md` | `archived_prompts/archives_from_pending_prompts/sprint-4/action/01-deploy-scripts.md` |

When every prompt in a gap folder is COMPLETED, move the entire gap directory (including its `README.md`) to `archived_prompts/archives_from_pending_prompts/` and remove the empty folder from `pending_prompts/`.

Use `git mv` when the repo is under git so history is preserved.

### 3. Update indexes

If the gap `README.md` or `sprint-4/action/README.md` lists this prompt as pending, update that line to point at the archived path or mark it COMPLETED.

### 4. Do not re-open archived work

Before starting any prompt, check:

- `archived_prompts/archives_from_pending_prompts/` for a COMPLETED copy
- `ADDENDUM-BUILD-STATUS.md` files in the gap folder
- `AUDIT-STATE-2026-06-20.md` for codebase vs plan drift

If the work is already COMPLETED or FULLY BUILT, do not implement it again. Move on to the next pending prompt.

## Status vocabulary

| Label | Meaning |
|-------|---------|
| `COMPLETED YYYY-MM-DD` | This prompt is done; file should live under `archived_prompts/` |
| `FULLY BUILT` | Entire gap or section is done (used in README and addendum files) |
| `SUPERSEDED` | Replaced by another prompt; archive and do not run |
| *(no status line)* | Active pending work; safe to implement |

## Quick reference (copy into prompt headers)

Every active implementation prompt includes a "## Post-build (MANDATORY)" section pointing here. Follow it when you finish.
