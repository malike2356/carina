# Google Chat gateway

Connect Carina to Google Chat spaces via a service account and HTTP webhook.

## Prerequisites

- Google Cloud project with Chat API enabled
- Service account JSON with Chat bot scope
- Public HTTPS URL for inbound webhooks (or Cloudflare tunnel)

## Setup

1. Create a Google Chat app in the Cloud console and note the project id.
2. Add credentials to `.env`:

   ```
   GOOGLE_CHAT_SERVICE_ACCOUNT=/path/to/service-account.json
   GOOGLE_CHAT_WEBHOOK_PATH=/google-chat/webhook
   ```

3. Register the webhook URL with Google Chat.
4. Restart the gateway: `carina gateway start`.

## Verify

Send a message in a space where the bot is added. Carina should reply in-thread.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_CHAT_SERVICE_ACCOUNT` | Yes | Path to service account JSON |
| `GOOGLE_CHAT_WEBHOOK_PATH` | No | Webhook mount path (default configured in gateway) |

## Troubleshooting

| Symptom | Fix |
|---|---|
| 401 from Google | Rotate service account key; check clock skew |
| Bot silent | Confirm bot is added to the space and webhook URL is reachable |
| Duplicate replies | Ensure only one gateway instance handles the webhook |

## Security

- Restrict service account to Chat API only
- Terminate TLS at the edge; do not expose the gateway admin port publicly

See also: [Gateway hardening](/docs/user/security/gateway-hardening).
