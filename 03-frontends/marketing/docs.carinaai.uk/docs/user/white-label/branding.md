---
sidebar_position: 2
title: Branding
description: Product name, logo, colors, and support identity for white-label Carina workspaces.
---

# Branding

Branding changes what your users see: app title, login screen, sidebar mark, billing labels, and outbound email identity. It does not change agent capabilities.

## Brand layers

Carina resolves brand fields in this order (later layers override earlier ones):

1. **Platform** defaults (`Carina Cloud` on hosted)
2. **Reseller** (partner account on hosted engine)
3. **Workspace** (your settings in the cloud app)
4. **User** theme accents (appearance only)

Workspace owners edit the workspace layer in **Settings > Brand**. Partner operators with a hosted org can also set reseller brand on the engine for all client orgs.

## Fields you can set

| Field | User-facing effect |
| --- | --- |
| `productName` | Headings, billing page, chat chrome |
| `shortName` | Compact labels and PWA short name |
| `publicSiteTitle` | Browser tab title |
| `logoUrl` | Sidebar and login logo (HTTPS URL) |
| `faviconUrl` | Browser favicon |
| `colorTokens` | Accent color (`--accent` and related tokens) |
| `supportEmail` | Help links and reply-to guidance |
| `supportName` | Support signature label |
| `senderName` / `senderEmail` | Invite and usage emails (hosted) |
| `emailFooter` | Plain-text footer on transactional email |

## Cloud app

1. Sign in as the **workspace owner**.
2. Open **Settings > Brand**.
3. Save product name, support contact, logo URL, and accent color.
4. Open an incognito window on your workspace URL to confirm login and manifest metadata.

API: `PATCH /api/workspace/settings` with a `brand` object. `GET /api/brand` returns the resolved brand for the current host.

## Self-hosted

Set defaults with environment variables on the cloud app container:

- `CARINA_SUPPORT_EMAIL`
- `CARINA_SENDER_EMAIL`

Per-workspace overrides remain in `workspace_settings.brand` JSON in the app database.

## Docs and marketing sites

Build customer-branded help with:

```bash
CARINA_DOCS_BRAND_TITLE="Acme Agent Docs" pnpm build
```

Embed docs on your marketing site with `CARINA_DOCS_MARKETING=1` (see Docusaurus config in the docs package).

## What stays Carina-branded

- Kernel CLI and developer docs (unless you ship a private fork)
- `core.carinaai.uk` and `ops.carinaai.uk` operator hosts
- Internal audit and deploy tooling

Do not promise customers that those surfaces will show their logo; position them as operator-only infrastructure.

## Related

- [Custom domains](/docs/user/white-label/custom-domains)
- [Customer handoff](/docs/user/white-label/customer-handoff)
