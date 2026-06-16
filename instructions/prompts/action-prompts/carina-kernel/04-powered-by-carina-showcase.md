# Carina Kernel Phase 1: "Powered by Carina" showcase section

## Goal

Add a "Built on Carina" / "Powered by Carina" section to carinaai.uk featuring Propreneur, Flitz, and COMPASS as proof-point products.

## Context

- Strategy: `CARINA_AS_LINUX.md` Phase 1 item 3 and Phase 3 item 10
- Brand copy rules: `core.carinaai.uk/docs/kernel/BRAND_RULES.md`
- Existing case studies page: `carinaai.uk/case-studies/index.html` (extend or link from homepage)
- Products (placeholders OK where sites are not live; use honest "coming soon" for COMPASS if not shipped)

## Dependencies

`00-lock-brand-and-boundaries.md`, `02-landing-hero-kernel-positioning.md`

## Files to modify

- `carinaai.uk/index.html` (new section `#built-on-carina`)
- `carinaai.uk/case-studies/index.html` (ensure three product cards exist)

## Files to create

- `carinaai.uk/assets/built-on-carina/` (optional SVG logos or placeholder initials; only if assets do not exist elsewhere)

## Step-by-step

1. Add a homepage section after the three-column "Any model / channel / domain" block:

   ```html
   <section id="built-on-carina" class="built-on-carina">
     <h2>Built on Carina</h2>
     <p class="section-lead">Products running on the same free kernel.</p>
   ```

2. Four product cards:

   | Product | Tagline | Copy label | Link |
   |---------|---------|------------|------|
   | Propreneur | UK property investment platform | Powered by Carina | propreneur.uk or `#` if internal |
   | Flitz | Fleet tracking for Africa | Built on Carina | placeholder `#` with honest status |
   | COMPASS | NHS compliance copilot | Powered by Carina | placeholder or NHS pilot page |
   | ABBIS | Borehole industry platform, Ghana and West Africa | Built on Carina | abbis360.com or `#` until live |

   Each card includes:
   - One sentence description
   - Badge: "Powered by Carina" or "Built on Carina" per brand rules
   - Optional second badge: "Secured by Scout" only if product actually uses Scout (ABBIS and Propreneur both use Scout; verify before adding the badge to others)

3. Footer CTA: "Build your product on Carina" linking to docs developer manifesto and `16-first-domain-pack-tutorial.md` target doc path once published.

4. Mirror the same four cards on `carinaai.uk/case-studies/index.html` with slightly longer copy (2-3 sentences each). Add a "Read case study" link that can point to `#` until prompt `18` fills full pages.

5. Match existing card/grid CSS from homepage (do not introduce a new CSS framework).

6. Meta: do not claim COMPASS is in NHS production unless verified; use "In development" or "Pilot" if uncertain.

## Expected behavior

- Homepage shows ecosystem proof, not only Carina-as-product
- Naming follows brand rules exactly

## Test

- Homepage contains `id="built-on-carina"` and all four product names (Propreneur, Flitz, COMPASS, ABBIS)
- `grep "Powered by Carina\|Built on Carina" carinaai.uk/index.html` returns at least 4 matches
- No false production claims for COMPASS or ABBIS (use "In development" or "Coming soon" until live)
