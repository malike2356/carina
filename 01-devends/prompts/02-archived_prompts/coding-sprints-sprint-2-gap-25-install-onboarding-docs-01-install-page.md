**Status: COMPLETED 2026-06-21**


# Gap 25 - Prompt 01: Install Page

**Gap:** 25 Documentation: Install, Onboarding & Quickstart
**Prompt number:** 01 of 03
**Name:** Write `docs/user/install.md` -- curl, npm, Docker install paths
**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 1 h
**Depends on:** Nothing

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `marketing/docs/docs.carinaai.uk/docs/user/getting-started.md` -- current entry point
2. `marketing/docs/docs.carinaai.uk/sidebars.ts` -- user sidebar structure
3. `internal/servers/core.carinaai.uk/package.json` -- package name, bin entries
4. `docker/Dockerfile.runtime` -- Docker install path

---

## Goal

Write `marketing/docs/docs.carinaai.uk/docs/user/install.md`.

This page must cover every install path a user might take:

### Structure

```markdown
# Install Carina

## Prerequisites
- Node.js 22+ (recommended: Node 24)
- An API key from your chosen model provider
- 5 minutes

## Option 1: Quick Install (macOS, Linux)
curl -fsSL https://get.carinaai.uk | bash

(Explain: what it does, where it installs, verification step)
(carina --version to verify)

## Option 2: npm
npm install -g @verlox/carina

(Explain: global install, requires Node.js, verification step)

## Option 3: Docker
docker pull ghcr.io/verlox/carina:latest
docker run -d -p 3333:3333 -v ~/.carina:/home/node/.carina \
  -e CARINA_API_KEY=your-key \
  ghcr.io/verlox/carina:latest

(Explain: Docker install, volume mounts, env vars, verification via carina status)

## Option 4: Build from Source
git clone https://github.com/verlox/carina.git
cd carina/internal/servers/core.carinaai.uk
pnpm install
pnpm build
pnpm link --global

(Explain: for contributors, requires pnpm, TypeScript compilation)

## Verification
carina --version
carina doctor

## Next Steps
- [Onboarding guide](/docs/user/onboarding)
- [Quickstart: macOS](/docs/user/quickstart/macos)
- [Configuration reference](/docs/user/configuration)
```

### Key rules
- Every install path includes a verification command
- Docker path includes the minimum env vars to get running
- npm path is the stable recommendation for developers
- curl path is the one-liner for evaluation
- Cross-link to onboarding and platform quickstarts
- No emojis, no em/en dashes

---

## Sidebar update

In `sidebars.ts`, add `'user/install'` before `'user/getting-started'` in the
"Getting started" category.

---

## Existing Carina files to reference

- `README.md` (repo root) -- install paths mentioned in Quick Start section
- `AGENTS.md` -- build/test/dev commands
- `docs/DEPLOYMENT-GUIDE.md` -- Docker deploy path
- `internal/servers/core.carinaai.uk/package.json` -- package metadata
