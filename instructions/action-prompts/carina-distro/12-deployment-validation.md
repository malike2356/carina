# Carina Distro Prompt 12: End-to-end deployment validation

## Goal

Run a complete end-to-end validation of the ABBIS Docker deployment: all services start,
Carina is reachable internally, all domain modules respond, graceful degradation works,
the version check job runs, and the admin notification appears. This is the go/no-go
checklist before promoting to production.

## Context

All 11 prior prompts must be complete before running this validation:
- Prompts 00-05: Platform foundations (workspace, Carina pin, Docker, degradation, version check, admin UI)
- Prompts 06-11: Domain modules (borehole-africa pack, boreholes, CRM, jobs, billing, association)

Run this checklist in a clean Docker environment (not the local dev database). Use
`docker compose down -v` to reset before starting if a previous run left state behind.

## Prerequisites

```bash
# Confirm required env vars are set
grep -E '^(DATABASE_URL|REDIS_URL|CARINA_INTERNAL_URL|CARINA_API_KEY|PAYSTACK_SECRET_KEY)' .env

# Confirm pnpm-lock.yaml is committed
git status pnpm-lock.yaml  # should show 'nothing to commit'

# Confirm carina-agent version is pinned exactly
cat apps/carina/package.json | grep carina-agent
# Must show: "carina-agent": "0.2.0"  (no ^ or ~)
```

## Validation checklist

Run items in order. Do not skip. Mark each as passed or failed before continuing.

---

### 1. Clean build

```bash
docker compose build
```

Expected: all 4 images build without errors (`abbis-api`, `abbis-web`, `carina`,
`timescaledb`, `redis`). Zero TypeScript compilation errors.

- Carina image must copy `docker/carina/borehole-africa/` into the container
- ABBIS API image must compile with no TypeScript errors (`pnpm build`)

---

### 2. Services start

```bash
docker compose up -d
docker compose ps
```

Expected: all services show `Up` or `healthy` within 60 seconds.

```
NAME           STATUS
abbis-api      Up (healthy)
abbis-web      Up
carina         Up
postgres       Up
redis          Up
```

If `carina` shows `Restarting`: check its logs:
```bash
docker compose logs carina --tail 50
```
Common causes: missing env var, wrong port, bad `ACTIVE_SKILL_PACKS` value.

---

### 3. Database migrations applied

```bash
docker compose exec abbis-api pnpm db:migrate
```

Expected: all 6 migrations run without error:
- `0001_add_system_notifications.sql`
- `0002_boreholes_and_logs.sql`
- `0003_crm_contacts.sql`
- `0004_jobs_milestones_expenses.sql`
- `0005_invoices_and_subscriptions.sql`
- `0006_association.sql`

Verify tables exist:
```bash
docker compose exec postgres psql -U abbis -d abbis_db -c "\dt"
```

Expected: 13+ tables including `boreholes`, `drilling_logs`, `contacts`, `jobs`,
`job_milestones`, `job_expenses`, `invoices`, `invoice_lines`, `tenant_subscriptions`,
`gbda_members`, `gbda_meetings`, `gbda_resolutions`, `gbda_elections`, `gbda_nominations`,
`gbda_disciplinary`, `system_notifications`.

Verify TimescaleDB hypertable:
```bash
docker compose exec postgres psql -U abbis -d abbis_db \
  -c "SELECT hypertable_name FROM timescaledb_information.hypertables;"
```

Expected: `drilling_logs` listed as a hypertable.

---

### 4. API health check

```bash
curl -s http://localhost:3000/api/health | jq
```

Expected:
```json
{ "status": "ok", "service": "abbis-api", "timestamp": "..." }
```

---

### 5. Carina health check (internal only)

Carina runs on `abbis_internal` Docker network. It is NOT accessible from the host.
Test via the ABBIS API proxy:

```bash
curl -s http://localhost:3000/api/health/carina | jq
```

Expected:
```json
{ "carina": "healthy", "timestamp": "..." }
```

If `"carina": "unreachable"`: check that the `CARINA_INTERNAL_URL` env var is set to
`http://carina:4500` (service name from docker-compose.yml, not `localhost`).

---

### 6. Domain module smoke tests

Obtain a test auth token (create a test user or use the test token from `.env.test`).
Set `TOKEN=<your_test_token>`.

```bash
# CRM
curl -s http://localhost:3000/api/crm \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | .id' | head -3

# Create a borehole project
curl -s -X POST http://localhost:3000/api/boreholes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectCode":"SMOKE-001","clientName":"Test Client","siteName":"Test Site","region":"greater_accra"}' | jq '.id'

# Create CRM contact
curl -s -X POST http://localhost:3000/api/crm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"client","displayName":"Smoke Test Client"}' | jq '.id'

# Create job
curl -s -X POST http://localhost:3000/api/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"boreholeId":"<from above>","jobNumber":"SMOKE-JOB-001","title":"Smoke Test","contractValueGhs":10000}' | jq '.id'

# Association member
curl -s -X POST http://localhost:3000/api/association/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test Member","phone":"0244000001","region":"greater_accra"}' | jq '.id'
```

Expected: all 5 requests return `201` with a valid UUID in `.id`.

---

### 7. Drilling log submission and depth update

```bash
BH_ID=<borehole id from above>

# Submit drilling log
curl -s -X POST "http://localhost:3000/api/boreholes/${BH_ID}/logs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"depthStartM":0,"depthEndM":22,"formationCode":"laterite","fluidReturns":"good"}' | jq

# Verify depth updated
curl -s "http://localhost:3000/api/boreholes/${BH_ID}" \
  -H "Authorization: Bearer $TOKEN" | jq '.currentDepthM'
# Must return: 22
```

---

### 8. Graceful degradation under Carina failure

```bash
# Stop Carina
docker compose stop carina

# Wait 15 seconds for health cache to expire
sleep 15

# Non-AI endpoints still return 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health
# Must return: 200

curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:3000/api/boreholes" \
  -H "Authorization: Bearer $TOKEN"
# Must return: 200

# AI endpoint returns 503 with ai_unavailable
curl -s http://localhost:3000/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"hello","sessionId":"test"}' | jq '.error'
# Must return: "ai_unavailable"

# Restart Carina
docker compose start carina

# Wait 15 seconds for health cache
sleep 15

# Carina health returns healthy again
curl -s http://localhost:3000/api/health/carina | jq '.carina'
# Must return: "healthy"
```

---

### 9. Version check job (manual trigger)

```bash
# Trigger the carina version check manually
curl -s -X POST http://localhost:3000/api/admin/notifications/carina/check-version \
  -H "Authorization: Bearer $TOKEN" | jq

# If ABBIS is running 0.2.0 and npm has 0.2.0, no notification created (already up to date)
# To force a notification for testing, insert one directly:
docker compose exec postgres psql -U abbis -d abbis_db -c "
INSERT INTO system_notifications (type, title, message, action_label, action_url)
VALUES (
  'carina_update_available',
  'Carina 9.9.9 is available (smoke test)',
  'This is a smoke test notification.',
  'View changelog',
  'https://carinaai.uk/releases/9.9.9'
);"

# Confirm it appears in the API
curl -s http://localhost:3000/api/admin/notifications \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].type'
# Must return: "carina_update_available"

# Acknowledge it
NOTIF_ID=$(curl -s http://localhost:3000/api/admin/notifications \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

curl -s -X POST "http://localhost:3000/api/admin/notifications/${NOTIF_ID}/acknowledge" \
  -H "Authorization: Bearer $TOKEN" | jq '.ok'
# Must return: true

# Confirm it is gone
curl -s http://localhost:3000/api/admin/notifications \
  -H "Authorization: Bearer $TOKEN" | jq 'length'
# Must return: 0
```

---

### 10. Constitutional rule enforcement

```bash
# Attempt AGM with 5 days notice - must fail
TOMORROW=$(date -d "+1 day" -u +"%Y-%m-%dT%H:%M:%SZ")
TODAY=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

curl -s -X POST http://localhost:3000/api/association/meetings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"agm\",\"title\":\"Test AGM\",\"scheduledAt\":\"${TOMORROW}\",\"noticeSentAt\":\"${TODAY}\"}" | jq '.error'
# Must return: "constitutional_violation"

# Attempt expulsion without a meeting - must fail
curl -s -X POST http://localhost:3000/api/association/members/any-id/expel \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"Misconduct","votesFor":8,"votesAgainst":2}' | jq '.error'
# Must return: "constitutional_violation"
```

---

### 11. Run the full ABBIS test suite in Docker

```bash
docker compose exec abbis-api pnpm test
```

Expected: all 6 distro tests pass. Zero failures.

---

### 12. Check that Carina port is NOT exposed externally

```bash
# This should fail (connection refused or timeout)
curl -s --connect-timeout 3 http://localhost:4500/health
# Expected: connection refused or no response
```

Carina must only be accessible inside the `abbis_internal` Docker network.
It must never be exposed to the host or the internet.

---

## Pass criteria

The deployment is ready for production when ALL of the following are true:

| Check | Result |
|-------|--------|
| All Docker services healthy | Pass |
| All 6 migrations applied | Pass |
| `drilling_logs` is a TimescaleDB hypertable | Pass |
| All 5 domain module smoke tests return 201 | Pass |
| Depth updated correctly after drilling log | Pass |
| Non-AI endpoints return 200 when Carina is stopped | Pass |
| AI endpoint returns 503 `ai_unavailable` when Carina is stopped | Pass |
| Carina health recovers after restart | Pass |
| Version check job creates notification | Pass |
| Notification acknowledged and removed from list | Pass |
| AGM with 5-day notice rejected as constitutional violation | Pass |
| Expulsion without meeting rejected as constitutional violation | Pass |
| All ABBIS tests pass | Pass |
| Carina port 4500 NOT exposed externally | Pass |

## Rollback plan

If any check fails in production:

1. `docker compose down` (stops containers, keeps volumes)
2. `git revert HEAD` or `git checkout <last-good-tag>`
3. `docker compose build && docker compose up -d`
4. Verify health endpoints
5. File an issue describing exactly which check failed and the error output

## Post-validation

After passing all checks:

1. Tag the release: `git tag v0.1.0-alpha && git push origin v0.1.0-alpha`
2. Update `abbis/CHANGELOG.md` with what was shipped
3. Inform the team that the deployment is validated
4. Schedule the first real-world test with a GBDA member

## Pitfalls

- `docker compose down -v` deletes database volumes; only do this before a fresh validation
  run, never against a database with real data
- If Carina logs show `MODULE_NOT_FOUND` for the borehole-africa pack, the Dockerfile
  COPY instruction did not copy the pack correctly; check the path in
  `docker/carina/Dockerfile`
- If TimescaleDB hypertable creation fails with `already a hypertable`, the migration ran
  twice; the `IF NOT EXISTS` in `create_hypertable` handles this, but check that
  the migration runner does not re-run completed migrations
- The constitutional rule tests use date arithmetic; if the CI server timezone differs from
  UTC, date calculations may produce unexpected results; always use UTC timestamps
