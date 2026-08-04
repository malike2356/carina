# LINE gateway

LINE Messaging API integration for Carina gateway deployments in APAC.

## Prerequisites

- LINE Developers channel (Messaging API)
- Channel access token and channel secret

## Setup

```
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
```

Enable webhook in the LINE console and point it to your gateway HTTPS URL.

Restart: `carina gateway start`.

## Verify

Add the bot as a friend and send a text message.

## Limits

- Push messages require user opt-in
- Rich menus and flex messages depend on adapter configuration

## Troubleshooting

| Symptom | Fix |
|---|---|
| Invalid signature | Check `LINE_CHANNEL_SECRET` matches console |
| Webhook 404 | Confirm `LINE_WEBHOOK_PATH` matches nginx route |

## Security

Validate LINE signatures on every inbound request. Do not disable signature checks in production.
