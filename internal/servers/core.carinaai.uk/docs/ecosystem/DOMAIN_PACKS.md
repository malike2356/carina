# Third-party domain pack ecosystem

Authors publish vertical knowledge and skills on Carina Hub without forking the kernel.

## Author workflow

```bash
# 1. Scaffold
carina hub author init fleet-uk \
  --author "Fleetz Ltd" \
  --description "UK fleet compliance and contracts" \
  --category fleet

# 2. Edit knowledge/*.md and skills.json

# 3. Validate locally (hub publish runs validatePackDir + skill lint)
carina hub publish ./packs/fleet-uk

# 4. List on hub
carina hub catalog --kind pack --q fleet
```

Scaffold creates: `pack.json`, `skills.json`, `knowledge/00-overview.md`, `marketplace.json`, `README.md`.

## Requirements

- `pack.json`: name (kebab-case), version, description, **author** (required for ecosystem listing)
- At least one `.md` knowledge file; no `.env` files in archive
- Skills: name, description, triggers, steps (linted via `skill-lint`)
- No API keys or passwords in markdown (hub scanner rejects common patterns)

## Marketplace entry

`marketplace.json` in the pack directory maps to Hub `hub_marketplace_entries`. Community publishes start as `validation: pending` until review.

## Premium packs

Set pricing in hub DB / pack metadata; checkout via `POST /api/packs/:name/checkout` (Stripe). License validation: `GET /api/packs/:name/license/validate`.

**Status:** Stripe path shipped in hub module; production keys are deployment-specific.

## Install

```bash
carina hub install pack:fleet-uk
# or
carina pack install fleet-uk
```

## Cross-agent learning

Skills learned while a pack is active can propagate to other workspace agents (`carina learning shared`). Export to hub: `carina learning share --publish`.

## Certification

Pack publishers may also certify their **product** (not just the pack) with `carina certify built-on` if they ship a distro layer.

## Honest status

| Capability | Status |
|------------|--------|
| Author scaffold + publish | complete |
| Hub browse + install | complete |
| Premium Stripe checkout | partial (needs production Stripe) |
| Automated verified badge | partial (manual review) |
| npm `@verlox/pack-*` publish | roadmap (use hub tarball today) |
