# Carina Distro Build Prompts

Action prompts for building a product (distro) on top of the Carina kernel using the
install-and-own pattern. The reference distro is ABBIS (`abbis360.com`), but the pattern
applies to any product built on Carina.

## The install-and-own model

A Carina distro is NOT a fork. It is a separate application that:

1. Installs `carina-agent` (or later `@verlox/carina-core`) as a pinned npm dependency
2. Owns all Carina code in its own `node_modules/` - no runtime call to carinaai.uk
3. Runs Carina as a supervised internal service alongside its own API and web UI
4. Gets notified of Carina updates but never auto-updates
5. Degrades gracefully when the Carina service is temporarily unavailable

The distro never shares a Carina instance with other products. ABBIS runs its own Carina.
Eflitz (if it ever integrates Carina) would run its own. Each is pinned to its own version.

## Source documents

| Document | Role |
|----------|------|
| `instructions/install_Carina_Ones_Own_It.md` | Architecture decision record for the install-and-own pattern |
| `core.carinaai.uk/CLAUDE.md` | Carina kernel reference |
| `../carina-kernel/08-split-carina-core-package.md` | Kernel split (prerequisite for clean npm install) |
| `../carina-kernel/13-extract-domain-pack-packages.md` | Pack extraction (prerequisite for borehole-africa npm package) |

## Build order

| # | File | What it builds | Depends on |
|---|------|---------------|------------|
| 00 | `00-distro-workspace-scaffold.md` | ABBIS pnpm monorepo skeleton | None |
| 01 | `01-pin-carina-dependency.md` | Carina pinned in apps/carina with lockfile | 00 |
| 02 | `02-docker-sidecar.md` | Docker Compose with Carina as internal supervised service | 01 |
| 03 | `03-graceful-degradation.md` | ABBIS API health check and AI feature fallback | 01, 02 |
| 04 | `04-version-check-job.md` | Daily BullMQ job to detect Carina updates | 00, 03 |
| 05 | `05-admin-update-ui.md` | Admin dashboard notification and controlled update flow | 04 |
| 06 | `06-borehole-africa-pack-build.md` | Full borehole-africa domain pack (8 skills, corpus, personas) | 01, 02 |
| 07 | `07-abbis-boreholes-module.md` | Borehole projects and TimescaleDB drilling logs | 00, **13** |
| 08 | `08-abbis-crm-module.md` | CRM contacts module | 00, **13** |
| 09 | `09-abbis-jobs-module.md` | Jobs, milestones, and expenses | 07, **13** |
| 10 | `10-abbis-billing-paystack.md` | Invoices and Paystack mobile money | 07, 08, **13** |
| 11 | `11-abbis-association-module.md` | GBDA association module with constitutional rules | 08, **13** |
| 12 | `12-deployment-validation.md` | End-to-end deployment go/no-go checklist | 06-11 |
| 13 | `13-auth-jwt-tenants.md` | JWT auth, tenants, users, requireAuth middleware | 00, 05 |

**Run order note:** Prompt 13 fills a foundation gap. Run it after 05 and before 07-11
when building from scratch. Prompt 12 assumes auth tokens from prompt 13.

## Hard constraints

- No emojis in code, comments, commits, or docs
- No em-dashes or en-dashes anywhere
- Carina code inside ABBIS is a dependency, not a fork; never hand-edit files inside node_modules
- ACTIVE_SKILL_PACKS must always be set; never run the distro's Carina instance with all packs active
- ABBIS IP belongs to Laud Paul-Gablah; Carina kernel IP belongs to VERLOX/verlox.uk; keep the boundary clear in all copyright headers
- The borehole-africa pack is ABBIS-specific; do not publish it from the ABBIS repo without VERLOX coordination

## Validation

```bash
# From ABBIS repo root after running all prompts:
pnpm install
docker compose up -d
pnpm test
curl http://localhost:3000/api/health          # ABBIS API healthy
curl http://localhost:3000/api/health/carina   # Carina sidecar healthy
```
