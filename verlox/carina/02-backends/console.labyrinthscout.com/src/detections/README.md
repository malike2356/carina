# Detection as Code (endpoint-v1)

Pack path: `src/detections/packs/endpoint-v1/pack.json`

## Rule shape

```json
{
  "id": "EP-001",
  "title": "Human title",
  "event_type": "process.exec",
  "severity": "high",
  "when": { "payload.cmd_contains": ["curl|"] }
}
```

Supported `when` keys: `payload.status`, `payload.cmd_contains`, `payload.remote_port_in`, `payload.remote_port_gte`, `payload.remote_is_ip`, `payload.path_prefix`, `payload.risk_tags`.

## Precision over volume

Prefer few high-signal rules. Add fixtures in `src/detections/__tests__/rule-runner.test.ts` for every new rule (true positive + at least one true negative).

## Runner

`runDetectionsOnEvent(eventType, payload)` in `src/detections/rule-runner.ts`.
