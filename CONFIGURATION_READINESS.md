# Carina and Labyrinth Scout readiness

This document separates code implementation from configuration, distribution, and activation work.

## Implemented in code

| Area | Status | Notes |
|---|---|---|
| Carina core gateway | Implemented | Express gateway, CLI, hosted mode, packs, memory, dashboard routes. |
| Labyrinth Scout monitoring | Implemented | Heartbeats, event ingestion, dashboard APIs, SSE, public trust API. |
| Prompt injection defence | Implemented | Prompt guard, tool-output scanning, honeypots, anomaly detection, egress and tool policy paths. |
| Kill switch | Implemented | Instance status, suspend/resume control, polling hooks. |
| Alert channel adapters | Implemented | Telegram, WhatsApp/Twilio, Discord, Slack, email, SMS dispatch code exists. |
| Agent integration paths | Implemented | Carina native integration plus proxy/API/adapter paths for other agents. |
| ERC-8004 / ERC-8126 code paths | Implemented | Registration, attestation, WAV/WV scoring, validation registry integration. |
| Public trust dashboard | **Live** | [carinaai.uk/trust](https://carinaai.uk/trust) polls `GET /api/public/trust`. |
| ERC-8004 identity (reference agent) | **Live** | Base Sepolia; agent `6981`, slug `carina-reference` (verified 2026-06-11). |
| ERC-8126 verification | **Live** | Base Sepolia; WAV/WV unified risk score + on-chain request/response txs in public API. |
| npm distribution | Live | [`carina-agent@0.1.0`](https://www.npmjs.com/package/carina-agent) on npm (`npm install -g carina-agent`). Publisher: `verlox`. |
| Scout readiness diagnostics | Implemented | `pnpm doctor` separates implemented code paths from missing channel/wallet configuration. |

## Configuration or activation required

| Area | Required action | Owner input needed |
|---|---|---|
| Public source release | Live | [github.com/malike2356/carina-agent](https://github.com/malike2356/carina-agent) (core only, fresh history). Private monorepo `carina-ai` stays private. Re-sync via `bash scripts/export-carina-core-public.sh`. |
| ERC-8004 identity | Set `TRUST_ATTESTER_PRIVATE_KEY`, confirm chain/RPC, then run the registration command. | Attester wallet and gas funding. |
| ERC-8126 on-chain verification | Enable verification env vars and run scheduled/manual verification after identity registration. | Attester wallet, registry choice, enterprise policy. |
| Alert delivery | Add channel credentials for Slack, Discord, Telegram, Twilio/WhatsApp, email, and SMS as needed, then run `pnpm doctor`. | API keys/webhooks/sender approvals. |
| Traffic | Route production agents through Scout so metrics reflect real activity. | Agent onboarding and licence assignment. |
| Public install host | Configure `install.carinaai.uk` before advertising the curl installer. | DNS/vhost and installer hosting. |

## Verified Carina metrics (2026-06-11)

| Metric | Value | Source |
|---|---:|---|
| Vitest tests | 5,369 | `cd core.carinaai.uk && pnpm test` |
| LLM providers | 23 | `src/brain/provider-registry.ts` |
| Channel adapters | 18 | `src/cli/completion-metadata.ts` |
| Tool surface | 71 | `src/tools/toolset.ts` `TOOLSET_MAP` |
| Skill packs | 16 | `src/skills/packs/` |
| Curated pack skills | 96 | pack `skills.ts` files |
| CLI commands | 49 | `buildCommandList()` |

Full comparison rules: `instructions/build-plan/COMPARISON.md`.

## Current marketing rule

Public copy should use the verified metrics table and standard install path `npm install -g carina-agent` (live on [npm](https://www.npmjs.com/package/carina-agent), v0.1.0). Link to the npm package page from install CTAs where practical. State **Node.js 22+** requirement. ERC-8004 identity and ERC-8126 verification are **live on Base Sepolia** today; link [carinaai.uk/trust](https://carinaai.uk/trust). Reserve **Base mainnet** claims until mainnet registration ships. Alert delivery may still say "when configured" until channel credentials are set. Do not understate Carina counts (for example 5 providers or 6 gateways).

**Scout console URL:** Do not link the hosted console hostname (`console.labyrinthscout.com`) from public marketing pages or prospect-facing docs. Customers receive the private URL and API key by email when provisioned after checkout. Public read-only trust metrics live at `carinaai.uk/trust`.
