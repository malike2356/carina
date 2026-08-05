# 01: Pilot workspace tool grants and channels

**Status:** PENDING
**Priority:** P0
**Depends on:** 00
**Unlocks:** 02-13

## Goal

Jakstar can use the full outreach stack without blank replies or missing grants: Gmail (send-from business), Google Calendar, Google Sheets, Google Drive (optional), Trello, Contacts, Telegram, and worker-automation.

## Pilot ids (verify live; do not hardcode secrets)

- Owner login: `jmiah2012@gmail.com` (email + password; Google Sign-In may still be Testing-blocked)
- Send-from target: `admin@salesgridai.com` (Tools → Gmail after OAuth tester list / verification)
- Workspace id (last known): `3d808d19-89bd-4a6e-8fc0-2c4c9a388e11`
- Worker id (last known): `fed38c64-5ccb-4a3f-9abe-067a20ab84b7` (Aiva Jakstar)

## Why

Outreach fails early if Calendar/Gmail show `needs_reauth`, zero grants, or Telegram never connects. First-impression programme covers honesty CTAs; this prompt makes the pilot actually connected.

## Files / surfaces to inspect

- `aiva_worker_tool_grants`, `ai_worker_channels` (ops / SQL on Contabo)
- Cloud Tools UI: `/aiva/tools?tool=gmail`, `google-calendar`, `google-sheets`, `trello`
- Channels UI: Telegram token path
- Core: `conversational-integration-setup.ts`, `product-tool-adapters.ts`, `worker-automation`

## Requirements

1. Document the exact Tools connect order for Jak (screenshot-friendly markdown in this folder or Documents vault seed, first-party copy style clean).
2. Ensure conversational connect intercept covers Gmail, Calendar, Drive, Trello for use-intents (already partially shipped; verify Sheets intent or add).
3. Telegram: Jak creates BotFather bot and pastes token under Jakstar → Channels → Telegram. If a shared Hire Aiva deep-link bot ships later, record it as P1 follow-up (do not block pilot).
4. Gmail grant must be able to send as `admin@salesgridai.com` once OAuth allows that account. Until then: drafts only + clear CTA; never fake-send.
5. Seed a workspace Document: "Jakstar outreach credentials checklist" listing required connects (no secrets).
6. Add founder action checklist for Google Cloud OAuth Test users: `jmiah2012@gmail.com`, `admin@salesgridai.com`, and any other Miah demos.
7. Confirm `worker-automation` is available to Jakstar for cadence jobs.

## Acceptance criteria

- [ ] Jakstar tool grants show connected (or honest needs_reauth CTA) for gmail, google-calendar, google-sheets, trello.
- [ ] Telegram channel enabled + verified after BotFather token paste.
- [ ] Asking "check my calendar" / "send email" never returns blank Unable / fake greeting.
- [ ] Checklist doc exists in vault or this prompt set.

## Deploy

Usually ops/config only. Core deploy only if Sheets conversational connect or checklist tooling code changes.

## Notes

Coordinate with `aiva-first-impression-never-embarrass/10-google-signin-testing-users.md`.
