# Pricing

## Self-Hosted (Free)

Run Scout yourself. MIT licensed. No agent limits.

```bash
docker run -d \
  -e SCOUT_API_KEY=your_key \
  -e SCOUT_DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -p 4444:4444 \
  verlox/scout:latest
```

You operate Postgres, Redis, TLS, and backups.

## Scout - £79/month

Hosted by VERLOX on managed infrastructure. [Subscribe](https://core.carinaai.uk/checkout?plan=scout_standard).

- Unlimited registered instances
- 99.9% uptime target
- Telegram, Slack, and email alert adapters included; delivery requires channel credentials
- Private hosted dashboard (console URL and API key emailed at provisioning; not linked from public marketing pages)
- ERC-8004/8126 on Base

Need Scout pre-configured with Carina? Contact us for setup support.

## Enterprise - Custom

- Everything in Scout
- On-chain ERC-8126 attestations on Base
- ERC-8004 agent identity on Base
- Compliance PDF exports (SOC2 / ISO27001 / EU AI Act)
- Configurable daily attestation frequency
- 99.9% uptime SLA
- Dedicated Slack support
- On-premise or VPC deployment option

Contact: contact@verlox.uk

## Feature matrix

| Feature | Self-hosted | Scout | Enterprise |
|---|---|---|---|
| Prompt Guard | Yes | Yes | Yes |
| Kill switch | Yes | Yes | Yes |
| Honeypots | Yes | Yes | Yes |
| Anomaly detection | Yes | Yes | Yes |
| OpenAI proxy mode | Yes | Yes | Yes |
| VERLOX ops | You | VERLOX | VERLOX + custom |

Carina itself remains free and MIT licensed regardless of Scout tier.
