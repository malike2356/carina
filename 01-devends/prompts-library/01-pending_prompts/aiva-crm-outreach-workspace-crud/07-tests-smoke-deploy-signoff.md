# 07: Tests, smoke, deploy, sign-off, archive

**Status:** PENDING
**Priority:** P0
**Depends on:** 01-06
**Unlocks:** none (closes set)
**Writing style:** plain ASCII only.

## Goal

Prove the programme on local + Contabo Hire Aiva, sign READY or NOT READY, archive completed prompts.

## Validation checklist

1. **UI**
   - Open `https://admin.hireaiva.co.uk/aiva/outreach/leads` (or CRM alias).
   - Create lead, edit, delete, import CSV, see table rows.
2. **Spreadsheet**
   - Create lead file; import; export; Google Sheet path if OAuth present.
3. **Agent tools**
   - Web worker chat: list/create lead via natural language.
4. **File upload**
   - Upload CSV in worker chat; import to leads.
5. **Channel**
   - Telegram (or documented alternate): add + list lead.
6. **Contact on ask**
   - Request contact → Soft Wall draft → Approvals visible; no silent send.
7. **Health**
   - `https://carinaai.uk/` = 200 after Contabo deploy.
   - Clinicom profile unchanged (still Carina unless owner flipped).

## Deploy

- Prefer scoped cloud (`app.carinaai.uk` / carina-cloud) + core `carina-web` hot-patch or image as needed.
- Git: commit in product roots; push; then Contabo.
- Never break marketing nginx mount.

## Sign-off block (fill in)

```
Verdict: READY | NOT READY
Date:
Evidence:
Blockers:
Rollback: Ops global_engine=carina and/or CARINA_KEPRIX_CHAT_PRIMARY=false if chat path regresses
```

## Archive

On READY (or per-prompt completion):

1. Mark each completed prompt `**Status: COMPLETED YYYY-MM-DD**` + short What was built.
2. Move set to `02-archived_prompts/archives_from_pending_prompts/aiva-crm-outreach-workspace-crud/`.
3. Update `01-pending_prompts/README.md` and this set README.
4. Delete empty pending folders.

## Done When

Checklist green or honest NOT READY with blockers; completed prompts archived same session when READY.
