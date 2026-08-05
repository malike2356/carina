# Active implementation prompts

**Updated:** 2026-08-04

> **CRITICAL for every coding agent:** When a prompt here is **fully completed** (Done When + validation), archive it immediately to `../02-archived_prompts/archives_from_pending_prompts/` (same relative path). Update this index and the set README. Delete empty folders. Do not leave finished prompts in pending. Do not archive partial or owner-blocked work. Checklist: `../00-library-docs/POST-BUILD-CHECKLIST.md`.

## Open build prompts

| Prompt set | Purpose | Start here |
|---|---|---|
| Carina / Aiva adopt Keprix strengths (parity) | MCP, subagents, TUI/client, voice, vector memory, browser tools, introspection, upgrade lifecycle | `carina-keprix-parity/README.md` (start at `00`) |
| Aiva / Carina adopt viCal booking | P0 engine shipped; only optional 10 intake + 11 deposits remain | `aiva-vical-booking/README.md` (10/11 only; `00-09`/`12` archived) |
| Aiva outreach discovery funnel | Hands-free scrape to cold email to reply to discovery Zoom book to prep video to reminders to Kanban to follow-ups (Jakstar pilot) | `aiva-outreach-discovery-funnel/README.md` (start at `01` after reading `00`; booking prompts 05/07 should consume `aiva-vical-booking`) |
| Aiva Companies House API (remaining) | Person lookup also hits CH officers (P0 client/tools archived) | `aiva-companies-house-api/README.md` (start at `06`) |
| Clinicom Phase 04 system | FHIR, CIS, DCB0129 and related system prompts (partial / owner-blocked) | `04-system/README.md` |
| Clinicom Phase 05 cathedral | Cathedral programme remnants | `05-cathedral/README.md` |
| Clinicom Phase 06 HCI roadmap | Must + advanced HCI prompts still open | `06-hci-full-roadmap/README.md` |
| Clinicom Phase 07 award (Nice / Amplify / Deferred) | W01-W10 archived; continue N*, AMP*, D* | `07-award-winning/README.md` |
| Clinicom Phase 08 AI depth | AI01-AI07 archived; open AI08 eval + AI09 cutover | `08-ai-depth/README.md` (start at `ai08`) |
| Clinicom / Aiva Phase 09 outreach funnel | O01-O02 archived; open O03-O07 | `09-outreach-funnel/README.md` (start at `o03`) |
| VERLOX security assurance programme | Company-wide audits, controls, policies, customer assurance | `/opt/lampp/htdocs/verlox/shared/security-assurance/prompts/README.md` |

Status index for older Clinicom phases: `PHASES-02-05-STATUS.md`

Completed work lives under:

`01-devends/prompts-library/02-archived_prompts/archives_from_pending_prompts/`

## Archived (recent)

| Prompt set | Archive path |
|------------|--------------|
| Aiva / Carina viCal booking (00-09, 12) | `archives_from_pending_prompts/aiva-vical-booking/` |
| Aiva Companies House API (00-05) | `archives_from_pending_prompts/aiva-companies-house-api/` |
| Aiva first impression (never embarrass) | `archives_from_pending_prompts/aiva-first-impression-never-embarrass/` |
| Aiva session persistence | `archives_from_pending_prompts/aiva-session-persistence/` |
| Aiva outreach (Papa Lord phase map; superseded) | `archives_from_pending_prompts/aiva-outreach/` |
| Award Must W01-W10 | `archives_from_pending_prompts/07-award-winning/01-must/` |
| AI depth AI01-AI07 | `archives_from_pending_prompts/08-ai-depth/` |
| Outreach funnel O01-O02 | `archives_from_pending_prompts/09-outreach-funnel/` |
| Property Channel / YouTube Channel media (04 + A + B + C) | `archives_from_pending_prompts/property-channel-media-pipeline/` |
| Carina self-improving learning loop | `archives_from_pending_prompts/self-improving-learning-loop/` |
| Incident blog automation | `archives_from_pending_prompts/incident-blog-automation/` |
| scout-channel-kill | `archives_from_pending_prompts/scout-channel-kill/` |
| scout-pilot-readiness/* | `archives_from_pending_prompts/scout-pilot-readiness/` |
| scout-prompts (SaaS 01-06) | `archives_from_pending_prompts/scout-prompts/` |
| aiva-workspace | `archives_from_pending_prompts/aiva-workspace/` |
| ops-hardening | `archives_from_pending_prompts/ops-hardening/` |

## Still blocked on founder action

1. Choose SaaS host (recommend `gate.labyrinthscout.com`; do not replace live console).
2. Stripe test keys + webhook on that host.
3. Create Telegram bot (BotFather) + webhook URL when channel-kill ships.
4. Keep Carina Scout on legacy `console.labyrinthscout.com` until a migration prompt says otherwise.
5. YouTube Channel Phase B/C shipped 2026-08-04; keep Contabo smoke for first scheduled private upload.
6. Aiva first impression follow-ups: reconnect Selorm Gmail/Drive; optional Salim courtesy retest; add Google OAuth Test users (see archived prompt `10`).
7. Aiva outreach funnel: Jak connects Telegram (BotFather); add Google OAuth test users for `jmiah2012@gmail.com` and `admin@salesgridai.com`; Jak publishes prep YouTube URL when ready.
8. Companies House person-lookup smoke: confirm labelled Contacts + CH sections on a real find-person turn (`aiva-companies-house-api/06`). API key + grants already live.

New build work: add a prompt folder here, implement, then archive via POST-BUILD-CHECKLIST. Do not leave completed prompts or empty folders in this directory.
