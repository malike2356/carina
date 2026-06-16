---
sidebar_position: 11
title: Commercial boundaries
---

# Commercial boundaries

Carina core is MIT licensed. Self-hosted Carina has no license fee. Carina Cloud gives people the workspace; Scout adds the controls that turn it into production.

## The rule

- **Carina is MIT licensed.** Self-hosted installs have no license fee.
- **Carina Cloud is hosted SaaS.** Current package details are on [carinaai.uk/pricing](https://carinaai.uk/pricing).
- **Scout is commercial.** It adds the controls that teams need for production. See [labyrinthscout.com#pricing](https://labyrinthscout.com#pricing) for current hosted Scout options.
- **Carina Ops is commercial.** BYOK vault, workbench, audit, and team features are described in the product docs, with current package details on [carinaai.uk/pricing](https://carinaai.uk/pricing).
- **Carina Enterprise is commercial.** Support SLAs and services for ISVs building on the kernel. See [Enterprise](/docs/user/enterprise).

## Comparison

| | Carina (kernel) | Carina Cloud | Scout | Carina Ops |
|---|---|---|---|---|
| License | MIT | Hosted service | Commercial | Commercial |
| Includes | Tools, memory, channels, packs | Browser workspace, hosting | Injection shield, audit, kill switch | Team RBAC, workbench, deployments |
| Required? | Yes (base) | No | No | No |

## FAQ

**Can I run Carina without Scout?** Yes. Set `LABYRINTH_ENABLED=false` or skip Scout during setup.

**Can I self-host everything?** Yes for Carina. The Scout server is a separate commercial product.

**Is npm install free?** The kernel is MIT licensed. `npm install -g carina-agent` does not include a license fee.

**Is Carina Cloud the same as Scout?** No. Cloud is hosting plus workspace UI. Scout is the paid security governance layer that attaches to that workspace.

## Plan details

- Carina Cloud: [carinaai.uk/cloud](https://carinaai.uk/cloud) and [Carina Cloud guide](/docs/user/carina-cloud)
- Carina Enterprise: [carinaai.uk/enterprise](https://carinaai.uk/enterprise) and [Enterprise guide](/docs/user/enterprise)
- Scout plans: [labyrinthscout.com#pricing](https://labyrinthscout.com#pricing)
- Carina Ops plans: [Carina Ops plans](/docs/user/carina-ops/plans)
- Source release model: [Commercial boundaries](/docs/user/open-source-pricing)

See also the marketing page at [carinaai.uk/pricing](https://carinaai.uk/pricing).
