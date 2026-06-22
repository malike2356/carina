# WeChat gateway

WeChat Work (企业微信) and official account integrations require vendor-specific credentials and approved domains.

## Prerequisites

- WeChat Work corp id and agent id, or official account app id
- Token and encoding AES key for message crypto
- ICP-approved domain for China-region hosting when required

## Setup

Configure the variables documented for your adapter variant in `.env.example` under `WECHAT_*`.

Typical fields:

```
WECHAT_CORP_ID=...
WECHAT_AGENT_ID=...
WECHAT_SECRET=...
WECHAT_TOKEN=...
WECHAT_ENCODING_AES_KEY=...
```

Register the callback URL in the WeChat admin console.

## Verify

Send a test message from an allowed user. Confirm Carina logs show decrypted inbound payload.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Decrypt failures | Encoding AES key mismatch |
| IP blocked | Whitelist gateway egress in WeChat console |

## Security

WeChat payloads are encrypted; keep AES keys out of git. Use [trust wallet rotation](/docs/user/security/trust-wallet-rotation) for long-lived secrets.
