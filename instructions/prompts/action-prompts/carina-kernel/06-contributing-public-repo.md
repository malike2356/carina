# Carina Kernel Phase 1: CONTRIBUTING.md for public repo

## Goal

Write a contributor-ready `CONTRIBUTING.md` for the public `carina-agent` export with clear setup, test commands, and contribution areas aligned to the kernel model.

## Context

- Public export process: `instructions/strategy/PUBLIC_REPOSITORY.md`
- Export script: `scripts/export-carina-core-public.sh` (verify path exists)
- Existing tests: `cd core.carinaai.uk && pnpm test` (5,000+ Vitest tests)
- Brand/kernel scope: tools, memory, channels, packs; not Scout server or ops panel
- Target public repo: `malike2356/carina-agent`

## Dependencies

`00-lock-brand-and-boundaries.md`

## Files to create

- `core.carinaai.uk/CONTRIBUTING.md` (source; exported to public repo)
- `core.carinaai.uk/.github/PULL_REQUEST_TEMPLATE.md` (optional but recommended)
- `core.carinaai.uk/.github/ISSUE_TEMPLATE/bug_report.yml`
- `core.carinaai.uk/.github/ISSUE_TEMPLATE/feature_request.yml`

## Files to modify

- `scripts/public-repo/.public-exportignore` or export script (ensure `.github/` and `CONTRIBUTING.md` are included)
- `core.carinaai.uk/README.md` (link to CONTRIBUTING.md)

## Step-by-step

1. Write `core.carinaai.uk/CONTRIBUTING.md` with sections:

   - **Welcome**: Carina is the MIT kernel; thank you for contributing
   - **What to contribute**: tools, channel adapters, domain packs, docs, tests; what NOT to contribute (Scout server secrets, ops panel)
   - **Dev setup**:

     ```bash
     git clone https://github.com/malike2356/carina-agent.git
     cd carina-agent
     pnpm install
     cp .env.example .env
     pnpm build
     pnpm test
     pnpm carina --help
     ```

   - **Code style**: TypeScript ESM, 2-space indent, no emojis, no em-dashes, Vitest for tests
   - **Pull request process**: fork, branch, test, one concern per PR
   - **Domain packs**: point to future tutorial doc path `docs.carinaai.uk/docs/developer/first-domain-pack.md`
   - **Security**: link to `SECURITY.md`
   - **Community**: GitHub Discussions (enable on repo when live), Discord link placeholder `TBD`

2. Add PR template requiring:
   - Summary
   - Test commands run
   - Affected area (core / pack / docs / channel)

3. Add issue templates with labels suggestion: `good first issue`, `help wanted`, `pack`, `tool`, `channel`

4. Ensure export script copies `.github/` and `CONTRIBUTING.md`; update export ignore if needed.

5. README link: `See [CONTRIBUTING.md](CONTRIBUTING.md) to develop on the kernel.`

## Expected behavior

- New contributor can clone, test, and open a PR without asking VERLOX for private monorepo access
- Scope boundaries keep Scout/ops out of public contributions

## Test

- `test -f core.carinaai.uk/CONTRIBUTING.md`
- Run export script dry path or grep export include list for CONTRIBUTING.md
- Follow CONTRIBUTING setup steps locally; `pnpm test` passes
