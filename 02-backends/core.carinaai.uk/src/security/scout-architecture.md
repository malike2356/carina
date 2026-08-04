# Carina and Scout mutual architecture

Prompt 34 foundation. Scout is the governance platform; Carina is the agent runtime that can integrate with it.

## Roles

| System | Role |
| --- | --- |
| Scout | RASP, kill switch, compliance dashboard, forensic store, operator console |
| Carina | Agent runtime, threat analysis, investigation, NL security queries, recommendations (prompt 35) |

Scout does not depend on Carina to exist or operate. Carina can report signals into Scout and receive protection back from Scout (prompt 36).

## Deployment modes (`SCOUT_MODE`)

| Mode | Behavior |
| --- | --- |
| `colocated` (default) | Scout and Carina share infrastructure; Redis control channel + HTTP API |
| `distributed` | Scout on dedicated infra; set `SCOUT_ENDPOINT` for HTTP; Redis still used for kill switch |
| `carina_only` | No Scout integration; local RASP only; not recommended for production |

Set `SCOUT_ENABLED=false` (and `LABYRINTH_ENABLED` not true) for zero Scout overhead.

## Signal flow (Carina to Scout)

`reportScoutSignal()` in `scout-client.ts` emits structured categories:

- `threat_analysis`
- `investigation`
- `recommendation`
- `nl_query_result`
- `anomaly_detected`
- `proactive_alert`

Legacy `reportEvent()` / `reportToolCall()` / heartbeats remain unchanged.

## Command flow (Scout to Carina)

Redis channel: `labyrinth:control`

Listener: `scout-listener.ts` (wraps `kill-switch-listener.ts`)

| Command | Handler |
| --- | --- |
| `suspend`, `resume`, `block_session`, ... | Instance kill switch (prompt 04) |
| `suspend_session`, `resume_session` | Per-session suspend; `graceful: true` defers block until turn ends |
| `capture_forensic` | Forensic snapshot + Scout evidence push |
| `set_sandbox_policy`, `set_tool_policy`, `block_egress` | Policy enforcement (prompts 06/07); version tracked in `policy-tracker.ts` |
| `investigate_session` | Investigation engine (prompt 35) |
| `analyse_threat` | Threat analyst (prompt 35) |
| `generate_report` | NL summary or recommendations report |
| `rotate_credentials` | Operator-action recommendation |
| `activate_honeypots` | Sets local honeypot activation flag |

Kill switch works when Scout HTTP API is unreachable; Redis path is authoritative.

## Key files

| File | Purpose |
| --- | --- |
| `scout-mutual-types.ts` | Signal and command types |
| `scout-mode.ts` | Deployment mode resolution |
| `scout-client.ts` | `reportScoutSignal()` |
| `scout-listener.ts` | `initScoutListener()`; session suspend + graceful finalize |
| `scout-command-handlers.ts` | Agentic command dispatch |
| `kill-switch-listener.ts` | Redis subscriber |
| `scout/scout-sync.ts` | Periodic compliance evidence push (30 min default) |
| `scout/compliance-collector.ts` | SOC 2, ISO 27001, GDPR + operational evidence |
| `scout/policy-tracker.ts` | Sandbox/tool policy version hash for Scout |
| `forensics/evidence-capture.ts` | Snapshot on Scout trigger |
| `forensics/scout-evidence-push.ts` | Push to Scout evidence store |
| `trust/onchain/identity.ts` | ERC-8004 agent identity state |
| `trust/onchain/verification.ts` | ERC-8126 code integrity verification |
| `trust/public-api.ts` | `GET /api/public/trust` |

## Environment

```bash
SCOUT_ENABLED=true
SCOUT_MODE=colocated          # colocated | distributed | carina_only
SCOUT_ENDPOINT=                # required when SCOUT_MODE=distributed
LABYRINTH_URL=http://labyrinth-scout:4444
LABYRINTH_API_KEY=
LABYRINTH_INSTANCE_ID=carina-prod-1

# Prompt 36: Scout protects Carina
CARINA_SCOUT_SYNC_INTERVAL_MS=1800000
CARINA_SCOUT_SYNC=true
CARINA_PUBLIC_TRUST_ENABLED=true
CARINA_TRUST_AGENT_ID=
CARINA_TRUST_CODE_HASH=
```

## Build order

1. **Prompt 34** (this doc): types, listener, modes, signal envelope
2. **Prompt 35** (this layer): LLM threat analyst, NL query API, investigation engine, proactive advisor, response advisor
3. **Prompt 36**: ScoutSync compliance, forensics push, trust attestation, per-session suspend
