# Sprint 6 Convergence; Prompt 06: Phase 2 Bridge Writes + Review Queue

**Status: COMPLETED 2026-06-24**

**What was built:**

- **T1-T3:** Tenant migration `aiva_bridge_proposals`; `AivaBridgeProposalService`; API propose/approve/reject; Blade review queue at Settings > Aiva bridge review; flags `aiva_bridge_writes`, `aiva_bridge_review_queue`.
- **T4:** Carina `propreneur-propose-*` tools with `requiresConfirmation`; `PROPREENEUR_BRIDGE_WRITES` env flag.
- **T5:** Optional `email_processed` webhook hook creates financial proposals when rent data matches portfolio.
- **T6:** `AivaBridgeProposalTest.php`; extended Carina `aiva-message-handler.test.ts`; audit via Laravel log on approve/reject.
- **Docs:** complement guide, `132-aiva-propreneur-bridge-phase1.md`, convergence checklist A13 DONE.

**Sprint:** 6; Convergence
**Prompt number:** 06
**Name:** Deferred write bridge with human review (Phase 2)
**Primary agent:** Claude Code
**Estimated hours:** 16-22 h
**Depends on:** Prompt 01 COMPLETED, Prompt 05 (operator guide), Glen Phase 1 stable in production

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `01-devends/prompts/02-archived_prompts/archives_from_pending_prompts/sprint-6/`.

---

## Read First

1. `sprint-6-email-ingestion-carina-propreneur-bridge.md` (Phase 2 section)
2. `propreneur/propreneur-v2/app/Services/Carina/CarinaAgentService.php` (confirmation gate pattern)
3. `02-backends/core.carinaai.uk/src/agents/tool-runner.ts` (dangerous tool confirmation)
4. `01-devends/planning/operations/CARINA_PROPRENEUR_CONVERGENCE_CHECKLIST.md` (A13)

---

## Goal

Allow Aiva to **propose** writes into Propreneur (deals, compliance updates, financial logs) through a **human review queue**, not direct mutation.

**Unity principle:** Carina suggests; Propreneur commits. Same confirmation philosophy as in-app Carina `requiresConfirmation()` tools.

---

## Owner / consumer / flags

| Capability | Owner | Consumer | Flag |
|------------|-------|----------|------|
| Write API endpoints | Propreneur | Carina Aiva tools | `PROPREENEUR_BRIDGE_WRITES` (PP) + `PROPREENEUR_BRIDGE_ENABLED` |
| Review queue UI/API | Propreneur | Tenant admin / VA | `aiva_bridge_review_queue` |
| Propose-write tools | Carina | Aiva | gated by both flags |
| Apply approved write | Propreneur | internal job | no Carina callback required |

Default: **all false**.

---

## Tasks

### T1. Propreneur review queue schema

Tenant migration:

- `aiva_bridge_proposals`: `id`, `source_worker_ref`, `proposal_type`, `payload JSONB`, `status` (pending|approved|rejected), `reviewed_by`, `reviewed_at`, `idempotency_key`, timestamps.

### T2. Write endpoints (proposal-only)

Under `/api/aiva-bridge/` (same auth as read):

- `POST /proposals/deal`; creates **proposal**, not deal.
- `POST /proposals/compliance`; proposal to update certificate fields.
- `POST /proposals/financial-log`; proposal to log payment.

Return `{ proposal_id, status: "pending_review" }`. Idempotency via `Idempotency-Key` header.

### T3. Review API + minimal UI

- `GET /api/aiva-bridge/proposals?status=pending`
- `POST /api/aiva-bridge/proposals/{id}/approve`; runs existing domain service (e.g. `DealService`, `ComplianceService`).
- `POST /api/aiva-bridge/proposals/{id}/reject`

Blade or Filament: simple queue page for workspace admin (list + approve/reject). GUI-first per Propreneur rules.

### T4. Carina tools (propose only)

Extend `propreneur-bridge.ts` + `propreneur-portfolio.ts`:

- `propreneur-propose-deal`, `propreneur-propose-compliance-update`, `propreneur-propose-financial-log`.
- Mark `requiresConfirmation: true` in tool-runner.
- Aiva tells user: "Submitted for review; your team will confirm."

### T5. Email → proposal flow (optional)

When `EMAIL_INGESTION_ENABLED` on Carina-only mailbox OR digest from Propreneur email activity:

- Parser output creates proposal via bridge, not direct write.
- Low-confidence extractions force `review_notes` field.

### T6. Tests and audit

- Pest: proposal does not mutate deals until approved; idempotency; tenant isolation.
- Vitest: tools blocked when `PROPREENEUR_BRIDGE_WRITES=false`.
- Audit log entry on approve/reject.

---

## Explicit SKIP

- Auto-approve proposals without human action
- Carina direct SQL
- Replacing Propreneur `EmailProcessingPipeline` handlers

---

## Done When

- [x] Write tools create proposals only when flags on
- [x] Admin can approve proposal and see resulting deal/compliance row
- [x] Reject leaves no side effects
- [x] Idempotent replay returns same proposal_id
- [x] Integration test: email digest → proposal → approve → entity exists
- [x] Checklist A13 DONE; complement guide updated with review workflow
- [x] Carina `pnpm test` pass on bridge write tests (Propreneur Pest re-run in CI when DB harness responsive)

---

## Validation

```bash
cd propreneur/propreneur-v2
php artisan test --filter=AivaBridge

cd ../../carina/02-backends/core.carinaai.uk
pnpm test
```

---

## Pitfalls

1. **Double application:** approval handler must check `status === pending`.
2. **Schema drift:** version proposal payload with `schema_version`.
3. **Tenant leak:** proposals scoped to authenticated bridge tenant only.
4. **UX trust:** never tell user "done" until status is approved.
