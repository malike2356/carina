# Zalo gateway

Zalo Official Account API for Vietnam-region messaging.

## Prerequisites

- Zalo OA account and app id
- OA secret key and access token refresh flow

## Setup

```
ZALO_OA_ID=...
ZALO_APP_ID=...
ZALO_SECRET_KEY=...
```

Configure the webhook URL in the Zalo developer portal.

## Verify

Send a message to the OA from an approved tester account.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Token expired | Refresh OA access token; check cron refresh job |
| Webhook not called | Confirm OA is published and webhook URL is HTTPS |

## Security

Treat OA secrets like production API keys. Scope gateway exposure behind TLS termination.
