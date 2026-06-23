# Type 3 reasoning compromise runbook

Labyrinth Scout classifies **Type 3** incidents when prompt injection, anomalous reasoning chains, poisoned RAG context, or jailbreak patterns are detected. Traditional IR runbooks do not cover this layer because evidence lives in the prompt chain, not on disk.

## Detection signals

| Signal | Scout source |
|---|---|
| Prompt injection block | `event_type` matching `injection` |
| Anomaly spike | `anomaly_scores` z-score above baseline |
| Honeypot trigger | `honeypots.triggered = true` |
| Critical/breach without Type 1/2 pattern | `classifyIncident()` fallback |

## Immediate response

1. Confirm the incident in **Incident Timeline** (Scout dashboard, filter Type 3).
2. Review the **forensic snapshot** captured automatically before kill switch suspension.
3. Suspend the agent if not already suspended (`POST /api/kill/:instanceId`).
4. Export compliance evidence: `GET /api/trust/compliance-report?format=pdf`.

## Forensic artifacts (6)

Captured in `forensic_snapshots` before containment:

1. Prompt history (injection-related events)
2. RAG provenance (retrieval/context events)
3. Tool sequence (tool/shell/code/http events)
4. Identity (instance + account metadata)
5. Downstream agents (delegation/subagent events)
6. LLM trace (model/session metrics events)

## Recovery

1. Resolve root cause (poisoned document, compromised tool, malicious user input).
2. Resume instance only after operator review (`POST /api/resume/:instanceId`).
3. Wait for clean 30-day window before next on-chain attestation posts.

## Public verification

Third-party services can gate on trust score:

```
GET /api/public/trust/verify/:agentId?max_risk=40
```

Returns `gate_passed: true` when ERC-8126 unified risk is within threshold.
