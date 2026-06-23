# Active implementation prompts

**Updated:** 2026-06-23

`pending_prompts/` holds prompts that still need code. Everything else is under
`archived_prompts/archives_from_pending_prompts/`.

## Active work

| Path | What it builds |
|------|----------------|
| `sprint-4/action/` | Aiva platform (28 prompts): deploy, worker brain, channels, billing, admin dashboard |

Start at `sprint-4/action/README.md` for phase order and agent assignments.

## Agent workflow

1. **Before you start:** Check `archived_prompts/archives_from_pending_prompts/` for a COMPLETED or SUPERSEDED copy.
2. **While building:** Follow `REUSE-RULES.md` for Carina voice and naming.
3. **When finished:** Follow `POST-BUILD-CHECKLIST.md`, then commit.

## Archive layout

```
archived_prompts/archives_from_pending_prompts/
├── sprint-1/          gap-10 incident blog (COMPLETED)
├── sprint-2/          gaps 01-33, troubleshooting, _superseded
├── sprint-3/          white-label + support-agent packs
├── sprint-4/plan/     Aiva planning docs (no code)
├── labyrinth_magister/  academy planning (no code)
└── _reference/        BUILD-QUEUE, audit snapshots, pre-work alignment
```

## Agent reference

| Agent | Best for |
|-------|----------|
| **Cursor** | React/TSX, admin UI, rich components |
| **Claude Code** | TypeScript systems, backend wiring, architecture |
| **Codex** | Boilerplate, config, shell scripts, adapters |
