# Carina Kernel Sprint 0: Lock brand and boundaries

## Goal

Freeze the Carina kernel positioning, naming rules, and free-vs-commercial boundary before any manifesto, landing page, or package split work begins.

## Context

- Strategy: `CARINA_AS_LINUX.md` (repo root)
- Carina agent: `core.carinaai.uk/` (npm package `carina-agent@0.1.x`, MIT)
- Scout server: `console.labyrinthscout.com/` (commercial; never ship as part of free core)
- Carina Ops: hosted SaaS in `core.carinaai.uk/src/hosted/` + customer UI at `app.carinaai.uk` (commercial)
- Marketing site: `carinaai.uk/` (static HTML)
- Public export target: `malike2356/carina-agent` per `instructions/strategy/PUBLIC_REPOSITORY.md`

## Dependencies

None. Run this first.

## Files to create

- `core.carinaai.uk/docs/kernel/BRAND_RULES.md` (internal; not exported to public repo if sensitive, but safe to export)

## Files to modify

- `CARINA_AS_LINUX.md` (add a "Locked" note at top referencing this prompt completion date)
- `core.carinaai.uk/README.md` (one paragraph kernel positioning; link to manifesto once `01` lands)

## Step-by-step

1. Create `core.carinaai.uk/docs/kernel/BRAND_RULES.md` with these locked decisions:

```markdown
# Carina brand rules (kernel positioning)

## One sentence

Carina is the free, open-source kernel for AI agents. MIT licensed. Scout is the commercial security layer.

## Naming

| Layer | Public name | npm / repo | License |
|-------|-------------|------------|---------|
| Kernel | Carina | `@verlox/carina-core` (target; today: `carina-agent`) | MIT |
| Security | Scout | `@verlox/carina-scout` (SDK only in public; server stays private) | Commercial |
| Hosted SaaS | Carina Ops | not npm; `app.carinaai.uk` | Commercial |
| Domain packs | `{name}` pack | `@carina/pack-{slug}` (target) | MIT unless premium |
| Hub | Carina Hub | `hub.carinaai.uk` | Free to browse/install |

## Product copy rules

- Propreneur: "Propreneur, powered by Carina"
- Flitz: "Flitz, built on Carina"
- COMPASS: "COMPASS, powered by Carina"
- ABBIS: "ABBIS, built on Carina" (borehole industry platform, Ghana/West Africa; first Africa distro)
- Scout: "Scout, the security layer for Carina"
- Never imply Scout is free or bundled with MIT core in marketing
- ABBIS uses Scout; badge "Secured by Scout" is valid on ABBIS product pages

## Technical boundaries

- `@verlox/carina-core` must not import from `ops.carinaai.uk/` or `console.labyrinthscout.com/`
- Scout integration in core is optional via `LABYRINTH_ENABLED` and `@verlox/carina-scout` client only
- Domain packs are opt-in via `ACTIVE_SKILL_PACKS` or `carina pack install`
```

2. Add to top of `CARINA_AS_LINUX.md` after the context line:

```markdown
**Brand locked:** See `core.carinaai.uk/docs/kernel/BRAND_RULES.md` (prompt `carina-kernel/00`).
```

3. Add a "Platform positioning" subsection to `core.carinaai.uk/README.md` (3 sentences max) using the one-sentence positioning from `BRAND_RULES.md`. Do not rename the npm package in this prompt; that is prompt `08`.

4. Search for contradictory copy in `carinaai.uk/index.html` and `docs.carinaai.uk/docs/user/` that says Scout is included free; list findings in a comment at the bottom of `BRAND_RULES.md` under `## Copy audit (YYYY-MM-DD)` without fixing them here (prompts `02` and `03` handle fixes).

## Expected behavior

- Any contributor can read `BRAND_RULES.md` and know what is free, what is paid, and how to name products
- No package renames or site edits beyond README positioning paragraph in this prompt

## Test

- `grep -r "MIT\|Scout.*commercial\|Carina.*free" core.carinaai.uk/docs/kernel/BRAND_RULES.md` returns content from the rules section
- `grep "ABBIS\|Propreneur\|Flitz\|COMPASS" core.carinaai.uk/docs/kernel/BRAND_RULES.md` confirms all four products are listed
- Manual read: README positioning matches `BRAND_RULES.md` one-liner
