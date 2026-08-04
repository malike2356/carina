# Carina Enterprise

Carina follows a **Red Hat model**: the MIT kernel (`@verlox/carina-core`) stays free and open source. Revenue comes from commercial layers operators choose when they need production trust at scale.

## Layers

| Layer | License / billing | What you get |
|-------|-------------------|--------------|
| Carina kernel | MIT, self-host | Agent runtime, tools, channels, learning loop, Hub client |
| Scout | Commercial subscription | Security policy, kill switch, trust state, governance |
| Carina Ops | SaaS (Starter / Team) | Hosted workspaces, usage metering, team billing |
| Enterprise Supported | Contract | SLA, dedicated support, compliance exports, certification review |

## Support tiers

Inspect tiers programmatically:

```bash
carina enterprise tiers --json
carina enterprise status
```

| Tier | Uptime SLA | Response target | Contract |
|------|------------|-----------------|----------|
| Community (MIT) | none | community | no |
| Carina Ops Team | 99.5% | 24h | no |
| Scout Govern | 99.9% | 8h | no |
| Enterprise Supported | 99.9% | 4h | yes |

SLA numbers are **targets in product configuration**; contractual terms are in the signed Enterprise agreement.

## What Enterprise includes

From `BILLING_PLANS.enterprise` (shipped in core):

- Everything in Scout Govern
- SOC2 readiness export (operator-provided artifacts; not a third-party audit certificate)
- 99.9% uptime SLA target
- Dedicated Slack support channel
- On-premise deployment option
- Built on Carina certification review

## Environment signals

The CLI resolves your active tier from:

- `CARINA_ENTERPRISE_CONTRACT=true` -> Enterprise Supported
- `CARINA_OPS_PLAN=carina_ops_team` -> Carina Ops Team
- `LABYRINTH_ENABLED=true` -> Scout Govern path
- otherwise -> Community MIT

## Kernel boundary

Enterprise support does **not** require shipping proprietary code in the MIT kernel. Paid services attach via Scout client SDK, hosted Ops APIs, and support contracts. See `docs/kernel/COMMERCIAL_BOUNDARIES.md`.

## Contact

Enterprise contracts: contact@verlox.uk
