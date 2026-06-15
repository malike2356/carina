# Carina Kernel Phase 4: Carina Enterprise offering

## Goal

Define and publish Carina Enterprise: support contracts, SLAs, and services for companies building products on the Carina kernel (Red Hat model for Linux).

## Context

- Strategy: `CARINA_AS_LINUX.md` Phase 4 item 12
- Pricing boundary: prompt `03`
- Case studies: prompt `18`
- Carina Ops Team tier may overlap; Enterprise is **builder/support** layer, not just hosting

## Dependencies

`03-pricing-boundary-carina-free-scout-paid.md`, `18-case-study-pages.md`

## Files to create

- `carinaai.uk/enterprise/index.html`
- `docs.carinaai.uk/docs/user/enterprise.md`
- `instructions/outreach/enterprise-sales-one-pager.md` (internal PDF-ready markdown)

## Files to modify

- `carinaai.uk/pricing/index.html` (Enterprise contact CTA)
- `carinaai.uk/index.html` (footer nav Enterprise)

## Step-by-step

1. Enterprise offering components (document all; implement contact flow only in this prompt):

   - **Support SLAs**: email + optional dedicated Slack channel; response times by severity
   - **Dedicated instances**: single-tenant Carina Cloud on request
   - **Custom domain packs**: VERLOX or partner builds vertical pack under contract
   - **Compliance assistance**: GDPR, NHS DSPT guidance (not legal advice disclaimer)
   - **Training**: kernel + pack development workshops

2. Public page `carinaai.uk/enterprise/index.html`:
   - Hero: "Carina Enterprise; build on the kernel with production support"
   - Who it is for: ISVs, regulated industries, teams shipping "Powered by Carina" products
   - Not included in MIT kernel (support, SLA, custom packs)
   - CTA form: mailto hello@carinaai.uk or simple contact form posting to existing support pipeline (check if form handler exists; if not, mailto only)

3. Docs mirror with link to Scout Enterprise if separate (labyrinthscout.com)

4. Internal one-pager for sales:
   - Pricing: "from £X/month" placeholder or "Contact us" only
   - Comparison: self-host free vs Cloud vs Enterprise
   - Proof points: Propreneur, Flitz, COMPASS links

5. Badge asset optional: "Carina Enterprise Supported" (SVG); NOT same as "Powered by Carina" (partner program is prompt `22`)

6. Disclaimer footer: Enterprise support is a commercial contract with VERLOX Ltd; kernel remains MIT.

## Expected behavior

- Enterprise prospects have a single URL and docs page
- Clear separation: MIT kernel free, Enterprise pays for VERLOX services

## Test

- Pages build/deploy with rest of marketing site
- No em-dashes in copy
- Enterprise page does not imply kernel license changes

## Pitfalls

- Do not publish specific SLA numbers without business approval; use "Custom SLA" or TBD
