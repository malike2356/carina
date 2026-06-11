---
sidebar_position: 1
---

# Architecture overview

Carina follows a gateway + agent + tools architecture similar in spirit to Hermes/OpenClaw, with multi-tenant SaaS and Scout security as differentiators.

```mermaid
flowchart LR
  subgraph channels [Gateways - 18 adapters]
    CLI[CLI]
    Web[Web UI]
    TG[Telegram]
    DC[Discord]
    More[Slack WhatsApp SMS ...]
  end
  subgraph core [Core]
    Router[Gateway router]
    Orch[Orchestrator]
    Agent[CarinaAgent.turn]
    LLM[LLM providers]
    Mem[Memory backends]
  end
  subgraph exec [Execution]
    Tools[Tool registry]
    Skills[Skill packs]
    Scout[Scout client]
  end
  channels --> Router --> Orch --> Agent
  Agent --> LLM
  Agent --> Tools
  Agent --> Mem
  Tools --> Scout
```

## Main modules (`core.carinaai.uk/src/`)

| Module | Role |
|---|---|
| `agents/` | `CarinaAgent`, orchestrator, sub-agents, cron |
| `brain/` | LLM providers, credential pools, prompt cache |
| `gateway/` | Channel adapters, web UI, router |
| `tools/` | Tool registry and implementations |
| `memory/` | Episodic store, RAG, pluggable backends |
| `skills/` | Packs, curator, auto-writer |
| `security/` | Prompt guard, Scout reporting, JIT credentials |
| `cli/` | 49 CLI commands |
| `commitments/` | Inferred follow-up memories (opt-in) |
| `workspaces/` | Named agent workspaces and channel routing |
| `ops/` | Sandbox, DNS, proxy, backup, secrets reload, audit |
| `infrastructure/` | Host service, device pairing, control auth |

## Request flow

1. Inbound message arrives on a channel adapter
2. `GatewayRouter` maps to a session and `CarinaOrchestrator`
3. Context is built: memory search, RAG, skills, system prompt
4. LLM may return tool calls; `tool-runner` executes with Scout policy
5. Response is formatted per platform and sent outbound

## Deployment modes

- **CLI / self-hosted**: `~/.carina/` config, local Postgres + Redis
- **Carina Cloud**: multi-tenant Postgres schemas, Stripe billing, hosted web app
- **Docker**: `docker-compose.yml` for Postgres, Redis, and the agent container
