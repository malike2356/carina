---
id: 2026-07-18_aiva_ops-drive-open-edit-write-through
title: Ops Drive Open in Aiva with Drive write-through
product: aiva
capability: drive-documents-sync
status: archived
created: 2026-07-18
depends_on:
  - aiva-ops-drive-folder-browser.md
  - aiva-open-in-aiva-ops-docs-fix.md
tags:
  - aiva
  - ui
  - google-drive
  - workspace-ops
  - documents
  - two-way-sync
---

## Status: BUILT

Claim/pull Open in Aiva for Ops Drive Docs with write-through save. Deployed with mobile APK 0.1.9.

# Prompt: Open and edit Ops Drive Docs in Aiva (Drive stays backup)

## Mission

Under the Ops pack only, let operators open Google Docs / plain text from the folder browser in Aiva’s editor, edit there, and always write through to Drive on save. Drive remains the durable backup if Aiva is offline.

## Product rules (hard)

1. Scope: bound Ops pack tree only (same allowlist as browse). Not all of My Drive.
2. Best UX first: Google Docs + plain text / markdown / csv. Non-indexable types stay Open in Drive (or stub `drive_only`).
3. Safest backup: every Aiva save pushes to Drive immediately (existing `markDocumentPendingAndPush` / `updateGoogleDocText`). Never Aiva-only.
4. Conflicts: Aiva is primary for ops docs; Drive edits are occasional. On pull/claim, use last-writer-wins by timestamp (already in sync-engine). Surface a short notice when Drive was newer and overwrote local.
5. Offline Aiva: keep Open in Drive on every file row.
6. Writing style: no em dashes, no en dashes, no emojis.
7. Stripe: do not create prices; do not paste secrets.

## Current state (do not regress)

- Browse shows live Drive children; unmapped files show `drive_only` with Open in Drive only.
- Open in Aiva only when `mapping.aivaDocumentId` exists.
- Editor `/documents/ops/[id]` load/save/delete already write-through when mapped.
- Sync bulk-pull only lists category folder roots, not month subfolders (browse can see deeper).

## Required work

### Backend

1. Export/wrap `upsertFromDriveFile` as `claimDriveFileIntoAiva({ workspaceId, workerId, driveFileId })`:
   - Resolve token, `getDriveFile`, verify folder is inside Ops tree (`isFolderAllowedInOpsTree` / parent walk).
   - Infer category from nearest mapped category parent (else `inbox`).
   - Run upsert/pull logic; return `{ aivaDocumentId, syncStatus, title, driveNewer?: boolean }`.
2. `POST /api/aiva/workspace-ops/documents/claim` with `{ workerId, driveFileId }`.
3. Cloud Next proxy for claim.

### Frontend

1. In Ops folder browser file rows without `aivaDocumentId`: **Open in Aiva** calls claim, then navigates to `/documents/ops/{id}?workerId=...`.
2. If already mapped: keep Link; optional quiet re-claim/refresh before open is nice-to-have, not required.
3. Loading / error states on the row or toast.
4. Editor: if save push fails, show error; do not pretend Drive is updated.

### Tests

- Unit/API test for claim: allowlisted file creates mapping + knowledge; outside Ops tree rejected.
- Keep existing ops editor save path tests if present.

### Ship

- Archive this prompt when built.
- Commit, push, deploy core + cloud.
- Rebuild / publish mobile APK + `latest-mobile.json` so in-app update sees the release (even if this feature is web-first; keep APK pipeline current).

## Done when

1. From Ops browse under a month/category folder, Open in Aiva on a Google Doc opens the workspace editor with content.
2. Editing and saving in Aiva updates the same Drive Doc (verify via Open in Drive).
3. Unmapped → claim → mapped without requiring full Sync first.
4. Non-text files still Open in Drive.
5. Prompt archived; commit/push/deploy/APK done.
