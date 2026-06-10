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

Hosted by VERLOX on managed infrastructure.

- Unlimited registered instances
- 99.9% uptime target
- Telegram, Slack, and email alert adapters included; delivery requires channel credentials
- Dashboard at `console.labyrinthscout.com`

Need Scout pre-configured with Carina? Contact us for setup support.

## Enterprise - Custom

- SOC 2 Type II report
- Contractual SLA
- Dedicated Slack support channel
- On-premise or VPC deployment option

Contact: sales@labyrinthscout.com

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
