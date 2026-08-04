---
sidebar_position: 1
title: Developer overview
---

# Developer guide

This section is for engineers extending Carina: new tools, gateways, skill packs, memory backends, and integration with the separate Scout product when needed.

**Start with the canonical inventory:** [Capability inventory](/docs/capabilities) (shipped vs configured vs optional).

## Repository layout

The Carina mono-repo is organized by product domain:

| Directory | Purpose |
|---|---|
| `core.carinaai.uk/` | Carina agent (npm package `carina-agent`) |
| `docs.carinaai.uk/` | This documentation site (Docusaurus) |
| `console.labyrinthscout.com/` | Labyrinth Scout security server |
| `ops.carinaai.uk/` | VERLOX internal admin (not shipped) |
| `carinaai.uk/` | Marketing site |

## Local development

```bash
cd core.carinaai.uk
pnpm install
pnpm dev          # agent watch mode
pnpm test         # Vitest suite
pnpm carina       # CLI entry
```

Documentation site:

```bash
cd docs.carinaai.uk
pnpm install
pnpm start        # http://localhost:3000
pnpm build
```

## Extension points

| Area | Start here |
|---|---|
| Tools | [Tool registry](/docs/developer/tools/registry) |
| Gateways | [Channel adapters](/docs/developer/gateway/channels) |
| Skill packs | [Pack format](/docs/developer/skills/packs) |
| Memory | [Memory backends](/docs/developer/architecture/memory) |
| CLI | [CLI architecture](/docs/developer/cli/overview) |
| Security | [Scout integration](/docs/developer/security/scout) |

## Conventions

- TypeScript ESM, two-space indent, Vitest for tests
- Never commit `.env` or API keys
- Match existing patterns in the module you touch; avoid drive-by refactors
