---
sidebar_position: 1
---

# Labyrinth Scout integration

Scout is the security control plane. Carina can report sanitized telemetry to Scout; Scout can kill sessions via Redis.

```bash
LABYRINTH_ENABLED=true
LABYRINTH_URL=<provisioned console URL or http://localhost:4444 self-hosted>
LABYRINTH_API_KEY=your_key
```

Hosted subscribers receive `LABYRINTH_URL` and the API key by email at provisioning. The console hostname is not linked from public marketing pages.

Key files:

| File | Role |
|---|---|
| `src/security/scout-client.ts` | Fire-and-forget event reporting |
| `src/security/kill-switch-listener.ts` | Redis kill channel |
| `src/security/prompt-guard-middleware.ts` | Input/output scanning |
| `src/security/jit-credentials.ts` | Just-in-time tool grants |

Legacy hosted Carina workspaces can still pair to Scout during the hosted flow. See [Scout docs](https://labyrinthscout.com/docs) for API, dashboard, and trust integration.
