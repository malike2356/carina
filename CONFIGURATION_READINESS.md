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
| ERC-8004 / ERC-8126 code paths | Implemented | Registration, attestation, WAV/WV scoring, validation registry integration code exists. |
| Public trust dashboard | Implemented | Live public read-only posture at `carinaai.uk/trust`. |
| npm package readiness | Implemented | `carina-agent` package metadata, public publish config, build, tests, and `npm pack --dry-run` pass. |
| Scout readiness diagnostics | Implemented | `pnpm doctor` separates implemented code paths from missing channel/wallet configuration. |

## Configuration or activation required

| Area | Required action | Owner input needed |
|---|---|---|
| npm distribution | Run `npm publish --access public` from `core.carinaai.uk` after final account review. | npm account/token with publish rights. |
| Public source release | Make the intended GitHub repository public after reviewing secrets and private operational files. | GitHub visibility decision. |
| ERC-8004 identity | Set `TRUST_ATTESTER_PRIVATE_KEY`, confirm chain/RPC, then run the registration command. | Attester wallet and gas funding. |
| ERC-8126 on-chain verification | Enable verification env vars and run scheduled/manual verification after identity registration. | Attester wallet, registry choice, enterprise policy. |
| Alert delivery | Add channel credentials for Slack, Discord, Telegram, Twilio/WhatsApp, email, and SMS as needed, then run `pnpm doctor`. | API keys/webhooks/sender approvals. |
| Traffic | Route production agents through Scout so metrics reflect real activity. | Agent onboarding and licence assignment. |
| Public install host | Configure `install.carinaai.uk` before advertising the curl installer. | DNS/vhost and installer hosting. |

## Current marketing rule

Public copy should describe implemented-but-unconfigured capabilities as "when configured", "ready", or "publish pending". Do not describe npm install, public GitHub, on-chain attestations, or alert delivery as live until the matching configuration row above is complete.
