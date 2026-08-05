# Carina Kernel Phase 1: Pricing boundary (Carina free, Scout commercial)

## Goal

Add a clear, prominent pricing boundary on carinaai.uk and docs: Carina core is free forever; Scout and Carina Ops are commercial.

## Context

- Rule from `CARINA_AS_LINUX.md`: "Carina is free. Scout is commercial."
- Existing pages: `carinaai.uk/index.html`, `carinaai.uk/security/index.html`, `core.carinaai.uk/src/web/pricing/` (if present)
- Scout marketing: `labyrinthscout.com/index.html` (link out for Scout pricing)
- Carina Ops pricing: may exist in carina-ops prompts `36-marketing-pricing-page.md`; do not duplicate full Ops pricing tables here
- Brand rules: `core.carinaai.uk/docs/kernel/BRAND_RULES.md`

## Dependencies

`00-lock-brand-and-boundaries.md`

## Files to create

- `carinaai.uk/pricing/index.html` (new static page: kernel vs security vs hosted)

## Files to modify

- `carinaai.uk/index.html` (add nav link "Pricing" and a compact boundary callout in hero or below trust badges)
- `docs.carinaai.uk/docs/user/pricing.md` (or create if missing)
- `labyrinthscout.com/index.html` (add "Runs on Carina" one-liner with link back; optional cross-link)

## Step-by-step

1. Create `carinaai.uk/pricing/index.html` using the same CSS/fonts as `carinaai.uk/index.html` (reuse `style.css` or shared variables).

2. Page structure:

   **Section 1: The rule**

   ```text
   Carina is free. Forever. MIT license.
   Scout is commercial. Pay when you need enterprise security.
   Carina Ops is commercial. Pay when you want hosted multi-tenant SaaS.
   ```

   **Section 2: Comparison table**

   | | Carina (kernel) | Scout | Carina Ops |
   |---|---|---|---|
   | Price | Free | Paid plans | Paid plans |
   | License | MIT | Commercial | Commercial |
   | Includes | Tools, memory, channels, packs | Injection shield, audit, kill switch | Hosting, billing, org RBAC |
   | Required? | Yes (base) | No | No |

   **Section 3: FAQ**

   - Can I run Carina without Scout? Yes.
   - Can I self-host everything? Yes for Carina; Scout server is a separate product.
   - Is npm install free? Yes.

3. Add to main nav on `carinaai.uk/index.html`: `<a href="/pricing/">Pricing</a>`

4. Add compact callout on homepage (below hero or trust badges):

   ```html
   <aside class="pricing-boundary">
     <strong>Carina is free.</strong> Scout and Carina Ops are commercial add-ons.
     <a href="/pricing/">See pricing boundary</a>
   </aside>
   ```

5. Create or update `docs.carinaai.uk/docs/user/pricing.md` with the same table (markdown). Link to Scout site for Scout plan details.

6. Style the pricing page to match existing carinaai.uk dark teal aesthetic; no new framework.

## Expected behavior

- No visitor confusion about whether Scout is included in MIT Carina
- Pricing page is reachable from main nav and docs

## Test

- `carinaai.uk/pricing/index.html` renders the three-way table
- `grep -i "Carina is free" carinaai.uk/pricing/index.html carinaai.uk/index.html` returns matches
- Docs build: `cd docs.carinaai.uk && pnpm build`
