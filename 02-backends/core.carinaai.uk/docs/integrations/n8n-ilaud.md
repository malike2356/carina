# n8n integration for iLaud social workflows

Core emits webhook payloads to n8n when social Scout events occur. n8n handles notifications (Telegram, email) and can call back into core for digests and post draft creation.

## Architecture

```
Social inbound / approval / automation (core)
    --> emitIlaudN8nEvent()
        --> POST N8N_ILAUD_WEBHOOK_URL
            --> n8n workflow (alert, digest, post schedule)

n8n cron (daily digest)
    --> GET /api/aiva/integrations/n8n/social-digest
    --> Telegram summary

n8n cron (weekly post)
    --> POST /api/aiva/integrations/n8n/post-draft
    --> worker_social_approvals (message_type: post)
    --> human approve in /aiva/approvals
    --> LinkedIn UGC publish on approve
```

## Environment variables

```
N8N_ILAUD_ENABLED=true
N8N_BASE_URL=https://n8n.example.com
N8N_ILAUD_WEBHOOK_URL=https://n8n.example.com/webhook/ilaud-engagement
N8N_ILAUD_POST_WEBHOOK_URL=https://n8n.example.com/webhook/ilaud-post-schedule
N8N_ILAUD_TOKEN_HEALTH_WEBHOOK_URL=https://n8n.example.com/webhook/ilaud-token-health
N8N_ILAUD_WEBHOOK_SECRET=
AIVA_APP_URL=https://admin.hireaiva.co.uk
```

If `N8N_ILAUD_WEBHOOK_URL` is unset, core falls back to `{N8N_BASE_URL}/webhook/ilaud-engagement`.

## Events emitted to n8n

| Scout event | When |
| --- | --- |
| `social_inbound_received` | New social DM processed |
| `social_approval_requested` | Draft queued for human review |
| `social_approval_timeout` | Pending draft expired (24h) |
| `social_token_expired` | OAuth token refresh failed |
| `social_post_scheduled` | Post draft created (automation or n8n) |
| `automation_run` | Social automation completed (post digest automations only) |

## API endpoints (core, cloud proxy auth)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/aiva/integrations/n8n/social-digest` | Pending approvals + overnight inbound count |
| POST | `/api/aiva/integrations/n8n/post-draft` | Create post approval row from n8n |

Headers: `X-Workspace-Id`, internal proxy bearer (same as other Aiva API proxies).

## Post approval pipeline

1. Automation or n8n creates draft with `message_type: post`.
2. Row appears in Social approval inbox.
3. On approve, core calls LinkedIn UGC Posts API (`linkedin-post-publish.ts`).
4. Scout event `social_post_published` is logged.

DM approvals (`message_type: dm`) continue to use channel adapter send.

## Kill switch

`emitIlaudN8nEvent` checks worker status; only `active` workers emit. Suspended workers do not trigger n8n alerts.

## Workflow export

Import workflows from `apps-on-keprix/xeclone/n8n/iLaud-workflows.json`. See `apps-on-keprix/xeclone/n8n/README.md` for VPS setup.

## Tests

```bash
cd core.carinaai.uk
pnpm exec vitest run src/integrations/n8n/*.test.ts
pnpm exec vitest run src/ingestion/social/social-post-draft-handler.test.ts
```
