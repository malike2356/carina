# Repository Guidelines

## Writing style

Never use em dashes (U+2014) or en dashes (U+2013). Use `;`, `:`, `,`, `-`, parentheses, or sentence breaks instead. Never use emojis anywhere.

## Public GitHub hygiene

Track only files required to build, run, test, or operate Carina. Do not commit planning trees, prompt queues, research scratch, personal notes, runtime logs, or secrets. Prefer `.env.example` over real `.env` files. Never commit `*.htpasswd`, private keys, or credential dumps.

## Project structure

Carina is a TypeScript/Node monorepo.

- `02-backends/core.carinaai.uk/`: agent kernel (CLI in `bin/`, source in `src/`)
- `02-backends/admin/ops.carinaai.uk/`: operator panel
- `02-backends/keys-server/`: licence key service
- `03-frontends/client-apps/`: web and mobile clients
- `03-frontends/marketing/`: docs and hub
- `03-frontends/integrations/` and `03-frontends/sdks/`: integrations and SDKs
- `scripts/`: deploy helpers
- `docs/`: platform docs

Do not create nested platform copies under `carina/verlox/`.

## Build and test

From the package directory:

- Core: `pnpm install && pnpm build && pnpm test`
- Ops: `pnpm install && pnpm css` (when changing styles), then `pnpm dev`
- Docs: `cd 03-frontends/marketing/docs.carinaai.uk && pnpm start`

## Security

Never commit real API keys, tokens, or production `.env` values. Rotate anything that was ever pasted into chat or logs. Report vulnerabilities per `02-backends/core.carinaai.uk/SECURITY.md`.

## Terminology

**Playbook** is the user-facing product term for the situational decision engine. **Cookbook** is an internal implementation label only (`src/cookbook/`); do not use it in operator-facing copy.
