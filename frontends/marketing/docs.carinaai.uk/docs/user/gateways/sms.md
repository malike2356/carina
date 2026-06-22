# SMS gateway

Carina can send and receive SMS through configured provider adapters (Twilio, Vonage, or custom HTTP bridges).

## Prerequisites

- SMS provider account with inbound number or short code
- API credentials with send + receive webhooks

## Setup

Example (Twilio-style):

```
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
SMS_WEBHOOK_PATH=/sms/inbound
```

Point the provider inbound webhook at your gateway HTTPS URL.

## Verify

Send an SMS to the configured number. Carina should reply within provider latency limits.

## Message format

| Direction | Notes |
|---|---|
| Inbound | Plain text; media may be ignored unless adapter supports MMS |
| Outbound | Split long replies into provider-sized segments |

## Troubleshooting

| Symptom | Fix |
|---|---|
| 403 from provider | Check auth token and number ownership |
| Duplicate handling | Idempotency keys on webhook processing |

## Security

Validate provider signatures on inbound webhooks. Rate-limit per sender to reduce abuse.

See [Defence in depth](/docs/user/security/defence-in-depth).
