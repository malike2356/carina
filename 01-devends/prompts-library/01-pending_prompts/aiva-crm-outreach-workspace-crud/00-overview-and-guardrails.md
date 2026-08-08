# 00: Overview and guardrails (CRM leads + outreach CRUD)

**Status:** PENDING (reference; do not implement this file alone)
**Depends on:** none
**Unlocks:** 01-07
**Writing style:** plain ASCII only (no em dashes, no en dashes, no emojis).

## Context

Hire Aiva must treat outreach leads as CRM-visible inventory:

```
Owner runs outreach (UI or prompt)
  -> Leads land in durable store + optional spreadsheet file
  -> Owner opens workspace CRM Leads page (table)
  -> Owner asks Aiva (web / Telegram / email / WhatsApp / etc.) to contact or manage leads
  -> Aiva CRUD via tools (create/read/update/delete/import/export/enroll/contact)
  -> Soft Wall for outbound mutate; Approvals UI for release
```

## Non-negotiables

1. Soft Wall owns outbound email/SMS/WhatsApp/Telegram marketing contact. Never bypass.
2. Tenant isolation: one workspace never reads another workspace's leads or sheets.
3. Prefer extending `/aiva/outreach/*` and Core outreach store over a new CRM product tree.
4. Keprix is the agent brain when Ops engine is keprix; capability nodes and Soft Wall still apply.
5. Secrets stay in `/opt/lampp/htdocs/verlox/.access/`. Never paste secrets into prompts, commits, or UI.
6. Stripe: no new prices unless owner asks.
7. Contabo: after any Contabo deploy verify `https://carinaai.uk/` returns 200.
8. Writing style: no em dashes (U+2014), no en dashes (U+2013), no emojis.

## Source paths

| Layer | Path |
|---|---|
| Cloud UI | `carina/03-frontends/client-apps/app.carinaai.uk/` |
| Core outreach | `carina/02-backends/core.carinaai.uk/src/outreach/` |
| Worker tools | `carina/02-backends/core.carinaai.uk/src/tools/`, `src/workers/` |
| Keprix sidecar | `keprix/src/keprix/product_sidecar/`, packs carina/aiva |
| Ops engine | `ops.carinaai.uk/agent-engine` |

## Success picture

- Sidebar or primary Sales nav reaches a **CRM Leads** page with a real table (filter, search, CRUD).
- Full outreach module remains reachable and agent-CRUD complete.
- Aiva creates/opens lead spreadsheets (workspace file + Google Sheets when connected).
- File upload works in worker chat and main chat; CSV/XLSX become leads.
- Telegram (and other linked channels) can list, add, update, delete, import, and contact leads via natural language.
- Manual smoke on Contabo Hire Aiva after deploy.

## Out of scope

- Replacing Contacts (`/contacts`) entirely (link outreach leads to contacts; do not delete contacts).
- Clinicom / Scout OPS merge.
- Building a second Keprix-only Aiva frontend.
- Cold WhatsApp blast without Soft Wall and daily caps.
