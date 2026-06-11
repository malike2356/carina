# Carina - Project Prompt

Carina is a **general-purpose autonomous AI agent platform** built by VERLOX Ltd. The model is a horizontal core runtime with optional vertical skill packs installed on top. No domain pack is enabled by default; property-uk is one optional pack among several.

**Runtime:** Node.js 22 LTS + TypeScript 5
**Repo root:** `carina/` (mono-repo)
**Domain:** `carinaai.uk`
**Package:** `carina-agent` v0.1.0 live on npm (`npm install -g carina-agent`; https://www.npmjs.com/package/carina-agent)
**Package manager:** pnpm

## Verified metrics (2026-06-10)

| Metric | Value |
|---|---:|
| Vitest tests | 5,369 |
| LLM providers | 23 |
| Channel adapters | 18 |
| Tool surface | 71 |
| Skill packs | 16 |
| Curated pack skills | 96 |
| CLI commands | 49 |

Source: `pnpm test`, `provider-registry.ts`, `completion-metadata.ts`, `TOOLSET_MAP`.

## Architecture

```
carina/
├── core.carinaai.uk/     Core agent (npm package carina-agent)
├── ops.carinaai.uk/      VERLOX operator admin (built)
├── console.labyrinthscout.com/  Scout server (built)
├── carinaai.uk/          Marketing site (built)
├── docs.carinaai.uk/     Documentation site
└── mobile/               Expo companion app
```

## Core runtime status

| Layer | Status |
|---|---|
| CLI + 18 channel adapters + web UI | Shipped |
| LLMRouter (23 providers, hot-swap, local optional) | Shipped |
| Memory: postgres/sqlite/builtin/mem0 + REM + pgvector RAG | Shipped |
| 71 tools across toolsets | Shipped |
| CarinaOrchestrator + sub-agents | Shipped |
| Agent workspaces + routing | Shipped |
| Inferred commitments (opt-in) | Shipped |
| Ops layer (sandbox, DNS, proxy, backup, secrets, audit) | Shipped |
| Host service + device pairing + /control dashboard | Shipped |
| Scout integration + trust API | Shipped (on-chain when wallet configured) |
| Hosted mode + Stripe billing | Shipped |
| Skills Hub | Shipped |

## Activation still required

See `CONFIGURATION_READINESS.md`: public GitHub, attester wallet for on-chain ERC-8004/8126, install.carinaai.uk host.

## Key architecture decisions (do not change)

- Runtime: Node.js + TypeScript for the core agent.
- DeepSeek is default provider (cost). Fallback chain includes 22 other providers.
- Tool registry schemas are MCP-compatible.
- Memory: pluggable backends + workspace markdown + REM.
- Scout never blocks Carina when unreachable.
- Core agent license: MIT.

## Commands

```bash
cd core.carinaai.uk
pnpm cli           # run Carina in CLI mode
pnpm dev           # tsx watch
pnpm test          # Vitest (5,369 tests)
pnpm build         # compile to dist/
pnpm hub           # Skills Hub server
pnpm admin         # ops.carinaai.uk on :4000
```

## Marketing accuracy

Use `instructions/build-plan/COMPARISON.md` for Hermes/OpenClaw comparisons. Competitor figures are not audited in this repo. Do not understate Carina counts or overstate on-chain live status.
