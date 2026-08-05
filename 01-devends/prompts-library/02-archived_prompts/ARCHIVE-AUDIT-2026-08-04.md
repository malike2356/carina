# Archived prompt folder audit

Date: 2026-08-04

Method:

- I used the folder level README or canonical master doc where present.
- I treated explicit `Remaining open work`, `PENDING`, or `Open:` sections as unfinished.
- I did not treat stale template lines inside an otherwise completed pack as a blocker if the top level status and built summary were clearly complete.

## Fully built

- `_reference`
- `aiva-first-impression-never-embarrass`
- `aiva-session-persistence`
- `aiva-workspace`
- `gtm-readiness`
- `incident-blog-automation`
- `legal`
- `ops-hardening`
- `pricing`
- `property-channel-media-pipeline`
- `propreneur-carina`
- `propreneur-integration`
- `rag-upload`
- `scout-channel-kill`
- `scout-pilot-readiness`
- `scout-prompts`
- `security-patches`
- `security-tooling`
- `self-config`
- `self-improving-learning-loop`
- `slash-commands`
- `sprint-2`
- `sprint-5`
- `sprint-6-claude-tag`
- `sprint-6-research`
- `sprint-7`
- `sso`

## Partially built

- `09-outreach-funnel` - O01-O06 shipped, O07 is still optional.
- `aiva-outreach` - superseded by the newer funnel packs; not a live blocker, but not a finished canonical pack.
- `scout-bundling` - core bundling work shipped, but a seat-price SoT item still remains in launch readiness.

## Still needs follow-up

- `04-system` - canonical README says remaining pending, with FHIR, NHS CIS SSO, and DCB0129 still partial.
- `05-cathedral` - canonical README says remaining pending, including an external audit item.
- `06-hci-full-roadmap` - canonical README says only incomplete HCI prompts remain.
- `07-award-winning` - canonical README says must is archived, but Nice, Amplify, and Deferred still remain.
- `08-ai-depth` - canonical README says AI08 eval and AI09 cutover switchbook are still open.
- `aiva-companies-house-api` - canonical README still lists person lookup and outreach ingest follow-up.
- `aiva-outreach-discovery-funnel` - canonical README is still PENDING.
- `launch` - empty placeholder folder.
- `prompts-library` - empty placeholder folder.
- `sprint-4` - master doc still says there are pending prompts left in the sprint.
- `sprint-6` - phase 2 writes and IMAP poller were deferred, so the sprint is not fully closed.

## Notes

- `scout-pilot-readiness`, `ops-hardening`, and other packs with stale `PENDING` text inside the body were still treated as fully built when the top summary said completed and the built list was explicit.
- `aiva-first-impression-never-embarrass` is fully built even though it keeps founder follow-ups that do not block archive status.

