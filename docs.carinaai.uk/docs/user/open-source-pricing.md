# Source release, Ops, and Scout pricing model

:::info Canonical inventory
Product boundaries and attestation honesty: [Capability inventory](/docs/capabilities).
:::

## What is MIT licensed

Carina core, currently published for users as `carina-agent`, and the Scout **client SDK** (`@carina/scout`) are MIT licensed. The scoped `@carina/core` package name is reserved for a future package split and is not the live public npm install path yet. The Scout **server** (`console.labyrinthscout.com`) and Carina Ops are commercial. See the [commercial boundaries doc](https://github.com/malike2356/carina-agent/blob/main/docs/kernel/COMMERCIAL_BOUNDARIES.md) in the public repo (also shipped in the npm tarball under `docs/kernel/`).

## What is commercial

| Product | License | Includes |
|---|---|---|
| Carina Ops | Commercial subscription | BYOK vault, workbench, usage controls, audit, deployments, model routing |
| Labyrinth Scout | Commercial subscription | Security console, kill switch, anomaly detection, compliance exports |
| On-chain attestations | Scout Enterprise add-on | ERC-8004 identity and ERC-8126 verification on Base |
| Carina Cloud | Hosted subscription | Managed Carina + Scout pairing, Stripe billing, tenant dashboard |

## Recommended tiers

| Tier | Price guide | Attestation frequency |
|---|---|---|
| Carina Ops Starter | [Checkout](https://core.carinaai.uk/checkout?plan=ops_starter) (GBP 19 / month) | N/A |
| Carina Ops Team | [Checkout](https://core.carinaai.uk/checkout?plan=ops_team) (GBP 49 / month) | N/A |
| Scout Monitor | [Checkout](https://core.carinaai.uk/checkout?plan=scout_monitor) (£79/mo); dashboard and detection | Weekly |
| Scout Pro | [Checkout](https://core.carinaai.uk/checkout?plan=scout_pro) (£99/mo); kill switch, alerts, exports | Weekly |
| Enterprise | contact@verlox.uk | Daily (configurable) |

Carina source remains free after release. Revenue comes from Carina Ops subscriptions, Scout supervision, hosted operations, and on-chain trust services.
