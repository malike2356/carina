# Shared auth session management

| File | Role |
| --- | --- |
| `session-manager.ts` | create / validate / list / touch |
| `concurrent-limiter.ts` | max concurrent sessions |
| `revocation.ts` | instant revoke + audit log |
| `session-ui.tsx` | "Where you're logged in" panel |
| `types.ts` | financial / business / content tiers |

Default store is in-memory for tests; products may swap Redis-backed adapters with the same `SessionStore` interface.
