# Troubleshooting

Common problems and their fixes when running Labyrinth Scout or integrating it with an agent.

## Scout not receiving heartbeats

**Symptom:** Instance shows **offline** in the dashboard immediately after starting.

**Check list:**

1. Confirm `LABYRINTH_URL` points to the Scout server (no trailing slash, correct port).
2. Confirm `LABYRINTH_API_KEY` matches `SCOUT_API_KEY` on the Scout server.
3. Confirm `LABYRINTH_ENABLED=true` is set on the agent side.
4. Test the endpoint directly:
   ```bash
   curl -X POST http://localhost:4444/api/heartbeat \
     -H "X-Scout-Key: $SCOUT_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"instance_id":"test","name":"Test"}'
   ```
   Expect `{"ok":true}`.
5. Check Scout logs for `401 Unauthorized` - key mismatch.
6. If Scout is behind a proxy, ensure the `X-Scout-Key` header is not stripped.

## Kill switch fires immediately on startup

**Symptom:** Agent exits with "Carina is suspended by Labyrinth Scout" before handling any message.

**Cause:** The instance was previously suspended and was never resumed.

**Fix:** Call `POST /api/resume/:instanceId` or click **Resume** in the dashboard.

If the problem recurs across restarts, check whether `LABYRINTH_INSTANCE_ID` is shared between multiple agent processes. Use a unique id per process to avoid state conflicts.

## Dashboard shows no events after tool calls

**Symptom:** Heartbeats arrive (instance is **active**) but no `tool_call` events appear.

**Check list:**

1. On Carina: confirm `LABYRINTH_ENABLED=true` and agent is not in CLI-only mode.
2. Custom agents: call `scout.reportToolCall(...)` after each tool execution.
3. Confirm Postgres is reachable from Scout (`SCOUT_DATABASE_URL`).
4. Check Scout process logs for `Database error` or `Event insert failed`.

## Anomaly detection fires on normal traffic

**Symptom:** Z-score alerts appear frequently without actual anomalies.

**Cause:** Baseline sample count is below 10, so the initial baseline is noisy.

**Fix:** Allow Scout to collect at least 10 `session_metrics` events per instance before treating alerts as significant. Alternatively, raise `Z_ANOMALY_THRESHOLD` in `src/security/anomaly-detection.ts` for your workload.

## Prompt guard blocks legitimate messages

**Symptom:** Agent returns "Input blocked by Labyrinth Scout" for normal user queries.

**Cause:** User message matches a layer-1 regex pattern (common in developer/security contexts with phrases like "ignore the previous").

**Fix options:**

1. Review `src/security/prompt-guard.ts` `INPUT_PATTERNS` - remove or narrow patterns that are too broad for your domain.
2. For technical or developer-facing agents, consider disabling layer 1 regex and relying on the LLM judge (layer 3) only.
3. Log the blocked content (event `metadata.matchedPattern`) to identify which pattern fires.

## SSE stream disconnects frequently

**Symptom:** Dashboard live stream shows reconnections every few minutes.

**Cause:** Redis connection dropped or proxy timeout.

**Check list:**

1. Confirm Redis is running: `redis-cli ping` returns `PONG`.
2. If behind nginx, set `proxy_read_timeout 3600;` and `proxy_send_timeout 3600;` for the `/api/stream` location.
3. Check Scout logs for `Redis connection lost` errors.

## Postgres migrations fail on startup

**Symptom:** Scout exits with `relation "security_events" does not exist` or similar.

**Cause:** The migration runner did not complete before the server tried to query.

**Fix:**
```bash
# Run migrations explicitly
cd console.labyrinthscout.com
node dist/src/migrations.js
# Then start the server
npm start
```

Or pass `--migrate` if your start script supports it. Scout migrations are idempotent (safe to re-run).

## Trust attestation not posting to chain

**Symptom:** `pnpm trust:attest` outputs "Skipping: preconditions not met."

**Reasons attestation is skipped:**

- No active agents registered in Scout (`carina_instances` table empty).
- Critical or breach events in the last 30 days (clean runtime required).
- Last attestation was within `TRUST_ATTESTATION_INTERVAL_DAYS` (default 7).
- `TRUST_ATTESTER_PRIVATE_KEY` is not set or has insufficient balance for gas.

Check `trust_attestations` table for the last attempt timestamp and result.

## API key not accepted (401 on all endpoints)

**Symptom:** Every API call returns `401 Unauthorized`.

**Fix:**

1. Confirm `SCOUT_API_KEY` is set on the Scout server (restart required after `.env` changes).
2. Send the key as `X-Scout-Key` header, not `Authorization: Bearer`.
3. If you rotated the key, update `LABYRINTH_API_KEY` on all connected agents and restart them.

## Carina shows "Scout unreachable" but Scout is running

**Symptom:** Carina starts with a warning about Scout connectivity, events are not reported.

**Note:** Scout is optional. Carina fails open when Scout is unreachable. This is expected if you have not configured Scout.

If Scout IS running and you still see this, confirm the ports and hostnames match. On Docker networks, use the container name (`labyrinth-scout`) not `localhost`.
