# Labyrinth Scout

[Labyrinth Scout](https://labyrinthscout.com) is an optional security control plane for Carina and other AI agents.

## What Scout adds

- **Prompt injection detection** - Three layers: regex, tool-output patterns, LLM judge
- **Kill switch** - Suspend an instance instantly; Carina listens on Redis `labyrinth:control`
- **Real-time dashboard** - Events, anomalies, tool heatmap, instance heartbeats
- **Honeypots** - Decoy API keys and file paths; access triggers breach events
- **Anomaly detection** - Z-score baselines on session metrics (threshold 3.0)
- **Tool policy** - Blocklist, rate limits, confirmation rules
- **Egress filter** - HTTPS domain allowlist and response DLP

## Connect Carina to Scout

1. Run Scout (see [Scout docs](https://docs.labyrinthscout.com/getting-started)).
2. Add to Carina `.env`:

   ```
   LABYRINTH_ENABLED=true
   LABYRINTH_URL=http://localhost:4444
   LABYRINTH_API_KEY=<same as SCOUT_API_KEY>
   LABYRINTH_INSTANCE_ID=carina-prod
   ```

3. Restart Carina. Logs should show Scout heartbeat and kill-switch subscription.

Carina automatically:

- Sends heartbeat every 60 seconds to `POST /api/heartbeat`
- Reports tool calls and security events to `POST /api/events`
- Flushes session metrics for anomaly detection
- Subscribes to Redis for suspend/resume messages

## Carina Cloud (hosted Pro)

If you use [Carina Cloud](/carina-cloud) at app.carinaai.uk, Pro includes Scout in the product:

- **`/security`** - pairing key, instances, recent events
- **`/dashboard`** - tenant-scoped live security dashboard
- Cloud chat is monitored automatically (`hosted:{userId}` instance)
- The same `scout_live_*` key pairs self-hosted Carina to the same Scout account

No separate Scout signup is required when you upgrade through Carina Cloud billing.

## Bundle pricing

Use Scout with Carina and receive **20% off** hosted Scout Standard. Promo codes are generated during `carina setup` when both products are linked.

## Full documentation

Agent integrators and operators should read the dedicated site:

**https://docs.labyrinthscout.com**

Topics include dashboard panels, HTTP API, SDKs (`@verlox/labyrinth-scout`, `labyrinth-scout` on PyPI), Docker deployment, and OpenAI-compatible proxy mode for third-party agents.
