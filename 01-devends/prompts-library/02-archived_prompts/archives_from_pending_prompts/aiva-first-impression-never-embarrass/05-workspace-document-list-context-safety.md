# 05: Workspace Documents list context-safety regression lock

**Status:** PENDING (mostly shipped; lock + harden)
**Priority:** P0
**Depends on:** 00
**Unlocks:** 07, 09

## Goal

Never again truncate the Documents vault tool context so Aiva claims pitch/DBA materials are missing when the UI shows them.

## Why

lordsesame Documents showed 11 files including full DBA pack; chat claimed only one research doc because `workspace-document-list` returned full HTML bodies.

## Already shipped (verify, do not regress)

- Internal GET `/api/internal/documents` list returns metadata only; `?id=` returns full body
- Core `listWorkspaceDocuments` / `getWorkspaceDocument`
- Tool `workspace-document-list` slim + `workspace-document-get`
- Mandatory tools rule `workspace_document_drive_import` prefers list then get then Drive

## Requirements

1. Add/extend Vitest proving list payloads exclude `content` field and include titles for N synthetic large docs.
2. Add regression test that `workspace-document-get` returns body for an id.
3. Confirm mandatory-tools guidance still forbids "materials missing" when list returned matching titles.
4. Optional: list endpoint may include `chars` / short `preview` via SQL truncate without shipping full HTML to the model.
5. Document operator retest prompt in 09 (DBA November readiness).

## Acceptance criteria

- [ ] Tests fail if someone reverts list to `select()` full rows without a guard.
- [ ] Prod smoke: lordsesame/list returns all DBA titles without content keys.

## Deploy

Only if new hardening needed; otherwise verify on prod and tick.

## Out of scope

Drive grants per worker (separate; covered under 03 for honesty).
