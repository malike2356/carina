# Carina brand rules (kernel positioning)

## One sentence

Carina is the free, open-source kernel for AI agents. MIT licensed. Scout is the commercial security layer.

## Naming

| Layer | Public name | npm / repo | License |
|-------|-------------|------------|---------|
| Kernel | Carina | `@verlox/carina-core` (npm; `carina-agent` is transition meta-package) | MIT |
| Security | Scout | `@verlox/carina-scout` (SDK only in public; server stays private) | MIT (SDK) / Commercial (server) |
| Hosted SaaS | Carina Ops | not npm; `app.carinaai.uk` | Commercial |
| Domain packs | `{name}` pack | `@verlox/pack-{slug}` (target) | MIT unless premium |
| Hub | Carina Hub | `hub.carinaai.uk` | Free to browse/install |

## Product copy rules

- Propreneur: "Propreneur, powered by Carina"
- Flitz: "Flitz, built on Carina"
- COMPASS: "COMPASS, powered by Carina"
- ABBIS: "ABBIS, built on Carina" (borehole industry platform, Ghana/West Africa; first Africa distro)
- Scout: "Scout, the security layer for Carina"
- Never imply Scout is free or bundled with MIT core in marketing
- ABBIS uses Scout; badge "Secured by Scout" is valid on ABBIS product pages

## Partner badges

Official SVG badges: [carinaai.uk/partners](https://carinaai.uk/partners). Minimum display width **120px**. Dark and light variants provided; do not recolor or edit copy.

| Badge | Use when | Do not use when |
|-------|----------|-----------------|
| **Powered by Carina** | Product uses Carina kernel in production for agent execution | Carina is optional or not deployed |
| **Built on Carina** | Significant custom distro layer on the kernel (vertical product owns UI, ops, packs) | Thin wrapper with no kernel integration |
| **Secured by Scout** | Scout integrated in production (paid) | Scout not subscribed; free tier only |
| **Carina Enterprise Supported** | Signed Enterprise contract with VERLOX | Standard partner or self-host only |

### Badge rules

1. Human approval required before badge use (partner program application at hello@carinaai.uk).
2. Link back to [carinaai.uk](https://carinaai.uk) from a public page (footer, about, or docs).
3. Do not use the Carina wordmark as your primary product logo.
4. Do not imply VERLOX acquired, invested in, or endorses your regulatory or medical claims.
5. Partner badge does not replace Scout or Enterprise badges; they stack when eligible.
6. "Secured by Scout" assets come from [labyrinthscout.com](https://labyrinthscout.com), not the Carina partner zip.

### File paths (marketing site)

- `/assets/badges/powered-by-carina.svg` (dark background)
- `/assets/badges/powered-by-carina-light.svg` (light background)
- `/assets/badges/built-on-carina.svg` (dark background)
- `/assets/badges/built-on-carina-light.svg` (light background)

Program tiers and application: [Partner program](/docs/developer/partner-program) (docs) and [carinaai.uk/partners](https://carinaai.uk/partners).

## Technical boundaries

- `@verlox/carina-core` must not import from `ops.carinaai.uk/` or `console.labyrinthscout.com/`
- Scout integration in core is optional via `LABYRINTH_ENABLED` and `@verlox/carina-scout` client only (see [COMMERCIAL_BOUNDARIES.md](./COMMERCIAL_BOUNDARIES.md))
- Domain packs are opt-in via `ACTIVE_SKILL_PACKS` or `carina pack install`

## Copy audit (2026-06-14)

Audit scope: `carinaai.uk/index.html` and `docs.carinaai.uk/docs/user/` for copy that implies Scout is included free with MIT Carina core.

### carinaai.uk/index.html

- No contradictory copy found. Hero and pricing describe Carina as MIT/self-hosted free. Footer states "Labyrinth Scout is a commercial governance product." Pricing section links to labyrinthscout.com separately.
- Hero updated in prompt `02`: positions Carina as "the free, open-source kernel for AI agents" with trust badges and pricing boundary callout.

### docs.carinaai.uk/docs/user/

| File | Finding | Severity |
|------|---------|----------|
| `carina-cloud.md:207` | Table row "Scout \| Included on Pro" refers to paid Carina Cloud Pro, not MIT core. Wording may blur the kernel vs hosted boundary. | Low; fix in prompt `03` |
| `intro.md:23` | Correct: "Labyrinth Scout is a separate commercial security product." | OK |
| `open-source-pricing.md` | Correct: Scout listed under commercial products; core is MIT. | OK |
| `contributing.md:66` | Correct: "optionally add Scout or Cloud later." | OK |
| `security/labyrinth-scout.md` | Correct: Scout described as optional; pricing paths listed. | OK |

No files claim Scout is bundled free with MIT `carina-agent` self-host installs.
