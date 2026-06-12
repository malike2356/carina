# Threat Model

Carina + Scout. Last reviewed: June 2026.

This document maps known attack surfaces, current controls, and residual gaps for deployments using Carina with Labyrinth Scout. Update it when controls change or new surfaces are added.

## Attack Surface Table

| Attack | Surface | Impact | Current mitigation | Residual gap | Owner / next action |
|---|---|---|---|---|---|
| Prompt injection | Chat input, document ingestion, tool output | Unauthorized actions, data leak, role override | Input and output scanning on inbound turns | Session lineage not visible on all incident views | Scout: surface parent session on critical alerts |
| Tool abuse / SSRF | HTTP, shell, code execution, file tools | Internal network access, credential exfiltration | Egress filter, tool policy allow-list | Per-session traceability limited for multi-step chains | Scout: session lineage added to event trail |
| Tenant breakout / BOLA | Hosted API, billing records, memory store, dashboard | Cross-tenant data access | Instance auth, Scout API-key isolation | Incident lineage not linked across session chains | Scout: events now carry parent\_session\_id |
| Memory poisoning | Memory ingest, skill write path, session cache | Future decisions corrupted by planted context | Memory controls, opt-in skill write | Source provenance not tracked on stored context entries | Core: add source tag to memory writes |
| Webhook replay / flow duplication | TaskFlow triggers, webhook dispatcher | Duplicate actions, double-send, cost burn | Webhook dispatcher dedup | Idempotency keys missing on some flow triggers | Core: idempotency key per webhook-triggered run |
| Plugin / supply-chain abuse | Provider plugins, MCP extensions | Malicious tool behavior, prompt manipulation | Plugin load policy, validation gates | Plugin load provenance not surfaced in audit trail | Core: log plugin source on load |
| Cost / DoS abuse | Provider routing, agent loops, chat budget | API key burn, service outage | Rate limits, cost tracker per tenant | Route-level provenance not tied to session lineage | Scout: cost events linked to session chain |
| Observability gaps | Logs, dashboard, event stream | Slower incident response, missed replay | Scout dashboard, SSE stream | Incident views previously lacked parent-session context | Scout: lineage endpoint and dashboard LINEAGE button added |

## Operator response steps

When a critical or breach event appears in the Scout dashboard:

1. Open the event and click **LINEAGE** to pull the session chain.
2. Review related events in the 30-minute forensic window.
3. Use the kill switch to halt the agent if active exploitation is confirmed.
4. Acknowledge the event with a note once contained.
5. If the session originated from a webhook trigger, check the TaskFlow run history for duplicate or replayed runs.

## What this document does not cover

- Network-level DDoS or infrastructure attacks (handled at the hosting layer).
- Credential theft outside the agent boundary (handled by secret rotation policy).
- Browser or client-side vulnerabilities in the Scout dashboard (handled by CSP and session cookie security).

## Review cadence

Update this document when:
- A new integration surface is added (new tool, new channel adapter, new provider plugin).
- A residual gap is closed (move the description to the mitigation column and clear the gap column).
- An incident reveals a gap not listed here.
