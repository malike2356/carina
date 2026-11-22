# Carina

Carina is a self-hosted AI agent platform: tools, memory, model routing, channels, and a CLI, with ops and client apps in one monorepo.

- Site: [carinaai.uk](https://carinaai.uk)
- License: [MIT](LICENSE)

## Repository layout

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

Published CLI:

```bash
npm install -g carina-agent
carina
```

More detail: `02-backends/core.carinaai.uk/README.md` and `docs/`.

## Contributing

See `02-backends/core.carinaai.uk/CONTRIBUTING.md` and `02-backends/core.carinaai.uk/SECURITY.md`.
Agent and maintainer notes for this monorepo: `AGENTS.md`.

## Contact

Verlox Ltd: [contact@verlox.uk](mailto:contact@verlox.uk)
