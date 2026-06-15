# Capabilities

**Canonical public page:** [carinaai.uk/docs/capabilities](https://carinaai.uk/docs/capabilities)  
**Source:** `docs.carinaai.uk/docs/user/capability-inventory.md`

Edit the public page first. This file is an operator-local mirror with runtime-verified counts only.

## Snapshot (15 June 2026)

| Metric | Count | Notes |
|---|---:|---|
| Vitest tests | 8,000+ | `pnpm test` in `core.carinaai.uk` |
| LLM providers (catalog) | 51 | `PROVIDER_DEFINITIONS` |
| LLM providers (chat-routable) | ~39 | Configured subset |
| Channel adapters | 19 | `CHANNEL_CAPABILITIES` |
| Registered tools (base) | 72+ | `registry.list()` at startup; +12 browser when Playwright available |
| Tool inventory doc | 1 | `instructions/operations/TOOL_INVENTORY.md` |
| Skill packs | 17 | `src/skills/packs/` |
| Curated pack skills | 120 | `instructions/operations/SKILL_ROADMAP.md` |
| npm package | 0.1.1 | `carina-agent` |

## Status labels

- **Shipped:** in npm package when prerequisites met
- **Configured:** needs keys/env before live
- **Optional:** off by default
- **Hosted only:** `HOSTED_MODE=true`
- **Scout:** `LABYRINTH_ENABLED=true`

Full inventory, ops surfaces, and links to detail guides live on the public page above. Do not duplicate tool or provider lists here.

## Integrations

Third-party connectors documented under `docs/integrations/`:

- **n8n:** visual workflow automation (trigger n8n workflows from Carina; use Carina as a node in n8n). See `docs/integrations/n8n.md`.
