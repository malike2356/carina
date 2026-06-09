# Action: delegate-task Tool

## Status: DONE

Parallel subagent delegation is fully implemented.

## Implementation

| Component | Path |
|---|---|
| Tool | `src/tools/delegate-task.ts` |
| Sub-agent base | `src/agents/sub-agent.ts` |
| Generic sub-agent | `src/agents/generic-sub-agent.ts` |
| Depth + cancellation | `src/agents/delegation-context.ts` |
| Orchestrator (auto-split) | `src/agents/orchestrator.ts` |

## Behaviour

- **Single mode:** `delegate-task({ goal, context, toolsets, workdir })`
- **Batch mode:** `delegate-task({ tasks: [...] })` - up to 3 concurrent, queue beyond that
- **Isolation:** each subagent gets `:sub:` session ID, fresh context, no memory persistence
- **Leaf constraints:** no delegate-task, clarify, memory, email-send, code-exec, cronjob
- **Depth limit:** 1 (subagents cannot spawn subagents)
- **Cancellation:** parent turn end aborts in-flight subagents

## Skills using delegation

`core-engineering` pack: `delegate-coding-task`, `parallel-research`, `claude-code-cli`, `codex-cli`, `opencode-review`

## When to use

- Parallel independent tasks (research A + B)
- Coding/debugging that would flood parent context
- Multi-file exploration with large intermediate output

## When not to use

- Single tool call (call the tool directly)
- Tasks needing user input (use clarify in parent, not subagent)
- Long-running scheduled work (use cronjob)
