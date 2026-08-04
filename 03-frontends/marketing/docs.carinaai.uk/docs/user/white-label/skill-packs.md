---
sidebar_position: 4
title: Skill packs
description: Vertical bundles and branded pack marketplace for white-label workspaces.
---

# Skill packs (white-label)

Skill packs add domain context to chat (property, legal, finance, healthcare, support, and more). White-label operators choose which packs appear under their brand and which vertical bundles to install for new clients.

## Storefront

Open **Skill packs** in the cloud app sidebar. You can:

- Install **starter bundles** (property, legal, finance, recruitment, healthcare, support)
- Enable or disable individual packs
- See ownership labels: Platform, Partner, or Workspace

API: `GET /api/marketplace/storefront`

## Pack ownership

| Ownership | Who sets it | Visibility |
| --- | --- | --- |
| Platform | Carina | All workspaces unless hidden |
| Partner | Reseller account | Partner client workspaces |
| Workspace | Customer operator | Single workspace |

Partner catalogs are stored on the hosted engine (`partner_accounts.pack_catalog`). Workspace overrides use `workspace_settings.pack_catalog`.

## Partner catalog API

Partner owners publish branded pack labels:

```http
PUT /api/carina-ops/packs/catalog
Content-Type: application/json

{
  "catalog": [
    {
      "slug": "property-uk",
      "ownership": "reseller",
      "ownerId": "<partner-id>",
      "visible": true,
      "label": "Acme Property Desk"
    }
  ]
}
```

Clients read the merged catalog from `GET /api/carina-ops/packs/storefront`.

## Vertical bundles

| Bundle | Packs included |
| --- | --- |
| Property | `property-uk`, `legal-uk` |
| Legal | `legal-uk` |
| Finance | `finance` |
| Recruitment | `sales-crm`, `productivity` |
| Healthcare | `healthcare` |
| Support | `operator-daily`, `capabilities-ops`, `email-extended` |

Install via UI or `POST /api/marketplace/templates/:id/install`.

## Self-hosted note

Self-hosted installs without hosted marketplace mode still expose platform packs. Vertical bundle shortcuts may be hidden when marketplace mode is off; enable packs via `ACTIVE_SKILL_PACKS` or `carina packs enable`.

## Related

- [Skill packs overview](/docs/user/skill-packs/overview)
- [Getting started](/docs/user/white-label/getting-started)
