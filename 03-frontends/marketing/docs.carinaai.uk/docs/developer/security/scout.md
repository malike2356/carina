---
sidebar_position: 1
---

# Labyrinth Scout integration (dormant)

Scout was designed as a security control plane Carina could report sanitized telemetry to, with
Scout able to kill sessions via Redis. Scout is no longer deployed or offered as a product (it's
now a personal research project) - this integration code is left in place but unused. There is
no console to provision or pair to; do not set `LABYRINTH_ENABLED=true` expecting it to connect
to anything.

Key files (dormant, not wired to anything live):

| File | Role |
|---|---|
| `src/security/scout-client.ts` | Fire-and-forget event reporting |
| `src/security/kill-switch-listener.ts` | Redis kill channel |
| `src/security/prompt-guard-middleware.ts` | Input/output scanning |
| `src/security/jit-credentials.ts` | Just-in-time tool grants |

