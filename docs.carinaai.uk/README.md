# docs.carinaai.uk

Docusaurus documentation site for Carina: user guides and developer reference.

## Commands

```bash
pnpm install
pnpm start    # dev server (default http://localhost:3000)
pnpm build    # static output in build/
pnpm serve    # preview production build
```

Deploy the `build/` directory to https://docs.carinaai.uk (nginx, Cloudflare Pages, or VPS static host).

## Content layout

| Path | Audience |
|---|---|
| `docs/user/` | Install, configure, gateways, tools, security |
| `docs/developer/` | Architecture, CLI, extending tools and channels |

Legacy VitePress sources remain in `core.carinaai.uk/docs/` for reference only; **do not edit them for public releases**. This site is canonical.

## Deploy

| Target | Command |
|---|---|
| `docs.carinaai.uk` subdomain | `pnpm build` then sync `build/` to nginx |
| Embedded at `carinaai.uk/docs` | `bash scripts/deploy-marketing.sh carina` (sets `CARINA_DOCS_MARKETING=1`) |

## Documentation map (mono-repo)

| Site | Source | Build |
|---|---|---|
| Carina user + developer docs | `docs.carinaai.uk/docs/` | Docusaurus (`pnpm build`) |
| Scout product docs | `console.labyrinthscout.com/docs/` | VitePress (`pnpm docs:build`) |
| Carina marketing | `carinaai.uk/` | Static + embedded docs |
| Scout marketing | `labyrinthscout.com/` | Static + embedded docs |
| Internal wiring | `ARCHITECTURE.md`, `CONFIGURATION_READINESS.md` | Git only |

**Security note:** Scout console URLs are emailed at provisioning. Do not link the hosted console hostname from public marketing pages.
