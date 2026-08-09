# Aiva Lead Funnel Operator Guide

## What shipped

Tenant-scoped CRM leads with workbook-quality fields, unified ingestion, spreadsheet CRM table, Soft Wall email campaigns, reply classification with sequence stop conditions, suppression list, conversion to customer, and funnel attribution.

## Capability matrix

Machine-readable baseline (real / partial / missing, and manual / scheduled / provider-backed / simulated):

`docs/AIVA-LEAD-FUNNEL-CAPABILITY-MATRIX.json`

Release alignment (required commits in carina-web and carina-cloud):

```bash
bash scripts/check-lead-funnel-release-alignment.sh local
bash scripts/check-lead-funnel-release-alignment.sh production
bash scripts/smoke-lead-funnel-baseline.sh
```

## Setup

1. Use an Aiva workspace with Outreach enabled.
2. Configure an email provider / mailbox for Soft Wall approvals.
3. Optional: connect Google Sheets under Settings.
4. Optional: Companies House for discovery ingest.

## Import leads

- CRM Leads page: `/aiva/outreach/leads` (alias `/aiva/crm/leads`)
- Upload CSV or paste rows. Header aliases match the SEO lead tracker workbook.
- Agent tools: `outreach-leads-ingest`, `outreach-leads-import`, `outreach-discovery-ingest-leads`
- Provenance is stored on each lead (`sourceType`, `sourceName`, `sourceUrl`, `sourceJobId`)

## Campaigns and replies

1. Select eligible leads (email present, not suppressed/opted out).
2. Preview with `outreach-campaigns-preview` or `POST /api/aiva/outreach/campaigns/preview`.
3. Enrol into a sequence. Soft Wall creates `pending_approval` deliveries via `outreach-process-due`.
4. Approve in Approvals before send.
5. Inbound replies classify to interested, not interested, question, referral, ooo, unsubscribe, bounce, complaint, or uncertain.
6. Reply / unsubscribe / bounce / complaint stop active enrollments and may suppress the address.

## Funnel

Lifecycle defaults:

`new -> enriched -> ready -> contacted -> replied -> qualified -> booked -> attended -> proposal_sent -> won -> nurture -> lost -> suppressed`

- Convert: `POST /api/aiva/outreach/leads/:id/convert-customer`
- Report: `GET /api/aiva/outreach/funnel` or tool `outreach-funnel-report`

## Suppression and safety

- Workspace suppression list blocks enrol and send.
- Never bypass Soft Wall approval, consent, or daily caps.
- Do not claim opens/clicks unless the provider confirmed them.

## Troubleshooting

- Duplicate imports merge non-empty fields instead of creating new contacts.
- Missing email skips email channel steps.
- Workspace pause blocks due sends.
- Export workbook CSV from CRM Leads Export button or `/api/aiva/outreach/leads/export?format=workbook`.
