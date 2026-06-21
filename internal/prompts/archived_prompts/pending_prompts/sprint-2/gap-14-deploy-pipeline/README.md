# Gap 14 - Deploy Pipeline Alignment

**Status: COMPLETED 2026-06-21**

**Gap:** 14 CI/CD and Dev-to-Prod Pipeline
**Sprint:** 2
**Goal:** Wire the full development cycle end-to-end: local dev -> git push -> GitHub Actions CI -> auto-deploy to VPS. Also make the stack portable to any server (VPS or AWS EC2) with a single bootstrap script.

**Primary agent:** Claude Code
**Estimated total hours:** 3-5 h across 3 prompts
**Risk level:** Low. All changes are additive; no live services are touched.

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Current state (as of 2026-06-21)

### What exists

- `scripts/deploy-carina.sh` - rsync + SSH deploy; works when run manually from a dev machine
- `.github/workflows/ci.yml` - runs tests on Linux/Windows/macOS on push; NO deploy step
- `.github/workflows/release.yml` - builds Windows installer on `v*` tags
- `.github/workflows/publish.yml` - publishes to npm on GitHub Release
- `docker-compose.prod.yml` (Carina) + `docker-compose.prod.yml` (Scout) - fully Dockerised stacks
- `docker/DEPLOY.md` - authoritative deploy runbook

### What is missing

1. No GitHub Actions deploy job: every deploy requires a developer to manually run `deploy-carina.sh` from their machine. If the dev machine is offline or a contributor pushes, nothing goes to prod.

2. No new-server bootstrap script: moving to a new VPS or AWS EC2 requires manually running a dozen steps. The Docker setup is theoretically portable but has no one-command bootstrap.

3. No dev environment alignment doc: new contributors or a second agent do not know how local dev maps to prod (which ports, which services, what .env vars differ).

---

## Prompt inventory

```
gap-14-deploy-pipeline/
├── README.md                   (this file)
├── 01-github-actions-deploy.md  Add deploy job to CI; workflow_dispatch + auto on main
├── 02-server-bootstrap.md       One-script new-server setup (VPS or AWS EC2)
└── 03-dev-env-alignment.md      Local dev guide: what maps to what in prod
```

---

## Dev-to-prod flow target

```
Dev machine:
  pnpm dev / docker compose up (local stack on ports 3000, 3001, 4001, 4100, 4444)

Git push to main:
  GitHub Actions CI:
    1. test-linux (pnpm test)
    2. On success: deploy job (SSH to VPS, run docker/scripts/deploy-prod.sh + Scout compose up)

VPS / Prod:
  Docker Compose stacks - carina + scout - served via Dockerised nginx
  Certbot renews TLS certs on host, nginx reads via bind mount
```

---

## Execution order

Run prompts in order: 01 first (CI deploy job), then 02 (bootstrap), then 03 (dev guide).
Prompts 02 and 03 are independent and can run in parallel after 01.
