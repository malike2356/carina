# Propreneur v3: Carina Kernel + Laravel Property OS

Planning hub for **Propreneur v3**: Propreneur runs on the **Carina kernel** with the **property-uk** pack, while **Laravel owns the property OS** (CRM, pipeline, calculators, compliance, billing, tenant DBs).

**Status:** Phase 0 scaffold (2026-07-04)  
**Live v3 app:** `/opt/lampp/htdocs/verlox/propreneur/propreneur-v3/` (forked from v2, prompt 01)  
**Target codebases:**

| Layer | Path |
|-------|------|
| Planning (this folder) | `/opt/lampp/htdocs/verlox/carina/02-backends/proprenuer-v3/` |
| Carina kernel | `/opt/lampp/htdocs/verlox/carina/02-backends/core.carinaai.uk/` |
| Propreneur v3 app | `/opt/lampp/htdocs/verlox/propreneur/propreneur-v3/` (fork from v2) |
| Propreneur v2 (reference) | `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2/` |

Note: this folder is named `proprenuer-v3` (historical typo). Product name is **Propreneur v3**.

## Read first

1. [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) - phases, scope, risks, timeline
2. [SCOPE-PARITY.md](./SCOPE-PARITY.md) - honest v2 vs prompt coverage (read this)
3. [docs/V3-MODULE-ACCEPTANCE.md](./docs/V3-MODULE-ACCEPTANCE.md) - per-module journeys, tests, sign-off matrix
4. [ARCHITECTURE.md](./ARCHITECTURE.md) - runtime diagram, boundaries, contracts
5. [MIGRATION-FROM-V2.md](./MIGRATION-FROM-V2.md) - what carries over unchanged

Execute in order. Start from [prompts/00-overview.md](./prompts/00-overview.md) for the **complete 36-prompt build plan** (phases 0 through E).

### Phase guides (all phases)

| Phase | Guide | Prompts |
|-------|-------|---------|
| 0 Foundation | [phase-0-foundation.md](./prompts/phase-0-foundation.md) | 01-03 |
| 1 Gateway | [phase-1-gateway.md](./prompts/phase-1-gateway.md) | 04, 04b, 05-06 |
| 2 Packs/RAG | [phase-2-packs-rag.md](./prompts/phase-2-packs-rag.md) | 07-09 |
| 3 Tool bridge | [phase-3-tool-bridge.md](./prompts/phase-3-tool-bridge.md) | 10, 10b, 11-14, 14b |
| 4 Strangler | [phase-4-strangler.md](./prompts/phase-4-strangler.md) | 15-18 |
| 5 Spine ship | [phase-5-spine-ship.md](./prompts/phase-5-spine-ship.md) | 19-20 |
| B Scout+core | [phase-b-scout-core.md](./prompts/phase-b-scout-core.md) | 21-23 |
| C Platform+channels | [phase-c-platform-channels.md](./prompts/phase-c-platform-channels.md) | 24-25 |
| D UX+proactive | [phase-d-ux-proactive.md](./prompts/phase-d-ux-proactive.md) | 26-27 |
| E Full ship | [phase-e-full-ship.md](./prompts/phase-e-full-ship.md) | 28-32 |

### All individual prompts

See [prompts/00-overview.md](./prompts/00-overview.md) for the full numbered list (01-32 plus 04b, 10b, 14b).

## Scope

**Read [SCOPE-PARITY.md](./SCOPE-PARITY.md) before starting.** Prompts 01-20 alone do not deliver full v2 parity on carina-core + Scout.

| Block | Prompts | Delivers |
|-------|---------|----------|
| Phase 0-5 | 01-20 (+ 04b, 10b, 14b) | Kernel spine + pilot |
| Phase B-E | 21-32 | Scout, platform, channels, UX, full ship |
| **All phases** | **36 prompt files** | Full Propreneur v3 |

**Timeline:** 16-24 months total (not 9-15 for full v3).

## Relationship to v2 integration work

v2 **federation** (bridge + Remote API) is done and archived under `carina/01-devends/prompts-library/archived/propreneur-integration--*`. v3 **replaces** the PHP agent loop with the Carina kernel sidecar while keeping Laravel as the data plane. Federation remains valid for **Aiva standalone** calling tenant Propreneur until v3 ships.

## Agent workflow

1. Read `IMPLEMENTATION-PLAN.md` and confirm phase scope before coding.
2. Follow `../core.carinaai.uk/CLAUDE.md` for Carina; `propreneur/propreneur-v2/CLAUDE.md` for Laravel rules.
3. Follow `carina/01-devends/prompts-library/docs/REUSE-RULES.md` for user-facing copy.
4. When a prompt is complete, mark `**Status: COMPLETED YYYY-MM-DD**` and move prompts to `prompts/archived/` if desired.

## Validation (after full build)

```bash
# From propreneur-v3 root (when it exists)
docker compose up -d
curl -sk https://xelox.propreneur.test/api/health/carina
php artisan test --filter=CarinaSidecar
cd apps/carina && pnpm test
```
