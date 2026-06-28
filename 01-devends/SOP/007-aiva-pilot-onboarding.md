# SOP 007: Aiva Pilot Onboarding
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/operations/PILOT_AIVA_BRIDGE_ONBOARDING_CHECKLIST.md
**Last reviewed:** 2026-06-25

---

# Pilot Aiva + Propreneur Bridge Onboarding Checklist

**Updated:** 2026-06-26
**Purpose:** Config-only steps to go live on the **pilot path** (Propreneur ingests email; Carina Aiva reads via bridge; Telegram summary + Q&A). No code changes required.

**Prerequisite:** Sprint 6 Phase 1 code deployed on Carina core and Propreneur v2.

**Related:** `SOP/015-carina-propreneur-convergence.md`, `SOP/014-carina-propreneur-operator-guide.md`

---

## VPS ops notes (Propreneur v2 - learned 2026-06-26)

**SSH artisan commands require host overrides.**

The Propreneur v2 `.env` on the VPS sets `DB_HOST=host.docker.internal`, `CENTRAL_DB_HOST=host.docker.internal`, and `REDIS_HOST=host.docker.internal`. These resolve correctly from inside a Docker container (PHP-FPM) but not from a direct SSH session. Any artisan command run via SSH must prefix all three:

```bash
DB_HOST=127.0.0.1 CENTRAL_DB_HOST=127.0.0.1 REDIS_HOST=127.0.0.1 \
  /www/server/php/83/bin/php /www/wwwroot/propreneur-v2/artisan <command>
```

Common commands that need this:

```bash
# Run central migrations
DB_HOST=127.0.0.1 CENTRAL_DB_HOST=127.0.0.1 REDIS_HOST=127.0.0.1 \
  /www/server/php/83/bin/php /www/wwwroot/propreneur-v2/artisan migrate --force

# Run tenant migrations (needed for aiva_bridge_proposals and email ingestion tables)
DB_HOST=127.0.0.1 CENTRAL_DB_HOST=127.0.0.1 REDIS_HOST=127.0.0.1 \
  /www/server/php/83/bin/php /www/wwwroot/propreneur-v2/artisan tenants:migrate --force

# Sync feature catalogue (adds new flags to the feature_flags table)
DB_HOST=127.0.0.1 CENTRAL_DB_HOST=127.0.0.1 REDIS_HOST=127.0.0.1 \
  /www/server/php/83/bin/php /www/wwwroot/propreneur-v2/artisan platform:sync-feature-flags

# Clear caches after deploy
DB_HOST=127.0.0.1 CENTRAL_DB_HOST=127.0.0.1 REDIS_HOST=127.0.0.1 \
  /www/server/php/83/bin/php /www/wwwroot/propreneur-v2/artisan optimize:clear
```

**Enabling per-tenant flags via psql (when UI is not reachable).**

The `aiva_external_bridge` flag is per-tenant and stored in the `tenant_overrides` JSON column of `feature_flags` in `propreneur_central`. To enable for a specific tenant:

```bash
# Find the tenant UUID
PGPASSWORD='propreneur_prod_2026' psql -U propreneur -h 127.0.0.1 -d propreneur_central \
  -c "SELECT id, slug FROM tenants WHERE slug='xelox';"

# Enable the flag for that tenant (replace the UUID)
PGPASSWORD='propreneur_prod_2026' psql -U propreneur -h 127.0.0.1 -d propreneur_central \
  -c "UPDATE feature_flags SET tenant_overrides = json_build_object('{TENANT_UUID}', true), updated_at = NOW() WHERE key = 'aiva_external_bridge';"
```

To verify all bridge flags:

```bash
PGPASSWORD='propreneur_prod_2026' psql -U propreneur -h 127.0.0.1 -d propreneur_central \
  -c "SELECT key, enabled, tenant_overrides FROM feature_flags WHERE key LIKE 'aiva%';"
```

**The deploy script exits with code 1 on migration failure but the rsync succeeds.**

If `deploy-to-production.sh` errors during the migrate step, the code is already on the server. Run the migrations manually with the host overrides above and continue. The script does not roll back the rsync on migration failure.

**Bridge routes return 404 with an invalid API key (not 401).**

The `carina.remote` middleware returns opaque 404 for missing or invalid keys to avoid revealing endpoint existence. This is correct. A real `crm_...` key generated from **Settings > Carina Remote** in the Propreneur workspace will return 200 from the bridge.

---

## Important: one IMAP owner per mailbox

If the pilot tenant uses **Propreneur** `/settings/email-ingestion` for the inbox, do **not** also connect that same mailbox via Carina `/api/aiva/email/connect`. Carina reads email activity through the bridge only.

Use Carina IMAP (`EMAIL_INGESTION_ENABLED`) only for mailboxes **not** managed by Propreneur.

---

## 1. Carina core (ops / deploy)

| Step | Action |
|------|--------|
| 1.1 | Deploy Carina core with migration `011-email-ingestion.sql` applied |
| 1.2 | Set `CHANNEL_CREDENTIAL_KEY` (32-byte hex) if not already set |
| 1.3 | Confirm `AI_WORKERS_ENABLED=true` |
| 1.4 | Set pilot flags (staging first, then prod when ready): |
| | `PROPREENEUR_BRIDGE_ENABLED=true` |
| | `AIVA_DAILY_SUMMARY_ENABLED=true` |
| | `EMAIL_INGESTION_ENABLED=false` (unless using Carina-only mailbox; see above) |
| 1.5 | Optional: `AIVA_DAILY_SUMMARY_CRON=0 7 * * *` (default 07:00 Europe/London) |
| 1.6 | Restart Carina web process after env changes |

---

## 2. Propreneur (platform admin)

| Step | Action |
|------|--------|
| 2.1 | Sync feature catalogue: Platform admin -> Feature flags -> **Sync catalogue** |
| 2.2 | Enable `aiva_external_bridge` for the pilot tenant (global on or tenant override) |
| 2.3 | Confirm tenant subdomain resolves (e.g. `{slug}.propreneur.uk`) |

---

## 3. Propreneur (workspace admin)

| Step | Action |
|------|--------|
| 3.1 | Log in to pilot tenant workspace |
| 3.2 | **Settings -> Email ingestion**: add IMAP mailbox, active senders (property manager, accountant, etc.) |
| 3.3 | **Settings -> Carina Remote**: generate API key; copy plaintext key once (shown once) |
| 3.4 | Verify `emails:process` runs on schedule (Horizon / `schedule:work` in dev) |

---

## 4. Carina Aiva setup

| Step | Action |
|------|--------|
| 4.1 | Create or identify the pilot Aiva worker (`workerId` UUID) |
| 4.2 | Connect **Telegram** channel on the Aiva; note bot is live |
| 4.3 | Send at least one **private Telegram message** to the bot (creates `channel_threads` row for summary delivery) |

---

## 5. API calls (Carina cloud proxy)

All requests need:

- Header: `X-Workspace-Id: {carina_workspace_uuid}`
- Cloud proxy auth (same as other `/api/aiva` routes)

### 5.1 Bind Propreneur tenant

```http
POST /api/aiva/email/propreneur/bind
Content-Type: application/json

{
  "workerId": "{aiva_worker_uuid}",
  "tenantSlug": "{propreneur_tenant_slug}",
  "apiKey": "{carina_remote_api_key_plaintext}"
}
```

Expected: `200` with `propertyCount` (smoke test against `/api/aiva-bridge/portfolio`).

Requires: `PROPREENEUR_BRIDGE_ENABLED=true`

### 5.2 Enable daily summary

```http
POST /api/aiva/email/summary/config/{workerId}
Content-Type: application/json

{
  "enabled": true,
  "deliveryChannel": "telegram",
  "summarySchedule": "0 7 * * *"
}
```

Requires: `PROPREENEUR_BRIDGE_ENABLED=true`, `AIVA_DAILY_SUMMARY_ENABLED=true`

### 5.3 Verify email connection status (Carina IMAP path only)

Skip if using Propreneur email ingestion only.

```http
GET /api/aiva/email/status/{workerId}
```

Requires: `EMAIL_INGESTION_ENABLED=true`

---

## 6. Smoke tests

| # | Test | Pass criteria |
|---|------|----------------|
| 6.1 | Bridge read | `GET https://{slug}.propreneur.uk/api/aiva-bridge/portfolio` with Bearer key returns properties |
| 6.2 | Telegram Q&A | Message Aiva: "How many properties are in my portfolio?" uses real data or states limitation clearly |
| 6.3 | Compliance Q&A | Ask about a known certificate expiry; matches Propreneur compliance data |
| 6.4 | Email activity | After Propreneur processes mail, bridge `GET /api/aiva-bridge/email-activity?hours=24` shows recent rows |
| 6.5 | Daily summary | After cron time (or manual trigger in staging), Telegram receives briefing text |
| 6.6 | Quiet day | With no new activity, summary is short quiet-day format |
| 6.7 | Tenant isolation | Second tenant with bridge disabled or different key cannot read first tenant data |

---

## 7. Optional: Carina IMAP path (non-Propreneur mailbox)

Only if the inbox is **not** in Propreneur email ingestion.

| Step | Action |
|------|--------|
| 7.1 | Set `EMAIL_INGESTION_ENABLED=true` |
| 7.2 | `POST /api/aiva/email/connect` with IMAP host, port, username, password |
| 7.3 | `POST /api/aiva/email/senders/{workerId}` for each allowed sender + role tag |
| 7.4 | Manual poll: `POST /api/aiva/email/poll/{workerId}` |
| 7.5 | Confirm `GET /api/aiva/email/status/{workerId}` shows `pollingEnabled: true` and digests increase |

Poll cron: `AIVA_EMAIL_POLL_CRON` (default `*/5 * * * *`; keep at least 2 minutes for Gmail).

---

## 8. Rollback

| Action | Effect |
|--------|--------|
| Set all three flags `false` on Carina | Disables bridge, summary, Carina IMAP |
| Disable `aiva_external_bridge` on tenant | Bridge API returns 404 |
| Revoke Carina remote API key | Bindings fail on next bridge call |
| Pause Aiva worker | Stops Telegram routing |

---

## 9. What this checklist does not cover

- Production SSL / DNS for tenant subdomain
- Client-specific outreach documents (kept outside this ops checklist)

Phase 2 bridge writes: enable `aiva_bridge_writes` + `aiva_bridge_review_queue` (Propreneur) and `PROPREENEUR_BRIDGE_WRITES` (Carina). See `SOP/014-carina-propreneur-operator-guide.md`.
