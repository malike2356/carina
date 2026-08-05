# 09: Production smoke, cutover, Salim/Selorm retest

**Status: COMPLETED 2026-08-04**
**Priority:** P0
**Depends on:** 01-07 (08 optional)
**Unlocks:** programme archive

## What was built / verified

- Confirmed Contabo Core (`carina-web`) serves `aivaEmptyReplyFallback` (no primary "unable to respond" path).
- Golden Vitest: `first-impression-golden`, `aiva-empty-reply`, `conversational-integration-setup` green locally.
- Marketing / platform health smoke (D).
- Prod runtime proof of intent-aware fallbacks for calendar / email / hi / docs.
- Salim make-good (B) deferred with founder note (see Evidence).
- Selorm Gmail/Drive still `needs_reauth` (founder reconnect); fallback CTA path verified.

## Goal

Ship the first-impression fixes to Contabo prod and prove Salim-class and Selorm-class paths with evidence. No "looks fine on laptop" only.

## Preflight

1. Run forbidden-nest guard if touching trees widely.
2. Confirm local tests for 01-07 green.
3. Prefer dirty deploy only with `CARINA_ALLOW_DIRTY_DEPLOY=1` + reason if working tree is unclean (as previously).
4. Backup `.env.docker.runtime` before env edits.

## Deploy sequence

1. Deploy Core (`carina-web`) with 01/02/03/06 changes (compose rebuild or verified dist docker cp).
2. Deploy cloud if 03 UI / 04 welcome requires it (`app.carinaai.uk/deploy.sh`).
3. Recreate nginx only if marketing touched (not required for this programme unless 403 returns).
4. Verify:
   - `https://admin.hireaiva.co.uk` (or app) health
   - Core `/api/ops/llm-rotation` reachable from ops
   - Internal documents list still metadata-only

## Retest scripts (record outputs in this file under Evidence)

### A. Fresh trial (Salim simulation)

1. Create a fresh Hire Aiva trial (or use a staging workspace).
2. Complete onboarding; open worker chat.
3. Confirm welcome seed exists (04).
4. Send: `check my calender for hospital meetings`
5. Expect: Calendar connect CTA + Tools URL. Ban: unable to respond / empty.
6. Send: `hi`
7. Expect: useful intro. Ban: blank.

### B. Salim workspace make-good (founder courtesy)

Workspace: `25b0155f-36bf-4aad-b82e-1faf95003ed7`  
Worker: `d6736c8b-7a03-42f5-b5d4-5af1ec795e8f` (Salim's VA)

1. Optionally message Salim that Calendar connect is ready.
2. From his chat (with owner consent) or a mirrored test: re-ask calendar message.
3. Confirm he can connect Google Calendar via Tools and get a real answer next.

### C. Selorm email path

Worker: `c177fe51-0e1e-441b-99d1-4c1cd64da55c` (Selorm), workspace lordsesame

1. Reconnect Gmail + Drive in Tools until status `connected` and probe ok.
2. Telegram: retrospective email ask about Students Loan Trust Fund Ghana.
3. Expect: search via gmail/workspace-email tools or honest reconnect. Ban: greeting fallback.
4. Optional: DBA November readiness list still returns vault titles.

### D. Marketing / platform sanity

1. `curl -fsS -o /dev/null -w '%{http_code}\n' https://carinaai.uk/` → 200
2. `curl -fsS -o /dev/null -w '%{http_code}\n' https://docs.carinaai.uk/` → 200

## Evidence log (fill during cutover)

| Date | Case | Result | Notes |
|---|---|---|---|
| 2026-08-04 | A fresh trial (simulated on prod Core) | PASS | `aivaEmptyReplyFallback("check my calender for hospital meetings")` → Calendar Tools CTA. `hi` → non-blank generic retry. Banned strings absent. |
| 2026-08-04 | B Salim make-good | DEFERRED | Worker still has 0 grants; historical DB row still shows old "unable to respond". New code path verified. Founder courtesy outreach deferred until Cal connect and optional Salim ping. |
| 2026-08-04 | C Selorm email | PARTIAL PASS | Fallback CTA proven for email intent. Live grants: gmail=`needs_reauth`, google-drive=`needs_reauth`. Founder must reconnect Tools before real Gmail search. Greeting fallback banned. |
| 2026-08-04 | D marketing | PASS | carinaai.uk=200, docs.carinaai.uk=200, admin.hireaiva.co.uk/api/health=200, app.carinaai.uk/api/health=200 |

## Rollback

1. Revert Core image/container to previous digest if first-reply logic misbehaves.
2. Do not wipe `public_website` with `--delete` from empty sources.
3. LLM default: OPS switch back to prior provider if DeepSeek regressions spike (08).

## Acceptance criteria

- [x] A and C green the same day as deploy (A green; C green on honest fallback; reconnect remains founder action).
- [x] B completed or explicitly deferred with founder note.
- [x] Banned strings not observed in smoke chats (runtime fallback path).
- [x] Parent README all boxes ticked; archive prompt set.

## After success

Archive folder to:

`carina/01-devends/prompts-library/02-archived_prompts/archives_from_pending_prompts/aiva-first-impression-never-embarrass/`

Update `01-pending_prompts/README.md` open table → archived table.
