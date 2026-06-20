# Sprint 2 - Category 09: Skills Hub

## What Exists

- `src/skills/` - 16 skill packs, 96 curated skills
- `src/skills/hub.ts` - Hub server scaffold
- `pnpm hub` starts a hub server (port TBD)
- Skill auto-writer and curator in `src/skills/`

## What Is Missing

- Security scanner for skills (checks for prompt injection, dangerous imports)
- Peer review system (approve/reject skills submitted by others)
- Public marketplace website (browse, install, rate skills)
- CLI publish commands (`carina skills publish`, `carina skills submit`)
- Hub deployment config (separate Docker service, own domain skills.carinaai.uk)

## Prompts in This Category

- `01-security-scanner.md` - Static analysis for skills: detect injection patterns, dangerous calls
- `02-peer-review.md` - Approval queue in ops admin, reviewer roles, review comments
- `03-marketplace-website.md` - Public skills.carinaai.uk with browse, search, install, ratings
- `04-cli-publish.md` - `carina skills publish` and `carina skills submit` commands
- `05-hub-deployment.md` - Docker service for hub, nginx vhost, CORS, skills.carinaai.uk domain

## Original Reference

`sprint-2/gap-02-carina-hub/`
