# Kanban Board

Operator Kanban for multi-step agent work with orchestrator and worker roles.

## Roles

| Role | Capabilities |
|------|----------------|
| **Orchestrator** | Create cards, edit work prompts and notes, run agent work, move/close cards, block |
| **Worker** | Claim cards, release, move in_progress to review, add comments |

## Columns

`backlog` -> `in_progress` -> `review` -> `done`, plus `blocked` for impediments.

## Surfaces

- **Web UI**: `/kanban` (Workspace nav)
- **HTTP API**: `/api/kanban/*` (operator auth)
- **CLI**: `carina kanban status|board|queue|add|claim|release|complete`
- **Tools**: `kanban` (combined), `kanban-show`, `kanban-create`, etc.

## API quick reference

- `GET /api/kanban/board?profile=default&board_id=default`
- `POST /api/kanban/cards` - create (orchestrator)
- `PATCH /api/kanban/cards/:id` - update notes/prompt
- `POST /api/kanban/cards/:id/move` - `{ column, version }`
- `POST /api/kanban/cards/:id/claim` / `release`
- `POST /api/kanban/cards/:id/close` - orchestrator only
- `POST /api/kanban/cards/:id/run` - spawn subagent for card work
- `POST /api/kanban/cards/:id/comments`

Pass `version` on mutating calls for optimistic concurrency; mismatches return HTTP 409.

## Driving agent work

1. Orchestrator creates a card with `work_prompt`
2. `run` action (tool or API) spawns a subagent; result lands in `review`
3. Orchestrator reviews and `close` to `done`

Webhooks emit `kanban.move` on lifecycle changes.
