# Carina Kernel Phase 4: Built on Carina partner program

## Goal

Launch the "Built on Carina" partner program: co-marketing, badge, priority support, and early access for companies shipping products on the kernel.

## Context

- Strategy: `CARINA_AS_LINUX.md` Phase 4 item 14
- Showcase: prompt `04`
- Case studies: prompt `18`
- Enterprise: prompt `20` (partners may upgrade to Enterprise)
- Brand rules: exact badge copy "Powered by Carina" vs "Built on Carina"

## Dependencies

`04-powered-by-carina-showcase.md`, `18-case-study-pages.md`, `20-carina-enterprise-offering.md`

## Files to create

- `carinaai.uk/partners/index.html` (program landing)
- `carinaai.uk/assets/badges/powered-by-carina.svg`
- `carinaai.uk/assets/badges/built-on-carina.svg`
- `docs.carinaai.uk/docs/developer/partner-program.md`
- `instructions/outreach/partner-program-application.md` (internal rubric)

## Files to modify

- `carinaai.uk/index.html` (partners nav link)
- `core.carinaai.uk/docs/kernel/BRAND_RULES.md` (badge usage rules)

## Step-by-step

1. Program tiers (document on partners page):

   | Tier | Requirements | Benefits |
   |------|--------------|----------|
   | Registered | Product uses Carina kernel, link back | Listed on carinaai.uk/partners |
   | Featured | Production deployment + case study | Homepage showcase, case study page |
   | Strategic | Revenue share or Enterprise contract | Co-marketing, early access, priority support |

2. Badge guidelines in `BRAND_RULES.md`:
   - "Powered by Carina": product uses kernel in production
   - "Built on Carina": significant custom layer on kernel
   - "Secured by Scout": only if Scout integrated (separate Scout badge from labyrinthscout.com)
   - SVG badges: dark and light variants, minimum size 120px width

3. Partners page sections:
   - Apply (form or mailto hello@carinaai.uk with template questions)
   - Current partners grid (Propreneur, Flitz, COMPASS, ABBIS as founding partners)
   - Badge download (SVG zip)
   - FAQ: eligibility, review time, logo usage

4. Developer doc `partner-program.md`:
   - Application checklist: public URL, which packs/channels used, kernel version
   - Marketing obligations: link to carinaai.uk, accurate "Powered by" claim
   - No false implication of VERLOX endorsement of partner's product claims

5. Internal rubric `partner-program-application.md`:
   - Scoring: production status, kernel depth, vertical fit, geographic diversity
   - Reject reasons template

6. Application questions (embed in form or email template):
   - Product name and URL
   - Carina version / packages used
   - One paragraph customer value prop
   - Permission to publish case study

## Expected behavior

- Partners page live with apply CTA and badge downloads
- Founding partners displayed with correct badge labels

## Test

- Badge SVGs render on white and dark backgrounds
- Partners page linked from main nav
- BRAND_RULES.md includes badge section

## Pitfalls

- Trademark: partners must not use Carina logo in way that implies acquisition by VERLOX
- Do not auto-approve partners without human review (no self-service badge in v1)
