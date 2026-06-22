# Sessions

A session is the unit of conversation state: message history, model choice, mode flags, and memory scope.

## Session keys

Gateway adapters derive a stable session key from channel-specific identifiers:

| Channel | Typical key part |
|---|---|
| Web / Cloud | Session uuid in URL or cookie |
| Telegram | `telegram:<userId>` |
| CLI / TUI | Explicit session id or default |

Linked identities (same human on Telegram + web) can share context when [identity links](/docs/developer/gateway/channels) are configured.

## Persistence

| Backend | Use case |
|---|---|
| In-memory | Dev-only; lost on restart |
| Postgres / cloud DB | Production web and hosted workspaces |
| File / sqlite | Lightweight self-host |

Session metadata includes title, last activity, pinned/archived flags (cloud app).

## Lifecycle

1. **Create** - First message or explicit `POST /api/sessions`
2. **Resume** - Router loads history into the agent context window
3. **Archive / delete** - User or retention policy; audit in cloud deployments

## Source references

- `agents/session-manager.ts` (and gateway session stores)
- `gateway/router.ts`
- `memory/session-index.ts` for searchable history

## Related

- [Agent loop](/docs/developer/architecture/agent-loop)
- [Memory](/docs/developer/architecture/memory)
