# Platform support agent API

**Purpose:** HTTP API on the **central** host so external agents (OpenClaw, scripts) can perform **support ticket actions** without the admin UI or Platform Carina chat.

**Not** tenant Carina Remote (`/api/remote/carina/chat` on tenant hosts).

## Enable

1. Feature flags (central admin → Feature flags):
   - `platform_support_tickets` — on
   - `platform_support_agent_api` — on
2. Issue a key (once; plain key shown only at creation):

```bash
cd propreneur-v2
php artisan platform-support:issue-agent-key openclaw-ops --user=1
```

`--user` must be an active platform user with `manage-platform-support` for reply/update/draft abilities.

## Base URL

Central app host, `/api` prefix:

- Local: `http://propreneur.test:8000/api/platform/support/...`
- Production: `https://propreneur.uk/api/platform/support/...` (or your central domain)

## Authentication

```http
Authorization: Bearer psa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Abilities

| Ability | Endpoints |
|---------|-----------|
| `support:read` | `GET /tickets`, `GET /tickets/{ref}` |
| `support:reply` | `POST /tickets/{ref}/replies` |
| `support:update` | `PATCH /tickets/{ref}` |
| `support:draft` | `POST /tickets/{ref}/draft-reply` |

`{ref}` is ticket number (`SUP-2026-00001`) or numeric id.

## Endpoints

### List tickets

```http
GET /api/platform/support/tickets?status=waiting_support&search=acme&limit=20
```

### Get ticket (with thread, including internal notes)

```http
GET /api/platform/support/tickets/SUP-2026-00001
```

### Customer reply (sends email to requester; does not use draft endpoint)

```http
POST /api/platform/support/tickets/SUP-2026-00001/replies
Content-Type: application/json

{
  "body": "Thanks — we have reproduced this and …",
  "internal_note": "optional staff-only note",
  "status": "waiting_tenant"
}
```

### Update metadata only

```http
PATCH /api/platform/support/tickets/SUP-2026-00001
Content-Type: application/json

{
  "status": "resolved",
  "priority": "high",
  "assigned_platform_user_id": 2,
  "remote_access_log_id": 0
}
```

Use `0` to clear assignee or remote access link.

### Draft reply (AI; not sent)

```http
POST /api/platform/support/tickets/SUP-2026-00001/draft-reply
Content-Type: application/json

{
  "tone": "professional",
  "extra_instructions": "Mention maintenance window Sunday 02:00 UTC"
}
```

Response includes `"sent": false`. Post the final text via `/replies` when ready.

## OpenClaw

Configure an HTTP tool (or script) pointing at this API with the `psa_` key. OpenClaw does **not** need to be embedded in Propreneur; Slack can remain OpenClaw’s UI while ticket truth stays in Propreneur.

## Rate limit

60 requests/minute per API key prefix.

## Related

- Platform Carina tools (admin chat): same ticket data, human-in-the-loop UI
- `docs/CARINA_SLACK_INTEGRATION.md` — tenant Carina Slack vs external agents
