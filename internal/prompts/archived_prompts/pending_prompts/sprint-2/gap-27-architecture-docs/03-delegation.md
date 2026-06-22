**Status: COMPLETED 2026-06-21**


# Gap 27 - Prompt 03: Delegation & Sub-agents Doc

**Gap:** 27 Documentation: Agent Architecture
**Prompt number:** 03 of 03
**Name:** Write delegation.md -- sub-agents, ACP, and task delegation
**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 1.5 h
**Depends on:** Nothing (can run parallel)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `internal/servers/core.carinaai.uk/src/acp/` -- ACP server and types
2. `internal/servers/core.carinaai.uk/src/agents/subagent-*.ts` -- sub-agent code
3. `internal/servers/core.carinaai.uk/src/agents/delegate*.ts` -- delegation

---

## Goal

Write `docs/developer/architecture/delegation.md`.

```markdown
# Delegation & Sub-agents

## Overview
Carina can spawn sub-agents to work on tasks in isolated contexts.
Each sub-agent gets its own conversation, terminal session, and toolset.
Only the final summary returns to the parent agent.

## When to Use Sub-agents

| Use sub-agents for | Do not use sub-agents for |
|---|---|
| Reasoning-heavy subtasks (debugging, research) | Mechanical multi-step work |
| Tasks that would flood the parent context | Single tool calls |
| Parallel independent workstreams | Tasks needing user interaction |
| Code exploration across large codebases | Quick lookups |

## ACP: Agent Communication Protocol

Carina's sub-agents communicate via ACP -- a JSON-RPC 2.0 protocol over
WebSocket. Key methods:

| Method | Description |
|--------|-------------|
| `initialize` | Negotiate capabilities (streaming, tools, multi-session) |
| `session.create` | Create an isolated sub-agent session |
| `session.send` | Send a prompt to the sub-agent |
| `session.abort` | Cancel an in-progress sub-agent turn |
| `session.close` | End the sub-agent session |
| `tools.list` | List available tools for the sub-agent |

### Streaming
Sub-agent output streams back to the parent via SSE events:
- `session.output` -- text delta chunks during generation
- `session.complete` -- final result with exit status

### Capabilities
ACP advertises capabilities during initialisation:
- `streaming` -- supports delta-by-delta output
- `multiSession` -- can manage multiple concurrent sessions
- `tools` -- has tool execution capability
- `fileContext` -- can read/write workspace files
- `cancelation` -- supports session.abort

## Delegation Modes

| Mode | Max Spawn Depth | Use Case |
|------|----------------|----------|
| `leaf` | 1 (cannot delegate further) | Focused worker for a single task |
| `orchestrator` | 2 (can spawn its own workers) | Complex multi-step workflows |

## Sandboxing Sub-agents
Sub-agents run in the configured sandbox backend:
- **Docker**: isolated container per sub-agent session
- **SSH**: remote host execution
- **OpenShell**: lightweight process isolation
- **Host**: direct execution (default, least secure)

## Concurrency
Sub-agents run in parallel up to the configured limit
(`max_concurrent_children`, default 3). Exceeding the limit
queues additional tasks.

## Where to find it in source
- `acp/acp-server.ts` -- ACP WebSocket server
- `acp/acp-types.ts` -- protocol type definitions
- `agents/subagent-*.ts` -- sub-agent lifecycle
- `agents/delegate*.ts` -- delegation orchestration
- `infrastructure/node-host/ws-server.ts` -- node WebSocket server
```

---

## Sidebar update

Add `'developer/architecture/delegation'` under the "Architecture" category.

---

## Existing Carina files to reference

- `internal/servers/core.carinaai.uk/src/acp/`
- `internal/servers/core.carinaai.uk/src/agents/subagent-*.ts`
