# Propreneur bridge (Aiva read path)

Connect a **Carina Aiva** worker to a **Propreneur** workspace so your Aiva can read portfolio, compliance, deals, and email activity for daily briefings and mobile Q&A. This is a **read-only** integration in Phase 1; CRM writes stay in Propreneur.

## When to use this

| Task | Product |
|------|---------|
| In-app deal analysis, calculators, CRM writes | Propreneur Carina (`/carina` in Propreneur) |
| Telegram/WhatsApp daily brief, portfolio Q&A | Carina Aiva + this bridge |
| Email ingestion into tenant records | Propreneur **Settings → Email ingestion** |

Do **not** connect the same IMAP mailbox in both Propreneur and Carina. If Propreneur polls the inbox, Aiva reads activity via the bridge only.

## Architecture

```
Propreneur (email ingestion + tenant DB)
        |
        +-- GET /api/aiva-bridge/*  (read-only)
                |
                v
Carina Aiva worker  -->  Telegram / WhatsApp
```

Shared property knowledge lives in the synced `brain/knowledge/` corpus; the two products do not share one agent runtime.

## Feature flags

All default **off** until a pilot tenant is onboarded.

| Flag | System | Purpose |
|------|--------|---------|
| `aiva_external_bridge` | Propreneur (per tenant) | Exposes `/api/aiva-bridge/*` |
| `PROPREENEUR_BRIDGE_ENABLED` | Carina core | Bridge client + portfolio tools |
| `AIVA_DAILY_SUMMARY_ENABLED` | Carina core | Daily summary cron |
| `EMAIL_INGESTION_ENABLED` | Carina core | Carina-only IMAP (non-Propreneur mailboxes) |
| `propreneur_event_webhooks` | Propreneur (optional) | Signed events to Carina |
| `PROPREENEUR_EVENT_WEBHOOKS` | Carina core (optional) | Webhook ingress |

Also requires `AI_WORKERS_ENABLED=true` on Carina for Aiva routes.

## Bind an Aiva to Propreneur

1. In Propreneur: enable `aiva_external_bridge` for the tenant; create a **Carina Remote** API key (**Settings → Carina Remote**).
2. In Carina: create an Aiva with the **property-uk** skill pack (Property Manager template includes it).
3. Connect Telegram (or another channel) on the Aiva.
4. Bind workspace:

```http
POST /api/aiva/workers/{workerId}/propreneur/bind
Content-Type: application/json
X-Workspace-Id: {carina_workspace_uuid}

{
  "tenantSlug": "your-tenant-slug",
  "apiKey": "crm_..."
}
```

The server smoke-tests `GET /api/aiva-bridge/portfolio` before saving the binding.

5. Enable daily summary (optional):

```http
POST /api/aiva/email/summary/config/{workerId}
Content-Type: application/json

{
  "enabled": true,
  "deliveryChannel": "telegram",
  "summarySchedule": "0 7 * * *"
}
```

In **app.carinaai.uk**, open the Aiva **Settings** tab to bind from the UI when the worker uses the property-uk pack.

## Bridge API (Propreneur)

Bearer token: Carina Remote API key.

| Method | Path |
|--------|------|
| GET | `/api/aiva-bridge/portfolio` |
| GET | `/api/aiva-bridge/properties/{id}` |
| GET | `/api/aiva-bridge/properties/{id}/compliance` |
| GET | `/api/aiva-bridge/deals` |
| GET | `/api/aiva-bridge/email-activity?hours=24` |

## Phase 2 writes (review queue)

Enable Propreneur `aiva_bridge_writes` + `aiva_bridge_review_queue` and Carina `PROPREENEUR_BRIDGE_WRITES=true`.

Aiva tools submit proposals only (`propreneur-propose-deal`, `propreneur-propose-compliance-update`, `propreneur-propose-financial-log`). Workspace admins approve at **Settings > Aiva bridge review** before any CRM row is created.

```http
POST /api/aiva-bridge/proposals/deal
Authorization: Bearer crm_...
Idempotency-Key: unique-key-123

{ "title": "Off-market lead from email", "property_id": 12, "review_notes": "Verify address match" }
```

Response: `{ "proposal_id": 1, "status": "pending_review" }`

See `CARINA_PROPRENEUR_COMPLEMENT_GUIDE.md` for the full review workflow.

## See also

- [property-uk skill pack](/docs/user/skill-packs/property-uk)
- [Telegram gateway](/docs/user/gateways/telegram)
- Internal operator runbook (repository): `carina/01-devends/planning/operations/CARINA_PROPRENEUR_COMPLEMENT_GUIDE.md`
