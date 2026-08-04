---
sidebar_position: 6
title: Partner and reseller
description: Onboard client workspaces, publish packs, and run a white-label agency on Carina.
---

# Partner and reseller guide

This guide is for agencies and consultancies that resell Carina as their own product.

## Become a partner operator

1. Run your own operator workspace on [app.carinaai.uk](https://app.carinaai.uk) or self-hosted cloud.
2. Create a partner account on the hosted engine (org owner):

```http
POST /api/carina-ops/partner/account
Content-Type: application/json

{
  "name": "Acme Agency",
  "commercialTier": "agency"
}
```

3. Set reseller brand (product name, support email, colors) on the partner record.
4. Publish your pack catalog if you sell vertical bundles ([Skill packs](/docs/user/white-label/skill-packs)).

## Onboard a client workspace

```http
POST /api/carina-ops/partner/clients
Content-Type: application/json

{
  "name": "Client Co workspace",
  "email": "owner@client.example"
}
```

The client receives invite credentials. Their org is linked to your `partner_id` for brand and pack visibility.

List clients: `GET /api/carina-ops/partner/clients`.

## Commercial packaging ideas

| Package | What you sell | Carina layer |
| --- | --- | --- |
| Branded chat | Browser workspace on your domain | Cloud app + brand |
| Vertical agent | Property or healthcare pack bundle | Skill packs + prompts |
| Managed ops | You run keys, cron, and support | BYOK vault + your SLA |
| Security add-on | Separate Scout product | Labyrinth Scout integration |

## Co-marketing

The [Built on Carina partner program](https://carinaai.uk/partners) covers badges and co-marketing for products on the MIT kernel. White-label resellers may still use "Powered by Carina" in footer unless contract says otherwise.

## Limits

- `maxClientOrgs` on your partner tier caps how many client workspaces you can provision.
- Kernel format and pack manifests must stay compatible; do not fork pack IDs without documenting migrations.
- Control plane hosts remain operator-facing.

## Related

- [Customer handoff](/docs/user/white-label/customer-handoff)
- [Billing and plans](/docs/user/white-label/billing-and-plans)
- [Developer partner program](/docs/developer/partner-program)
