# GTM 002: Fix Carina self-hosted install flow

**Sprint:** GTM readiness
**Prompt number:** 02 of 04
**Name:** Fix the self-hosted install path so it works end to end for a new user
**Primary agent:** Cursor / Claude Code
**Estimated hours:** 2-3 h
**Depends on:** GTM-001 (install.sh must be deployed to install.carinaai.uk before this is verifiable end to end)

**Status:** COMPLETED (already implemented; verified 2026-06-25)

---

## Acceptance criteria

- [x] SELF_HOSTED.md has no `git clone github.com/carina-ai/carina` reference
- [x] install.sh post-install output has no `docker-compose.standalone.yml` command
- [x] `carinaai.uk/install` loads a clean install page
- [x] The one-liner `curl -fsSL https://install.carinaai.uk | sh` is shown prominently on the install page
- [x] The main marketing site and pricing page CTA for Carina Core points to `/install`
- [x] No broken links on any edited page (GitHub links use `malike2356/carina-agent`, not the 404 `carina-ai/carina` repo)
- [x] No em dashes, no emojis in any file

## Verification note

Codebase review 2026-06-25. No new implementation required; all four parts were already in place:

| Part | File | Status |
|------|------|--------|
| 1 | `carina/SELF_HOSTED.md` | npm quickstart only; no broken git clone |
| 2 | `carina/02-backends/core.carinaai.uk/install.sh` | Node 22 check, npm install, docs links; no docker compose command in output |
| 3 | `carina/03-frontends/marketing/carinaai.uk/install/index.html` | Full install page with one-liner, npm alt, 3 steps, requirements, copy buttons |
| 4 | `carina/03-frontends/marketing/carinaai.uk/index.html` + `pricing/index.html` | Hero and CTA sections link to `/install`; pricing "Build with Carina" track has "Install Carina" button |

GTM-001 deploy pipeline syncs `install.sh` to `install.carinaai.uk` via `scripts/deploy-carina.sh`.

**Out of scope (not part of this prompt):** `docs.carinaai.uk/docs/user/self-hosting.md` and `quickstart/linux.md` still reference `github.com/carina-ai/carina`; fix separately if needed.

---

## Do not touch

- Aiva pricing or CTAs
- Scout marketing or console
- Any backend code
- `.env` files
