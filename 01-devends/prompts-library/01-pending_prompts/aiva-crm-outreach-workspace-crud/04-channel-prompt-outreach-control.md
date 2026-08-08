# 04: Channel prompt control (Telegram and all linked channels)

**Status:** PENDING
**Priority:** P0
**Depends on:** 02, 03
**Unlocks:** 06, 07
**Writing style:** plain ASCII only.

## Goal

Natural-language prompts on **Telegram and every other linked worker channel** can fully manage CRM leads and outreach (same CRUD as tools in prompt 02), with workspace isolation and Soft Wall for outbound.

## Why

Owners operate from Telegram. Channel turns already hit `GatewayRouter` / Aiva workers; they must load outreach tools and understand lead intents.

## Reuse first

- Worker channel adapters (Telegram, email, WhatsApp, SMS, Teams, etc.)
- `resolveWorkerForMessage` / product tool adapters
- Prior funnel prompt 11 (Telegram ops alerts) patterns
- Soft Wall + Approvals

## Requirements

1. **Tool surface on channel sessions**
   - Any Aiva worker session that has outreach feature must register outreach CRUD + spreadsheet tools (same as web worker chat).
   - No separate Telegram-only store.

2. **Intent coverage (examples; implement via tools + system prompt, not brittle regex-only)**
   - "List my leads"
   - "Add lead Jane Doe jane@acme.com Acme"
   - "Import these CSV lines: ..."
   - "Move lead X to contacted"
   - "Pause outreach"
   - "Create a leads spreadsheet"
   - "Contact the new leads about discovery calls" (handoff to prompt 06 Soft Wall path)
   - "Delete duplicate leads for email@x.com"

3. **Reply shape**
   - Concise channel replies: counts, ids, next actions, Soft Wall deep links when approval needed.
   - Never dump secrets or other tenants' data.
   - Empty-result honesty (never invent leads).

4. **Attachments on channels**
   - If Telegram/email delivers a CSV/XLSX document, route to file ingest (prompt 05) then lead import (prompt 03).
   - If attachment unsupported, say so and offer paste format.

5. **Alerts**
   - Optional: after import or stage "replied"/"booked", notify owner channel (reuse alert-target config).

6. **Tests**
   - Simulated channel message → tool call → lead created (unit/integration).
   - Isolation: workspace A tools cannot read workspace B leads.

## Acceptance

- [ ] Telegram-linked worker can create and list leads via chat.
- [ ] Same for at least one other channel path (email or WhatsApp) or documented parity via shared tool registration.
- [ ] Soft Wall required for contact/send intents.
- [ ] No cross-tenant leakage in tests.

## Done When

Owners can fully manage outreach/CRM leads from Telegram and other linked channels by prompting Aiva.
