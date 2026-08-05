# Incident blog automation implementation map

**Updated:** 2026-07-28

## Current code anchors

| Stage | Existing code to anchor on | Missing or weak points |
|---|---|---|
| 01 discovery audit | `carina/02-backends/core.carinaai.uk/src/blog/research-runner.ts` | Implemented broader query coverage and multi-source curation |
| 02 source expansion | `carina/02-backends/core.carinaai.uk/src/blog/research-filters.ts` | Implemented broader incident vocabulary and source parsing |
| 03 approval policy | `carina/02-backends/core.carinaai.uk/src/api/incident-blog.ts` and `src/blog/store.ts` | Implemented configurable auto-approve and auto-publish policy |
| 04 subscriber dispatch | `carina/02-backends/core.carinaai.uk/src/blog/newsletter-send.ts` | Publish-trigger newsletter dispatch is now wired |
| 05 admin controls | `carina/03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/settings/page.tsx` | Incident blog automation settings are exposed in the UI |
| 06 scheduled execution | `carina/02-backends/core.carinaai.uk/src/index.ts` and `src/agents/checks/incident-research-check.ts` | Scheduled research now obeys the enable switch |

## Target behavior

- Find new incidents without depending on one fixed query set
- Keep drafts source-backed and deduplicated
- Allow ops to decide whether a draft is auto-approved, auto-published, or manual
- Notify confirmed subscribers automatically after publish if enabled
- Keep all automation visible in settings and logs

## Recommended workflow shape

1. discovery job runs on schedule
2. candidate incidents are curated and stored as drafts
3. policy decides whether the draft is auto-approved
4. publishing can be manual or automatic, depending on policy
5. newsletter dispatch follows publish, digest, or both
