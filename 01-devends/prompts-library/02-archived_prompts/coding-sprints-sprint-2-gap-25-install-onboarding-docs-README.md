**Status: COMPLETED 2026-06-23 (re-verified)**

**What was built:**
- `frontends/marketing/docs.carinaai.uk/docs/user/install.md`
- `frontends/marketing/docs.carinaai.uk/docs/user/onboarding.md`
- `frontends/marketing/docs.carinaai.uk/docs/user/quickstart/{macos,linux,windows}.md`
- Sidebar entries under Getting started in `sidebars.ts`
- `pnpm build` passes (verified 2026-06-23)


# Gap 25 - Documentation: Install, Onboarding & Quickstart

**Gap:** 25
**Sprint:** 2
**Type:** Documentation
**Source:** OpenClaw docs (Install, Onboarding overview, Getting started pages)
**Target dir:** `marketing/docs/docs.carinaai.uk/docs/`
**Goal:** Write the missing install, onboarding, and quickstart documentation
  pages for docs.carinaai.uk. Carina's Docusaurus site has a "getting-started"
  page but no standalone install guide, no onboarding walkthrough, and no
  platform-specific setup instructions.

**Primary agent:** Claude Code (docs writing -- no code changes needed)
**Estimated hours:** 3-4 h total

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Context

OpenClaw's docs have dedicated pages for:
- Install: `curl -fsSL https://openclaw.ai/install.sh | bash` + Docker, Nix, npm alternatives
- Onboarding overview: concept + what to expect
- Onboarding (CLI): guided `openclaw onboard` walkthrough
- Onboarding (macOS app): GUI onboarding flow
- Personal assistant setup: configuring for daily use
- CLI setup reference: full CLI-first configuration
- CLI automation: cron, scheduled tasks via CLI

Carina has a single `user/getting-started.md` page that covers the basics
but lacks depth. There is no install page, no platform-specific setup, no
onboarding walkthrough, and no quickstart for developers who want a
5-minute agent.

---

## Build Order

```
01-install-page.md          Write docs/user/install.md
02-onboarding-walkthrough.md  Write docs/user/onboarding.md
03-platform-quickstarts.md    Write docs/user/quickstart/ (macOS, Linux, Windows)
```

Carina's docs use Docusaurus. All new pages go under
`marketing/docs/docs.carinaai.uk/docs/`. Sidebar updates go in
`marketing/docs/docs.carinaai.uk/sidebars.ts`.

---

## Carina's Voice (reminder for all prompts)

- Use Carina's own terminology: "skill packs" not "skills", "gateway" not
  "bridge", "Scout" not "doctor", "Carina Hub" not "ClawHub"
- No competitor names in docs (no "Hermes", "OpenClaw", "Odysseus")
- Security-first framing: every doc naturally surfaces Carina's security
- No emojis, no em/en dashes
- Practical, command-first style. Show the command, then explain it.
- Reference real paths from the monorepo (AGENTS.md, README.md)

---

## Done When

- [x] `docs/user/install.md` -- curl/npm/Docker install paths with verification
- [x] `docs/user/onboarding.md` -- step-by-step CLI walkthrough (text; UI screenshots deferred)
- [x] `docs/user/quickstart/macos.md` -- macOS-specific from curl to first message
- [x] `docs/user/quickstart/linux.md` -- Linux-specific (systemd, headless)
- [x] `docs/user/quickstart/windows.md` -- Windows-specific (WSL, PowerShell)
- [x] Sidebar updated in `sidebars.ts` with new pages
- [x] All pages pass `pnpm build` in the Docusaurus project
