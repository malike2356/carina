# 05: File upload fix + Keprix tools/packs for files

**Status: COMPLETED 2026-08-08**
**Priority:** P0
**Depends on:** 03
**Unlocks:** 07
**Writing style:** plain ASCII only.

## What was built
- 100MB decoded chat attachments; Express/Next body 150mb
- Wider MIME + CRM import guidance on CSV uploads

## Goal

Fix Aiva file upload so owners can attach CSV/XLSX/PDF/images in worker chat (and main chat where product allows). After upload, Aiva must use **Keprix capabilities and packs** (plus Core tools) to parse, analyse, and enroll leads where appropriate.

## Why

Owners report Aiva does not accept file uploads. Without uploads, spreadsheet lead gen stays broken. Keprix is now the chat primary brain; file handling must not stay Carina-only or dead-end.

## Reuse first

- `AivaWorkerDirectChat.tsx` attachment picker → `/api/aiva/workers/:id/chat-attachments`
- Core chat attachment helpers (`aiva/chat-attachments.ts` if present)
- `csv-parse`, Sheets tools, Documents vault
- Keprix product sidecar invoke + data/rag nodes where catalogue allows
- Soft Wall for any outbound derived from a file

## Requirements

1. **Diagnose and fix upload path**
   - Inventory: worker chat, main cloud chat, Telegram document inbound.
   - Fix auth, size limits, MIME allowlist, storage path, and error messages.
   - Accept at least: `.csv`, `.xlsx`, `.xls`, `.tsv`, `.txt`, `.pdf`, common images.
   - Clear UI error when rejected (size/type), never silent fail.
   - Persist attachment metadata on the turn so Keprix/Core can read an absolute or workspace-relative path.

2. **Post-upload agent behaviour**
   - System/tool guidance: when a spreadsheet uploads, offer "Import as CRM leads" and run import after confirm (or Soft Wall if policy requires).
   - For SPSS/analytics files, keep analysis path; for lead sheets, prefer CRM import path.
   - When Ops engine is keprix, ensure the turn can call needed tools/capabilities (Core HTTP tools and/or Keprix nodes). Do not strand the file as unused base64.

3. **Keprix packs / tools**
   - Prefer Keprix data/rag/crm capability nodes when they cover the job; else Core tools via bridge.
   - Document which nodes/tools are used for: parse CSV, create sheet, enroll leads, Soft Wall propose.
   - Never free-form shell on uploaded files.

4. **Security**
   - Workspace-scoped storage; no path traversal.
   - Virus/size limits; strip executables.
   - Do not echo full file contents into other tenants' logs.

5. **UI**
   - Visible paperclip / drop zone on worker chat; progress + filename chip; remove pending attachment.
   - Optional: upload control on CRM Leads page for bulk import (can share API).

6. **Tests**
   - API accepts small CSV and returns path.
   - Reject oversized/disallowed type with 4xx.
   - Import-from-upload helper creates leads.

## Acceptance

- [ ] Owner can upload a CSV in Aiva worker chat successfully.
- [ ] Aiva can import that CSV into CRM leads (with confirmation).
- [ ] Keprix-primary turn can still use tools/capabilities on the file (smoke).
- [ ] Telegram document path either works or returns a clear "forward via web upload" message (prefer full support).

## Done When

File upload works in Aiva, and uploaded lead files flow into CRM using Keprix/Core capabilities as designed.
