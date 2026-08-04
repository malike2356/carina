# Security incident drill

Tabletop or live drill covering prompt injection, honeypot leak, and kill switch in one sequence. Allow 30 to 45 minutes.

## Prerequisites

- Scout running with at least one alert channel configured.
- Carina running with `LABYRINTH_ENABLED=true` and valid `LABYRINTH_URL` / `LABYRINTH_API_KEY`.
- Operator access to the Scout dashboard and `carina doctor`.

## Drill script

### Step 1: Baseline

1. `GET /api/readiness` on Scout; save JSON snapshot.
2. `carina doctor` on Carina; confirm the Scout connection is reachable.
3. Note current `risk_score` from `/api/public/trust`.

### Step 2: Prompt injection

1. Send a test message containing a known injection pattern (for example "ignore previous instructions").
2. Confirm Scout logs `injection_blocked` or `prompt_injection_blocked`.
3. Confirm alert delivery if channels are configured.
4. Send two more injection attempts in the same session within 15 minutes.
5. Confirm `repeated_injection_blocks` appears if threshold is met.

### Step 3: Honeypot simulation

1. `POST /api/admin/alert-test` with `{"severity":"breach","instance_id":"drill"}`.
2. Confirm dashboard and alert channel receive the test event.
3. Review honeypot configuration in Scout admin; confirm decoy paths are not in real secret stores.

### Step 4: Kill switch

1. `POST /api/kill` for the drill instance (Scout Govern plan required).
2. Confirm Carina rejects new tool calls for the suspended instance.
3. Export compliance report or incident timeline.
4. `POST /api/resume` after documenting findings.

### Step 5: Trust freshness

1. Reload `https://labyrinthscout.com/trust/`.
2. Confirm `data_freshness.stale` is `false` during normal operation.
3. If wallet is configured, confirm honesty banner hides only when chain statuses are `live`.

## Success criteria

- Injection events visible within 60 seconds.
- Alerts fire on breach-severity events when channels are configured.
- Kill switch blocks the instance before resume.
- Operators can follow [Incident response](./incident-response.md) without improvising.

## After the drill

- Acknowledge or archive test events in Scout.
- Record drill date, participants, gaps, and remediation owners.
- Re-run `pnpm doctor` and `carina security audit`.
