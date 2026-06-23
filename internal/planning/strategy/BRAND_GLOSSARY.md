# Brand Glossary: Platform vs Customer

White-label Carina keeps **Carina** as the internal platform name while allowing partners and workspaces to show their own product identity to end users.

## Terms

| Term | Meaning | Examples |
|------|---------|----------|
| **Platform brand** | Canonical Carina naming on kernel, ops, CLI, and developer docs | `Carina`, `Carina Cloud`, `Carina Ops`, `carina` CLI |
| **Customer brand** | Product name, logo, and support identity shown to a tenant's end users | `Acme Agents`, `Nova Cloud`, `help@client.example` |
| **Reseller brand** | Partner-level defaults for every client workspace under that partner | Agency product name, partner support email |
| **Workspace brand** | Per-workspace overrides within a customer or reseller account | Client logo URL, workspace sender name |

## Compatibility aliases

Legacy stored values that match platform defaults are treated as unconfigured so ordinary installs do not regress:

- `Carina Cloud` (hosted)
- `Carina` (private / agent)
- `Carina Ops` (ops panel)
- `Carina Agent` (maps to private mode in alias resolution)

Implementation:

- Core: `backends/servers/core.carinaai.uk/src/product/brand-glossary.ts`, `brand-compat.ts`
- App: `frontends/client-apps/app.carinaai.uk/src/lib/brand-compat.ts`

## User-facing surfaces

- **Agent display name**: `shortName` if set, else `productName`, else `Carina` (or `CARINA_AGENT_NAME`).
- **Chat and i18n**: `{agentName}` placeholder via `useBrandedTranslation()` in the app.
- **Workspace chrome**: `injectChatShellBranding()` and sidebar helpers accept optional brand overrides.
- **Gateway web context**: `resolveBrandedProductSurface()` in `web-context.ts`.

## Verification

Before shipping a white-label release:

```bash
./scripts/verify-white-label.sh
```

See `internal/planning/strategy/BRAND_GLOSSARY.md` for platform vs customer terminology.
