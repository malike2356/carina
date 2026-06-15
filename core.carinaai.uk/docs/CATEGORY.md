# The Carina category

**One sentence:** Carina is the agent platform you can trust in production.

This is not a feature checklist. It is the category Carina defines: an MIT-licensed agent kernel with optional commercial security (Scout), hosted ops (Carina Ops), and a discoverable ecosystem (Carina Hub). Competitors may match individual features; none ship this combination under one kernel with measurable proof.

## Why comparison breaks down

| Dimension | Shipped in core | Measurable proof |
|-----------|-----------------|------------------|
| Self-improving agents | Learning loop, curator, skill versions | `carina learning status`; benchmark `learning.curator` |
| Cross-agent learning | Profile agents share skills via kernel index | `carina learning shared`; hub sync `carina learning sync` |
| Security by default | Tool policy, RBAC, optional Scout | `LABYRINTH_ENABLED`; benchmark `security.scout_integration` |
| Domain packs | Built-in + third-party via Hub | `carina hub ecosystem`; benchmark `ecosystem.hub_metrics` |
| Marketplace ecosystem | Packs, extensions, channels, MCP, workflows | `carina hub catalog`; install flows tested |
| MIT + commercial layers | Kernel MIT; Scout/Ops/Enterprise paid | `carina enterprise status` |
| Partner trust | Built on Carina certification CLI | `carina certify built-on [path]` |

## Cross-agent skill sharing

What one agent learns, other agents in the workspace can reuse:

1. Learning loop promotes skills after evidence thresholds (`CARINA_CROSS_AGENT_LEARNING` on by default).
2. Shared index: `$CARINA_HOME/shared-skills.json`.
3. Export to hub: `carina learning share --publish` (requires `CARINA_HUB_TOKEN`).
4. Pull from hub: `carina learning sync`.

**Status:** complete for local + hub file store; federated multi-tenant hub replication is partial.

## Carina Hub ecosystem

One marketplace for packs, extensions, channel adapters, themes, workflows, and MCP servers:

```bash
carina hub ecosystem          # measurable metrics
carina hub catalog --kind pack
carina hub author init my-pack --author "Your Org"
carina hub publish ./packs/my-pack
```

Hub API: `GET /api/ecosystem/metrics`, `GET /api/shared-skills`, `POST /api/shared-skills/publish`.

**Status:** complete for local hub + CLI; production hub.carinaai.uk depends on deployment.

## Third-party domain packs

Authors scaffold with `carina hub author init`, validate knowledge (no secrets in markdown), publish to Hub. Premium packs support Stripe checkout via hub billing module.

**Status:** complete for authoring and publish path; revenue share settlement is deployment-configured.

## Enterprise (Red Hat model)

MIT kernel remains free. Paid layers:

- **Scout Pro** - security SLA
- **Carina Ops Team** - hosted workspace billing
- **Enterprise Supported** - contract, 99.9% SLA, dedicated support

```bash
carina enterprise status
```

See `docs/enterprise/README.md`.

## Built on Carina certification

Automated checks before human badge approval:

```bash
carina certify built-on ./my-product
carina certify powered-by . --json
```

Checks: kernel integration, commercial boundaries, pack manifest (for packs), README attribution. Apply for badge: hello@carinaai.uk (see `docs/kernel/BRAND_RULES.md`).

## Proof, not promises

Run the category benchmark suite:

```bash
carina benchmark run --category platform
carina benchmark run --category marketplace
carina benchmark run --category learning
```

Publish results under `docs/benchmark/` when comparing against Hermes or OpenClaw on identical tasks.

## Honest gaps (partial)

- Channel breadth 50+ (roadmap; not all adapters production-hardened)
- Blockchain trust (documented; not required for category claim)
- Cookbook hardware detection (separate workstream)
- Federated hub replication across orgs

Category claim rests on **trust in production**: security path, MIT kernel, domain packs, cross-agent learning, and a real Hub ecosystem with certification and enterprise support model.
