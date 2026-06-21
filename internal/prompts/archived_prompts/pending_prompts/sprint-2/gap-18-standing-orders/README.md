# Gap 18 - Standing Orders & Persistent Directives

**Gap:** 18
**Sprint:** 2
**Source:** OpenClaw docs (https://docs.openclaw.ai/tools/automation#standing-orders)
**Goal:** Add standing orders -- persistent directives that survive session resets,
  channel switches, and daily cleanup. Unlike system prompts (which are per-model)
  or skills (which are procedural), standing orders are behavioral rules the agent
  must follow across all sessions until explicitly removed.

**Primary agent:** Claude Code
**Estimated hours:** 3-4 h total
**Risk:** Low. Additive feature. No existing code paths modified.

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Context

Carina has system prompts, skills, heartbeat guidance, and REM memory. But
none of these provide *persistent behavioral directives*:

- **System prompts** reset per session
- **Skills** are procedural, not directive
- **Memory** stores facts, not orders
- **Heartbeat** is scheduled check-in, not continuous enforcement

OpenClaw's standing orders fill this gap: they are injected into every agent
turn as a dedicated system prompt section, persist across sessions, and can
be managed by the user via natural language or slash commands.

---

## Build Order

```
01-standing-orders-core.md    Data model, storage, injection into system prompt
02-commands-and-ui.md         /standing-orders slash command + admin UI
```

Start with 01, then 02.

---

## Done When

- [ ] `/standing-orders add <directive>` saves a persistent directive
- [ ] `/standing-orders list` shows all active orders with IDs
- [ ] `/standing-orders remove <id>` deletes an order
- [ ] Standing orders injected into system prompt as "Standing Orders" section
- [ ] Orders survive /reset, /new, and daily session cleanup
- [ ] Orders are agent-scoped (per agent, not global)
