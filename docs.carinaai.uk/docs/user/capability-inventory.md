---
sidebar_position: 2
slug: /capabilities
title: Capability inventory
description: Canonical inventory of Carina tools, providers, channels, skill packs, security, trust, ops, and hosted surfaces.
---

# Capability inventory

This is the **single authoritative page** for what Carina ships, what is optional, and what depends on configuration. Other docs link here instead of repeating full inventories.

**Runtime help:** gateway `/help` and CLI `carina help` point here.  
**Operator mirror:** `core.carinaai.uk/docs/capabilities.md` (same counts; links back to this URL).

## How to read status labels

| Label | Meaning |
|---|---|
| **Shipped** | Code is in the npm package when prerequisites are met |
| **Configured** | In the catalog but inactive until keys, env vars, or services are set |
| **Optional** | Off by default; enable explicitly in config or env |
| **Hosted only** | Requires `HOSTED_MODE=true` and operator SaaS setup |
| **Scout** | Requires Labyrinth Scout (`LABYRINTH_ENABLED=true`) for live security telemetry |
| **Unsupported** | Listed for compatibility; not wired for chat routing today |

Counts below were verified against the agent runtime on **12 June 2026** and move as the codebase evolves.

## Current snapshot

| Metric | Count | Status |
|---|---:|---|
| Vitest tests | 7,500+ | Shipped |
| LLM providers (catalog) | 51 | Configured |
| LLM providers (chat-routable) | ~39 | Configured subset |
| Channel adapters | 19 | Configured |
| Registered tools (base registry) | 66+ | Shipped; grows with toolsets and session tools |
| Skill packs | 16 | Optional |
| Curated pack skills | 96 | Optional |
| CLI commands | 49+ | Shipped |

If a provider, channel, or tool is not configured, Carina marks it **unavailable** rather than pretending it is live.

## Core runtime (shipped)

- Autonomous agent loop with tool execution
- Episodic memory with semantic search when PostgreSQL + pgvector is configured
- Mid-session provider switching with `/provider` or `/model`
- Self-writing skills when `SKILL_AUTO_WRITE` or skill workshop mode is enabled
- CLI, web UI, and gateway surfaces
- Offline queue and session persistence on gateways
- Cost and usage reporting via `/usage --month` (CLI/gateway)

## Optional platform surfaces (env-gated)

| Surface | Enable with | Notes |
|---|---|---|
| TaskFlows | `CARINA_TASKFLOWS_ENABLED=true` | Webhook/cron/tool chaining; background worker opt-in |
| ACP bridge | `CARINA_ACP_ENABLED=true` | IDE and external agent protocol bridge |
| Debug proxy | `CARINA_DEBUG_PROXY_ROUTING=true` | Provider traffic capture; operator tooling |
| Extension bundles | `CARINA_EXTENSIONS_ENABLED=true` | Installable plugins with version compatibility checks |
| Skill workshop | `CARINA_SKILL_WORKSHOP=true` | Draft and publish skills from operator CLI |
| Memory injection depth | `CARINA_MEMORY_INJECTION` | `off`, `minimal`, or `full`; controls episodic recall per turn |

See [Configuration](/docs/user/configuration) for env reference. Detail pages below; do not treat this table as a second inventory.

## Tools (shipped; toolset-dependent)

Carina registers **66+ tools** in the base registry. Toolsets in `~/.carina/toolsets.yaml` enable subsets per platform (web, CLI, Telegram, etc.).

**Core categories:** web search, files, shell, HTTP, email, code execution, browser, MCP, kanban, cron, delegation, and pack-specific tools.

Full tool tables and confirmation rules: [Tools overview](/docs/user/tools/overview) (implementation detail only; counts live on this page).

## Providers (configured)

**23 live providers** appear in the public package registry (`carina providers list`). Chat routing uses the subset with valid keys or local backends.

Configured integrations: DeepSeek, Groq, Gemini, Anthropic, OpenAI, OpenRouter, Together AI, Mistral, Cohere, Perplexity, Fireworks, xAI, Moonshot, Qwen, Zhipu GLM, Azure OpenAI, Cerebras, DeepInfra, Novita, SiliconFlow, Ollama, LM Studio, and NVIDIA NIM.

Free Copilot preset (`CARINA_LLM_PRESET=free-copilot`) prefers local and tagged-free routes when configured.

Setup: [Configuration](/docs/user/configuration) and `carina providers info <name>`.

## Channels and gateways (configured)

**19 channel adapters** exist in code. Each requires tokens, webhooks, or env flags before it is live.

| Channel | Doc |
|---|---|
| CLI | [CLI gateway](/docs/user/gateways/cli) |
| Web UI | [Web gateway](/docs/user/gateways/web) |
| Telegram | [Telegram](/docs/user/gateways/telegram) |
| WhatsApp | [WhatsApp](/docs/user/gateways/whatsapp) |
| Slack | [Slack](/docs/user/gateways/slack) |
| Discord | [Discord](/docs/user/gateways/discord) |
| Signal | [Signal](/docs/user/gateways/signal) |
| iMessage / BlueBubbles | [iMessage](/docs/user/gateways/imessage) |
| Matrix | [Matrix](/docs/user/gateways/matrix) |
| Mattermost | [Mattermost](/docs/user/gateways/mattermost) |
| IRC | [IRC](/docs/user/gateways/irc) (stub; requires sidecar) |
| SMS, Email, API, webhooks, and others | Enable via env; see [Configuration](/docs/user/configuration) |

Check status: `carina channels status`.

## Skill packs (optional)

**16 domain packs** ship in the repo. Carina is general-purpose with **no pack loaded by default**.

Enable via web `/packs`, `carina packs install <name>`, or `ACTIVE_SKILL_PACKS` in `.env`.

Pack catalogue and per-pack tables: [Skill packs overview](/docs/user/skill-packs/overview).

## Security and trust (optional / Scout)

When Labyrinth Scout is enabled and connected:

- Prompt injection detection and tool output scanning
- Tool policy enforcement and egress filtering
- Honeypots, kill switch, and forensic snapshots (Scout-side)
- Public trust API and dashboard at [carinaai.uk/trust](https://carinaai.uk/trust)

On-chain attestations (ERC-8004 / ERC-8126) are **configured separately** in Scout. The trust dashboard shows live Scout telemetry separately from on-chain status (live only when wallet and attestation config are active).

Guides: [Defence in depth](/docs/user/security/defence-in-depth), [Labyrinth Scout](/docs/user/security/labyrinth-scout).

## Hosted SaaS (hosted only)

When the operator runs Carina Cloud (`HOSTED_MODE=true`):

- Multi-tenant accounts with JWT and API keys
- Per-tenant Postgres schema isolation
- BYOK provider keys (encrypted at rest)
- Stripe checkout and webhooks for paid tiers
- Free tier daily message cap (`config.hosted.freeDailyMessages`, default **100/day**)

Token usage metering exists in the billing module; hosted chat enforces the **daily message quota** on the free tier today.

Guide: [Carina Cloud](/docs/user/carina-cloud).

## Billing and Scout commercial tiers

| Product | What it is |
|---|---|
| Carina Core | MIT agent; self-host free |
| Carina Cloud | Hosted workspace; Stripe billing |
| Scout Monitor / Pro | Commercial security tiers (separate from Core) |
| Enterprise | SOC2 **readiness export** (operator-provided); not a third-party SOC2 Type II certification |

Commercial packaging: [Commercial boundaries](/docs/user/open-source-pricing), [carinaai.uk/pricing](https://carinaai.uk/pricing), and [labyrinthscout.com#pricing](https://labyrinthscout.com#pricing).

## Operations and migration (shipped)

- `carina doctor` health checks and optional repairs
- Backup and restore (`carina backup`, ops parity)
- Migration from Claude and Carina bundles (`carina migrate`)
- Secrets review and hosted bootstrap flows

Operator tooling stays out of the chat hot path; enable explicitly when needed.

## Mobile companion (optional)

The Expo app (`carinaMobile/`) supports chat, trust, and tasks on Carina Cloud and self-hosted gateways. Memory, packs, and billing surfaces require **Carina Cloud sign-in**. Voice, remote push, and the Android widget require **EAS device builds** (not Expo Go).

## Install and release

```bash
npm install -g carina-agent
carina setup
carina doctor
```

Package: [`carina-agent@0.1.1`](https://www.npmjs.com/package/carina-agent) (Node.js 22+).  
Getting started: [Getting started](/docs/user/getting-started) | Self-host: [Self-hosting](/docs/user/self-hosting).

## Detailed guides (not duplicate inventories)

Use these for how-to detail. Return here for **what exists** and **what status it has**.

- [Tools overview](/docs/user/tools/overview)
- [Toolsets](/docs/user/toolsets)
- [Skill packs](/docs/user/skill-packs/overview)
- [Gateways](/docs/user/gateways/cli)
- [CLI gateway](/docs/user/gateways/cli)
- [Carina Cloud](/docs/user/carina-cloud)
- [Developer overview](/docs/developer/intro)
