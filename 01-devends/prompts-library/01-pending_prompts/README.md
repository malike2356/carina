# Active implementation prompts

**Updated:** 2026-08-08

> **CRITICAL for every coding agent:** When a prompt here is **fully completed** (Done When + validation), archive it immediately to `../02-archived_prompts/archives_from_pending_prompts/` (same relative path). Update this index and the set README. Delete empty folders. Do not leave finished prompts in pending. Do not archive partial or owner-blocked work. Checklist: `../00-library-docs/POST-BUILD-CHECKLIST.md`.

## Open build prompts

| Prompt set | Purpose | Start here |
|---|---|---|
| Keprix-Carina engine switch (Carina side) | C01-C05 completed; README only remains as pointer | `keprix-carina-engine-switch/README.md` |
| VERLOX security assurance programme | Company-wide audits, controls, policies, customer assurance | `/opt/lampp/htdocs/verlox/shared/security-assurance/prompts/README.md` |

Note: Stale pending rows pointing at missing folders were cleaned 2026-08-08. Completed work lives under `02-archived_prompts/archives_from_pending_prompts/` (including `aiva-crm-outreach-workspace-crud/`, `aiva-outreach/`, `aiva-outreach-discovery-funnel/`, `keprix-carina-engine-switch/`).

## Archived (recent)

| Prompt set | Archive path |
|------------|--------------|
| Aiva CRM leads + outreach workspace CRUD | `archives_from_pending_prompts/aiva-crm-outreach-workspace-crud/` |
| Keprix-Carina engine switch C01-C05 | `archives_from_pending_prompts/keprix-carina-engine-switch/` |
| Carina core fix patch (hallucination + session isolation) | `archives_from_pending_prompts/carina-core-fix-patch.md` |
| Aiva / Carina viCal booking (00-09, 12) | `archives_from_pending_prompts/aiva-vical-booking/` |
| Aiva Companies House API (00-05) | `archives_from_pending_prompts/aiva-companies-house-api/` |
| Aiva first impression (never embarrass) | `archives_from_pending_prompts/aiva-first-impression-never-embarrass/` |
| Aiva session persistence | `archives_from_pending_prompts/aiva-session-persistence/` |
| Aiva outreach (Papa Lord phase map; superseded) | `archives_from_pending_prompts/aiva-outreach/` |
| Aiva outreach discovery funnel | `archives_from_pending_prompts/aiva-outreach-discovery-funnel/` |
| Award Must W01-W10 | `archives_from_pending_prompts/07-award-winning/01-must/` |
| AI depth AI01-AI07 | `archives_from_pending_prompts/08-ai-depth/` |
| Outreach funnel O01-O02 | `archives_from_pending_prompts/09-outreach-funnel/` |
| Property Channel / YouTube Channel media | `archives_from_pending_prompts/property-channel-media-pipeline/` |
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
