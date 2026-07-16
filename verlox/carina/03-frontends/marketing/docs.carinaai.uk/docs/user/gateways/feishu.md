# Feishu (Lark) gateway

Feishu/Lark bot integration for enterprise chat in China and international tenants.

## Prerequisites

- Feishu app with bot capability
- App id and app secret
- Event subscription URL (HTTPS)

## Setup

```
FEISHU_APP_ID=...
FEISHU_APP_SECRET=...
FEISHU_VERIFICATION_TOKEN=...
FEISHU_ENCRYPT_KEY=...   # if encryption enabled
```

Enable event subscription for `im.message.receive_v1` (or equivalent for your adapter version).

## Verify

Message the bot in Feishu. Carina should respond in the same thread.

## Troubleshooting

| Symptom | Fix |
|---|---|
| URL verification fails | Return challenge token exactly as Feishu docs specify |
| No events | Confirm subscription is published and app is installed in tenant |

## Security

Rotate app secret on compromise. Restrict gateway admin interfaces to internal networks.
