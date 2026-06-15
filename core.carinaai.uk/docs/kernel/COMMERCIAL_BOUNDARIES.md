# Commercial product boundaries

This document defines what ships in the MIT `@verlox/carina-core` kernel versus commercial or private VERLOX products. CI enforces these rules via `scripts/check-kernel-boundaries.ts`.

## Product matrix

| Artifact | Package / location | Public npm? | License |
|----------|-------------------|-------------|---------|
| Agent kernel | `@verlox/carina-core` | Yes | MIT |
| Scout client SDK | `@verlox/carina-scout` | Yes | MIT |
| Scout server | `console.labyrinthscout.com` | No (Docker commercial) | Commercial |
| Carina Ops API/UI | `core.carinaai.uk/src/hosted/`, `src/api/carina-ops-routes.ts` | No (SaaS) | Commercial |
| VERLOX ops panel | `ops.carinaai.uk` | Never | Private |
| Domain packs | `@carina/pack-*` | Yes (opt-in) | MIT unless premium |
| Web gateway UI | `@verlox/carina-web` | Yes (opt-in) | MIT |

## Kernel rules

1. **`@verlox/carina-core` must not import** from `ops.carinaai.uk/` or `console.labyrinthscout.com/` (server code stays out of the kernel tarball).
2. **Scout integration is opt-in**: install `@verlox/carina-scout` separately; core loads it via dynamic `import('@verlox/carina-scout')` when Scout is enabled in config or env.
3. **No Scout server installer** in core. Use `carina scout enable` for setup guidance; deploy Scout from [labyrinthscout.com](https://labyrinthscout.com).
4. **Domain packs** are opt-in via `ACTIVE_SKILL_PACKS` or `carina pack install` (see `COMMERCIAL_BOUNDARIES` sibling doc `STABLE_API.md` for semver).

## What stays in core (client-side only)

These modules talk *to* Scout or Ops services but are not the server product:

| Module | Role |
|--------|------|
| `src/security/kill-switch-listener.ts` | Redis subscriber for Scout control messages (suspend, quarantine) |
| `src/security/scout-context.ts` | AsyncLocalStorage for per-tenant Scout credentials in hosted mode |
| `src/security/scout-client.ts` | Thin shim; delegates to `@verlox/carina-scout` when installed |
| `src/api/hosted-scout.ts` | Carina Cloud pairing endpoints (commercial hosted layer) |
| `src/billing/tenant-scout.ts` | Stripe provisioning hooks for Scout subscriptions |

The kill-switch listener is **client-side**: it reacts to Redis pub/sub from a Scout server instance. It does not include dashboard, event storage, or operator UI.

## Scout enable flow

```bash
npm install @verlox/carina-core @verlox/carina-scout
export LABYRINTH_ENABLED=true
export LABYRINTH_URL=https://your-scout-server
export LABYRINTH_API_KEY=your-key
carina scout status
```

Default `npm install @verlox/carina-core` does **not** require `@verlox/carina-scout`.

## Public export

The public `carina-agent` GitHub export (`scripts/export-carina-core-public.sh`) includes `@verlox/carina-core` only. It excludes:

- `ops.carinaai.uk/`
- `console.labyrinthscout.com/`
- `docker-compose.verlox.yml` (references private ops + Scout stacks)

Run `pnpm boundary-check` before publishing or exporting.

## Related docs

- [Brand rules](./BRAND_RULES.md)
- [Stable public API](./STABLE_API.md)
- [User pricing boundary](https://carinaai.uk/pricing/)
