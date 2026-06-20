# Labyrinth Scout

[Labyrinth Scout](https://labyrinthscout.com) is the optional control plane that turns a Carina install into a client-ready deployment, and it can also protect other AI agents.

## What Scout adds

- **Prompt injection detection** - Three layers: regex, tool-output patterns, LLM judge
- **Kill switch** - Suspend an instance instantly; Carina listens on Redis `labyrinth:control`
- **Real-time dashboard** - Events, anomalies, tool heatmap, instance heartbeats
- **Honeypots** - Decoy API keys and file paths; access triggers breach events
- **Anomaly detection** - Z-score baselines on session metrics (threshold 3.0)
- **Tool policy** - Blocklist, rate limits, confirmation rules
- **Egress filter** - HTTPS domain allowlist and response DLP

## Get Scout access

- Hosted Scout details live on [labyrinthscout.com#pricing](https://labyrinthscout.com#pricing)
- Carina Cloud subscribers use the same paired workflow inside [app.carinaai.uk](https://app.carinaai.uk)
- Self-hosted Scout setup lives in the [Scout docs](https://labyrinthscout.com/docs/getting-started)

## Connect Carina to Scout

1. Obtain `LABYRINTH_URL` and `LABYRINTH_API_KEY` (provisioning email, Carina Cloud **Security** tab, or your self-hosted Scout `.env`).
2. Add to Carina `.env` or run `carina setup` and paste when prompted:

   ```
   LABYRINTH_ENABLED=true
   LABYRINTH_URL=<your Scout console URL>
   LABYRINTH_API_KEY=<your Scout API key>
   LABYRINTH_INSTANCE_ID=carina-prod
   LABYRINTH_INSTANCE_NAME=Carina Production
   ```

3. Restart Carina. Logs should show Scout heartbeat and kill-switch subscription.

Carina automatically:

- Sends heartbeat every 60 seconds to `POST /api/heartbeat`
- Reports tool calls and security events to `POST /api/events`
- Flushes session metrics for anomaly detection
- Subscribes to Redis for suspend/resume messages

## Carina Cloud (hosted)

If you use [Carina Cloud](/docs/user/carina-cloud) at app.carinaai.uk, Scout can pair to the hosted workspace:

- **`/security`** - pairing key, instances, recent events
- **`/dashboard`** - tenant-scoped live security dashboard
- Cloud chat is monitored automatically (`hosted:{userId}` instance)
- The same `scout_live_*` key pairs self-hosted Carina to the same Scout account

No separate Scout signup is required when you upgrade through Carina Cloud billing. That is the handoff from the Carina workspace into the control layer.

## Public trust metrics

Anyone can poll read-only posture at **[carinaai.uk/trust](https://carinaai.uk/trust)** without a Scout login. Tenant operators use their provisioned console for live events, kill switch, and quarantine.

## Full documentation

Agent integrators and operators should read:

**[labyrinthscout.com/docs](https://labyrinthscout.com/docs)**

Topics include dashboard panels, HTTP API, SDKs (`@verlox/labyrinth-scout`, `labyrinth-scout` on PyPI), Docker deployment, ERC-8004/8126 on Base, and OpenAI-compatible proxy mode for third-party agents.
