# Sprint 4 dependency audit (2026-06-24)

**Historical snapshot.** Superseded 2026-06-25 when prompts 03-29 were re-verified and archived.
Only prompt 02 remains pending. See `../../01-pending_prompts/sprint-4-action-README.md`.

Audit of `02-archived_prompts/archives_from_pending_prompts/sprint-4/` against the codebase under `02-backends/core.carinaai.uk/`, `03-frontends/`, and `marketing/`.

**Trigger:** 23 sprint-4 action prompts were marked `COMPLETED 2026-06-23` and archived without satisfying all Done When criteria.

**Outcome:** 18 prompts moved back to `01-pending_prompts/` for re-evaluation. 7 remain correctly archived.

---

## Verdict summary

| # | Prompt | Verdict | Action |
|---|--------|---------|--------|
| 01 | Deploy scripts | **COMPLETE** | Stay archived |
| 02 | Security hardening | **PARTIAL** | Reopened |
| 03 | Backups and restore | **PARTIAL** | Reopened |
| 04 | Monitoring and ops | **PARTIAL** | Reopened |
| 05 | PgBouncer pooling | **PARTIAL** | Reopened |
| 06 | Staging environment | **PARTIAL** | Reopened |
| 07 | Aiva landing page | **COMPLETE** | Stay archived |
| 08 | Worker brain | **PARTIAL** | Reopened |
| 09 | Onboarding wizard | **PARTIAL** | Reopened |
| 10 | Worker portal UI | **COMPLETE** | Stay archived |
| 11 | Transactional email | **PARTIAL** | Reopened |
| 12 | Channel infrastructure | **COMPLETE** | Stay archived |
| 13 | WhatsApp adapter | **PARTIAL** | Reopened |
| 14 | Email channel adapter | **PARTIAL** | Reopened |
| 15 | Slack adapter | **COMPLETE** | Stay archived |
| 16 | Telegram adapter | **COMPLETE** | Stay archived |
| 17 | Web chat widget | **PARTIAL** | Reopened |
| 18 | VA response interface | **PARTIAL** | Was already pending |
| 19 | Usage limits per tier | **PARTIAL** | Reopened |
| 20 | Conversations and analytics | **PARTIAL** | Reopened |
| 21 | GDPR, privacy, cookies | **PARTIAL** | Reopened |
| 22 | Billing backend | **PARTIAL** | Reopened |
| 23 | Billing UI | **PARTIAL** | Reopened |
| 24 | Billing plan gates | **PARTIAL** | Reopened |
| 25 | Admin auth and customers | **COMPLETE** | Stay archived |
| 26 | Admin fleet dashboard | **PARTIAL** | Reopened (needs Done When audit) |
| 27 | VA queue and revenue | **PARTIAL** | Was already pending |
| 28 | Business plan features | **PARTIAL** | Was already pending |

**Score:** 7 complete, 21 partial, 0 not implemented at all.

Nothing in sprint-4 is a greenfield miss; the problem is premature archive of partial work.

---

## Cross-cutting gaps (fix once, unblock many prompts)

1. **Channel bindings at hire time** (08, 09): onboarding sends `channelBindings` but `aiva-api.ts` drops them; `sendWorkerOnboardingMessage()` is never called.
2. **VA resolve path** (11, 18): `admin-router` resolve bypasses `worker-store.resolveEscalation()` so escalation-resolved email never fires.
3. **Billing UI spec vs reality** (22-24): Aiva billing lives at `/billing/aiva`, not `/billing`; downgrade conflict flow missing entirely.
4. **Analytics fidelity** (20): `/analytics` is Carina workspace analytics; Aiva analytics at `/aiva/analytics` with simpler UI than spec.
5. **Docker re-scope** (02-06): infra prompts assumed host nginx/PM2; Docker equivalents exist but several Done When items (ops docs, cron heartbeat writer, seed-staging) were never closed.

---

## Correctly archived (do not re-implement)

| # | Key evidence |
|---|--------------|
| 01 | `docker/scripts/deploy-atomic.sh`, `deploy-lib.sh`, `docker-compose.deploy.yml` |
| 07 | `03-frontends/marketing/carinaai.uk/aiva/index.html` |
| 10 | `app.carinaai.uk/(workspace)/aiva/*` portal routes and components |
| 12 | `src/channels/*`, migration `010-channel-infrastructure.sql` |
| 15 | `src/channels/adapters/slack-adapter.ts` |
| 16 | `src/channels/adapters/telegram-adapter.ts` |
| 25 | `admin.carinaai.uk` app + `src/admin/admin-router.ts` |

---

## Broader `02-archived_prompts/` (700+ files)

Not moved back. These are historical sprint-1/2/3, gap-closure, and phase prompts archived over months.

Reference: `02-archived_prompts/descriptions-AUDIT-STATE-2026-06-20.md` (~77% implemented, ~23% genuine gaps).

Known weak areas in older archives (leave archived; open new prompts if needed):

- **gap-13 truth-in-advertising:** 5/8 NOT BUILT
- **sprint-2 voice:** 5/7 NOT BUILT
- **sprint-2 web UI polish:** 4/9 NOT BUILT
- **sprint-2 workspace distribution:** 3/9 NOT BUILT

Superseded prompts (`SUPERSEDED 2026-06-23`) should stay archived.

---

## Suggested re-prioritization order

1. **Wire hire-time channels + onboarding message** (08, 09) before more channel polish.
2. **Billing close-out** (22-24): pricing route, automatic_tax, downgrade conflict, full `/billing/aiva` UI.
3. **VA queue email fix** (11, 18) single-line routing fix.
4. **Conversations/analytics** (20) after billing stable.
5. **Infra ops docs + heartbeat** (04) independent of product.
6. **Admin fleet/VA/revenue** (26, 27) audit Done When, then archive.
7. **Business plan** (28) last; depends on billing gates.

---

## Archive layout after this audit

```
archived_prompts/archives_from_pending_prompts/sprint-4/
  sprint-4-action-01-deploy-scripts.md
  sprint-4-action-07-aiva-landing-page.md
  b/sprint-4-action-10-worker-portal-ui.md
  c/sprint-4-action-12-channel-infrastructure.md
  c/sprint-4-action-15-slack-adapter.md
  c/sprint-4-action-16-telegram-adapter.md
  i/sprint-4-action-25-admin-auth-and-customers.md
```

All other sprint-4 action prompts are in `01-pending_prompts/sprint-4-action-*.md`.
