# n8n integration

## Overview

[n8n](https://n8n.io/) is an open-source workflow automation platform. You connect apps, schedule jobs, and chain steps visually without writing glue code for every integration.

Carina is an autonomous AI agent with tools, memory, and skill packs. Pairing Carina with n8n gives you two directions of automation: Carina can trigger n8n workflows when an agent task needs external systems, and n8n can call Carina as an AI step inside a larger pipeline.

## Carina calling n8n (the n8n tool)

Carina includes an `n8n` tool that talks to your n8n instance over the public REST API.

### Setup

Add these variables to your Carina `.env`:

| Variable | Description |
|---|---|
| `N8N_BASE_URL` | Your n8n instance URL (no trailing slash), e.g. `https://n8n.example.com` |
| `N8N_API_KEY` | API key from n8n **Settings > API** (requires `ENABLE_PUBLIC_API=true` on the n8n server) |

Restart Carina after changing env vars.

### Example prompts

- "Carina, list my n8n workflows"
- "Carina, trigger the portfolio-report workflow"
- "Carina, check the status of execution abc123"

The tool supports three actions:

| Action | Purpose |
|---|---|
| `list` | List workflows (id, name, active, updated_at) |
| `trigger` | Run a workflow by ID or POST to a webhook path |
| `status` | Poll an execution by ID |

Triggering a workflow requires confirmation because it can start side effects in connected systems.

## n8n calling Carina (community node)

The `n8n-nodes-carina` package adds a **Carina** node to n8n. Each item sends a prompt to Carina's `POST /acp/prompt` endpoint and returns the agent response.

### Install

**Option A:** n8n UI: **Settings > Community Nodes > Install**, enter `n8n-nodes-carina`.

**Option B:** Custom nodes directory:

```bash
cd /path/to/n8n/custom
npm install n8n-nodes-carina
```

Restart n8n after install.

### Credentials

Create a **Carina API** credential:

| Field | Value |
|---|---|
| Base URL | Where Carina listens, e.g. `http://localhost:3333` or `https://core.carinaai.uk` |
| API Key | `CARINA_OPS_TOKEN` or `CARINA_WEB_PASSWORD` from Carina `.env` |
| Timeout | Seconds to wait (default 120). Increase for long agent runs. |

### Sample workflows

| Trigger | Carina prompt | Output |
|---|---|---|
| Email received (Gmail) | "Summarize this email and flag if urgent: {{ $json.body }}" | Slack notification |
| Daily cron (8am) | "Generate a portfolio summary for today" | Google Sheets append |
| Typeform submission | "Qualify this property lead: {{ $json.answers }}" | CRM update |

The node passes through `sessionId` when set so follow-up runs can continue the same Carina conversation.

## Environment variables

| Variable | Where used | Required | Description |
|---|---|---|---|
| `N8N_BASE_URL` | Carina n8n tool | When using trigger/list/status | Your n8n instance URL |
| `N8N_API_KEY` | Carina n8n tool | When using trigger/list/status | n8n API key from Settings > API |

The community node uses credential fields in n8n, not Carina env vars.

## Troubleshooting

**"n8n says API not enabled"**

Enable the public API in n8n: **Settings > API**, and set `ENABLE_PUBLIC_API=true` in the n8n server environment. Restart n8n.

**"Carina unreachable from n8n"**

Check the Base URL in the Carina credential. If n8n runs in Docker, `localhost` points at the container, not your host. Use the host machine IP or a Docker network hostname instead.

**"Execution timeout"**

Increase **Timeout (seconds)** in the Carina API credential. Complex agent tasks with many tool calls can exceed the default 120 seconds.

**Webhook vs workflow ID**

For webhook-triggered flows, pass the webhook path (e.g. `my-hook/subpath`) as `workflow_id`. Carina POSTs to `{N8N_BASE_URL}/webhook/{path}`. For API-triggered runs, pass the numeric or UUID workflow id.
