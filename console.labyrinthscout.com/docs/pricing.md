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

## Standard - £99/month

Hosted by VERLOX on managed infrastructure.

- Unlimited registered instances
- 99.9% uptime target
- Telegram, Slack, and email alerts included
- Dashboard at `console.labyrinthscout.com`

## Carina Bundle - £79/month (20% off)

Use Scout alongside [Carina](https://carinaai.uk) (free, open-source agent) and save £240/year versus Standard alone.

Promo codes are generated during `carina setup` when linking a hosted Scout subscription. Apply at checkout on the VERLOX billing portal.

## Enterprise - Custom

- SOC 2 Type II report
- Contractual SLA
- Dedicated Slack support channel
- On-premise or VPC deployment option

Contact: sales@labyrinthscout.com

## Feature matrix

| Feature | Self-hosted | Standard | Enterprise |
|---|---|---|---|
| Prompt Guard | Yes | Yes | Yes |
| Kill switch | Yes | Yes | Yes |
| Honeypots | Yes | Yes | Yes |
| Anomaly detection | Yes | Yes | Yes |
| OpenAI proxy mode | Yes | Yes | Yes |
| VERLOX ops | You | VERLOX | VERLOX + custom |

Carina itself remains free and MIT licensed regardless of Scout tier.
