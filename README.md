# Carina

Carina is a self-hosted AI agent platform: tools, memory, model routing, channels, and a CLI, with ops and client apps in one monorepo.

Site: [carinaai.uk](https://carinaai.uk)

## What is in this repo

| Path | Purpose |
| --- | --- |
| `02-backends/core.carinaai.uk/` | Agent kernel (CLI, runtime, tools, memory, channels) |
| `02-backends/admin/ops.carinaai.uk/` | Operator control panel |
| `02-backends/keys-server/` | Licence key service |
| `03-frontends/client-apps/` | Web and mobile clients |
| `03-frontends/marketing/` | Docs and hub surfaces |
| `scripts/` | Deploy and ops helpers |

## Quick start (agent kernel)

Requires Node.js 22+.

```bash
cd 02-backends/core.carinaai.uk
pnpm install
pnpm carina
```

Or use the published CLI:

```bash
npm install -g carina-agent
carina
```

Package docs and deeper setup: `02-backends/core.carinaai.uk/README.md` and `docs/`.

## Working in this tree

Read `AGENTS.md` before changing code. Product development is currently paused; see `HOLD.md`.

## Contact

Verlox Ltd: [contact@verlox.uk](mailto:contact@verlox.uk)
