# 02: Lead scrape and sheet ingest

**Status:** PENDING
**Priority:** P0
**Depends on:** 01
**Unlocks:** 03, 08, 10

## Goal

On instruction (e.g. Monday), Aiva finds or accepts leads and appends them to a Google Sheet master list Aiva owns for the funnel. Jak may also paste or manually scrape; both paths must land in the same sheet schema.

## Why

Jak: scrape → list → outreach. Manual sheet is acceptable early; automated scrape is the hands-free path.

## Reuse first

- `web-search` + browser tools (policy-gated)
- `google-sheets-list` / `google-sheets-append`
- `contacts` for upsert/tag once email known
- Documents vault for scrape brief / ICP template

## Requirements

1. Define sheet schema (Sheet1) columns at minimum:
   - `lead_id`, `business_name`, `contact_name`, `email`, `website`, `source`, `niche`, `location`, `status`, `last_touch_at`, `notes`
   - `status` enum aligns with Kanban stages in prompt 08 (`new`, `queued`, `contacted`, `replied`, `booked`, `showed`, `won`, `dead`, `nurture`)
2. Create or locate spreadsheet via Drive/Sheets; store spreadsheet id in workspace outreach config or Document so Aiva does not guess.
3. Instruction parser examples:
   - "Find 40 UK dental clinics needing SEO in Birmingham"
   - "Add these emails to my outreach sheet"
4. Scrape path must:
   - Deduplicate on email (case-insensitive)
   - Skip rows without email
   - Tag `source` (`scrape`, `manual`, `youtube_comment`, `import`, `companies_house`)
   - Prefer Companies House API for UK limited companies when `aiva-companies-house-api` tools are live (see prompt 14); browser scrape is fallback only
   - Respect robots / Terms; never purchase/steal private DBs; public business listings / sites only under product policy
5. After append: summarise counts to owner (Telegram/web): added / skipped / duplicates.
6. Optional: sync new emails into Contacts with tag `outreach-pipeline`.
7. Unit or integration tests for dedupe + schema validation helpers.

## Files to change (expected)

- New outreach helpers under Core (e.g. `src/aiva/outreach/` or `src/workflows/templates/outreach-discovery/`) OR compose via persona + tools without new workflow if viable
- Vitest for schema/dedupe
- Optional cloud UI later: "Outreach leads" page (P2; not required for pilot)

## Acceptance criteria

- [ ] Jakstar can append leads to one known sheet via instruction.
- [ ] Duplicate email append is skipped with reported count.
- [ ] Manual paste path documented and works via chat.
- [ ] Spec for ICP niches lives in vault / persona (prompt 12).

## Deploy

Core if helpers land; otherwise configuration + persona only.
