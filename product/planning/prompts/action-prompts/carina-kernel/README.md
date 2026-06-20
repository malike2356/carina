# Carina Kernel Build Prompts

Action prompts to execute the "Carina as the Linux kernel for AI agents" plan in `CARINA_AS_LINUX.md` (14 June 2026).

Each file is a self-contained Cursor task. Run in numeric order unless a prompt says otherwise.

## Source documents

| Document | Role |
|----------|------|
| `CARINA_AS_LINUX.md` | Master strategy (repo root) |
| `instructions/strategy/Carin_AI_OS.md` | Earlier Agent OS vision (reference) |
| `instructions/strategy/PUBLIC_REPOSITORY.md` | Public export rules for `carina-agent` |

## Related prompts (run before or alongside Phase 2)

These predate the kernel plan but cover overlapping work:

| Path | Status |
|------|--------|
| `phase2-gap-closure/01-carina-core-gaps/01-cli-packaging.md` | Open; run before `08` |
| `phase2-gap-closure/01-carina-core-gaps/02-provider-switching.md` | Open |
| `phase2-gap-closure/01-carina-core-gaps/03-multi-channel.md` | Open |
| `phase3-skills/06-domain-pack-system.md` | DONE |
| `phase2-gap-closure/05-website-promises/02-skill-packs-installable.md` | Open; complements `10` and `11` |
| `action-prompts/carina-ops/` | Carina Ops SaaS (commercial layer; separate track) |

## Build order

| # | File | Phase | Depends on |
|---|------|-------|------------|
| 00 | `00-lock-brand-and-boundaries.md` | 1 | None |
| 01 | `01-manifesto.md` | 1 | 00 |
| 02 | `02-landing-hero-kernel-positioning.md` | 1 | 00, 01 |
| 03 | `03-pricing-boundary-carina-free-scout-paid.md` | 1 | 00 |
| 04 | `04-powered-by-carina-showcase.md` | 1 | 00, 02 |
| 05 | `05-brand-hierarchy-diagram.md` | 1 | 00 |
| 06 | `06-contributing-public-repo.md` | 1 | 00 |
| 07 | `07-github-good-first-issues.md` | 1 | 06 |
| 08 | `08-split-carina-core-package.md` | 2 | 00, phase2 `01-cli-packaging` |
| 09 | `09-stable-public-api-semver.md` | 2 | 08 |
| 10 | `10-hub-pack-cli-commands.md` | 2 | 08, 09 |
| 11 | `11-hub-carinaai-uk-site.md` | 2 | 10 |
| 12 | `12-extract-carina-web-package.md` | 2 | 08 |
| 13 | `13-extract-domain-pack-packages.md` | 2 | 08, 09 |
| 14 | `14-scout-ops-commercial-boundaries.md` | 2 | 00, 08 |
| 15 | `15-rfc-and-community-infra.md` | 3 | 06, 09 |
| 16 | `16-first-domain-pack-tutorial.md` | 3 | 09, 10 |
| 17 | `17-university-partnership-kit.md` | 3 | 01, 16 |
| 18 | `18-case-study-pages.md` | 3 | 04 |
| 19 | `19-carina-cloud-one-click.md` | 4 | carina-ops sprint 5+ or hosted mode |
| 20 | `20-carina-enterprise-offering.md` | 4 | 03, 18 |
| 21 | `21-premium-pack-marketplace.md` | 4 | 11, 13 |
| 22 | `22-built-on-carina-partner-program.md` | 4 | 04, 18, 20 |

## Hard constraints

- No emojis in code, comments, commits, or docs
- No em-dashes or en-dashes anywhere
- Carina core stays MIT; Scout stays commercial
- Never commit secrets, `.env`, or VPS credentials
- Run `python3 ../scripts/fix-writing-style.py` from repo root after bulk markdown edits
- ABBIS (`abbis360.com`) is the first Africa distro built on Carina; `borehole-africa` domain pack is its kernel dependency. Prompt `13` covers pack extraction; pack source material lives at `/opt/lampp/htdocs/verlox/abbis/`.

## Validation commands

```bash
cd core.carinaai.uk && pnpm test && pnpm build
cd docs.carinaai.uk && pnpm build
bash scripts/deploy-marketing.sh   # carinaai.uk static site only; dry-run first if unsure
```
