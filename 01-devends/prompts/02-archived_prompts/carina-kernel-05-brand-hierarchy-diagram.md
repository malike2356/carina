# Carina Kernel Phase 1: Brand hierarchy diagram

## Goal

Publish the Carina brand hierarchy diagram (kernel at center, Scout commercial, products and packs radiating out) on carinaai.uk and in docs.

## Context

- ASCII diagram in `CARINA_AS_LINUX.md` lines 75-88
- Brand rules: `core.carinaai.uk/docs/kernel/BRAND_RULES.md`
- Docs site supports Mermaid in some pages; carinaai.uk is static HTML

## Dependencies

`00-lock-brand-and-boundaries.md`

## Files to create

- `carinaai.uk/assets/diagrams/carina-brand-hierarchy.svg` (accessible SVG, dark theme friendly)
- `docs.carinaai.uk/docs/developer/platform-architecture.md`

## Files to modify

- `carinaai.uk/index.html` (embed diagram in a "Platform" or "Architecture" section)
- `docs.carinaai.uk/sidebars.ts`

## Step-by-step

1. Create SVG diagram with this structure (center to leaves):

   ```
   Carina (THE KERNEL - free, MIT)
     ├── DOMAIN PACKS (free): property-uk, healthcare-uk, finance-uk, legal-uk
     ├── PRODUCTS: Propreneur, Flitz, COMPASS, Carina Ops
     └── SCOUT (commercial): injection shield, audit, kill switch, trust verification
   ```

   Use Carina teal palette from `carinaai.uk/index.html` CSS variables. Text must be readable at 320px width (stack vertically on small screens or provide simplified mobile SVG).

2. Add homepage section `#platform-architecture`:

   ```html
   <section id="platform-architecture">
     <h2>One platform. One free kernel.</h2>
     <img src="/assets/diagrams/carina-brand-hierarchy.svg" alt="Carina platform hierarchy: free MIT kernel at center, domain packs and products built on top, Scout as commercial security layer" width="800" height="600" loading="lazy">
   </section>
   ```

3. Create `docs.carinaai.uk/docs/developer/platform-architecture.md` with:
   - Mermaid equivalent of the hierarchy (for maintainability)
   - Explanation paragraph for each layer
   - Link to `MANIFESTO.md` and pricing boundary doc

   Example Mermaid:

   ```mermaid
   flowchart TB
     kernel[Carina Kernel - MIT free]
     packs[Domain Packs - free]
     products[Products - built on Carina]
     scout[Scout - commercial]
     kernel --> packs
     kernel --> products
     kernel --> scout
   ```

4. Wire sidebar entry under Developer docs.

5. Alt text and aria labels on SVG for accessibility.

## Expected behavior

- Visual and docs version of hierarchy stay in sync
- Diagram communicates free vs commercial at a glance

## Test

- SVG file exists and renders in browser
- `cd docs.carinaai.uk && pnpm build` succeeds
- Diagram labels match `BRAND_RULES.md` naming
