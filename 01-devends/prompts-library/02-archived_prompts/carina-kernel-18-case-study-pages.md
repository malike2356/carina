# Carina Kernel Phase 3: Case study pages (Built on Carina)

## Goal

Publish full case study pages on carinaai.uk for Propreneur, Flitz, and COMPASS with honest production status and "Powered by Carina" branding.

## Context

- Strategy: `CARINA_AS_LINUX.md` Phase 3 item 10
- Homepage showcase: prompt `04` (short cards)
- Brand rules: `core.carinaai.uk/docs/kernel/BRAND_RULES.md`
- Existing: `carinaai.uk/case-studies/index.html`

## Dependencies

`04-powered-by-carina-showcase.md`

## Files to create

- `carinaai.uk/case-studies/propreneur/index.html`
- `carinaai.uk/case-studies/flitz/index.html`
- `carinaai.uk/case-studies/compass/index.html`
- `carinaai.uk/case-studies/scout/index.html` (Scout as "built on Carina" security layer story)

## Files to modify

- `carinaai.uk/case-studies/index.html` (link to individual pages)
- `carinaai.uk/index.html` (case study cards link to detail pages)

## Step-by-step

1. Shared case study template (copy structure across four pages):
   - Hero: Product name + badge ("Powered by Carina" or "Built on Carina")
   - Problem (2 paragraphs)
   - Solution with Carina kernel components used (tools, packs, channels, memory)
   - Optional Scout section if applicable ("Secured by Scout")
   - Results/metrics (only verified numbers; use "In development" if none)
   - Quote placeholder from product owner (optional)
   - CTA: "Build on Carina" linking to docs tutorial

2. **Propreneur** page:
   - Vertical: UK property investment
   - Packs: property-uk
   - Channels: web, email (verify before claiming)
   - Link: propreneur.uk

3. **Flitz** page:
   - Vertical: fleet tracking, Africa markets
   - Status: honest stage (pilot/dev/production)
   - Emphasize geography-agnostic kernel

4. **COMPASS** page:
   - Vertical: NHS compliance copilot
   - Status: pilot/in development unless shipped
   - Compliance language careful: decision support, not medical device claims

5. **Scout** page:
   - Position as commercial security layer FOR Carina kernel
   - Link labyrinthscout.com for product detail
   - Not a "Built on Carina" product in same sense; frame as "security layer for Carina"

6. Reuse `carinaai.uk` global CSS; breadcrumb: Home > Case studies > [Product]

7. JSON-LD `Article` schema optional for SEO (title, description, datePublished)

## Expected behavior

- Each homepage "Built on Carina" card links to a real detail page
- Case studies explain which kernel primitives each product uses

## Test

- All four URLs resolve locally
- No false NHS production claims for COMPASS
- Scout page does not say Scout is free

## Pitfalls

- Get product owner sign-off before publishing metrics
- Keep Scout case study separate from MIT kernel marketing confusion
