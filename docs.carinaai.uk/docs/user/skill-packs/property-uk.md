# property-uk Skill Pack

Built-in UK residential and investment property knowledge for Carina.

## Pre-built skills

| Skill id | Purpose |
|---|---|
| `brr-analysis` | Buy, Refurbish, Refinance deal analysis |
| `hmo-compliance-check` | HMO licensing, room sizes, fire regulations |
| `yield-calculator` | Gross and net yield from price and rent |
| `deal-sourcing-workflow` | On- and off-market sourcing procedure |
| `area-scoring` | Location due diligence framework |
| `bridging-finance-explainer` | Bridging loan costs, exit strategy, risks |

Skills activate on keyword overlap or when you name them explicitly:

> "Use the HMO compliance check skill for a 6-bed in Portsmouth."

## Knowledge corpus

95+ markdown documents covering BRR, HMO regulations, SDLT, planning permission, Article 4 directions, bridging finance, Land Registry, compliance, and portfolio management. Sources live under `brain/` and are ingested into pgvector.

## Pack tools

| Tool | Variable | Capability |
|---|---|---|
| `property-data-lookup` | `PROPERTY_DATA_API_KEY` | Prices, yields, sold comparables by postcode |
| `land-registry-lookup` | `LAND_REGISTRY_API_KEY` | Title and registration lookups |

Tools register only when the corresponding API key is set.

## Ingest knowledge

```bash
cd core.carinaai.uk
pnpm ingest
```

Equivalent:

```bash
tsx src/skills/ingestion.ts --pack property-uk
```

Requires `GEMINI_API_KEY` for embeddings. Re-runs skip already-ingested sources.

## Install on a new machine

```bash
carina install-pack property-uk
```

Or accept the pack during `carina` setup wizard.

## System behaviour

The pack appends a UK property-focused system suffix so Carina prioritises UK terminology, regulation references, and conservative financial assumptions.
