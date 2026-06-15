# Carina Kernel Phase 4: Premium domain pack marketplace revenue

## Goal

Design and implement the revenue model for premium domain packs on Carina Hub: community free, premium paid, revenue share, Carina-certified badge.

## Context

- Strategy: `CARINA_AS_LINUX.md` Phase 4 item 13
- Hub infrastructure: prompts `10`, `11`
- Pack packages: prompt `13`
- phase5-advanced `04-unique-features-marketplace.md` previously declined full marketplace; this prompt scopes **paid packs on Hub only**, not a general tool app store

## Dependencies

`11-hub-carinaai-uk-site.md`, `13-extract-domain-pack-packages.md`

## Files to create

- `core.carinaai.uk/src/skills/hub/billing/pack-checkout.ts`
- `core.carinaai.uk/src/skills/hub/migrations/00X-premium-packs.sql`
- `docs.carinaai.uk/docs/developer/selling-a-pack.md`

## Files to modify

- `core.carinaai.uk/src/skills/hub/server.ts` (premium pack metadata, Stripe checkout session)
- `core.carinaai.uk/src/skills/hub/public/index.html` (price badge, buy flow)
- `core.carinaai.uk/src/cli/commands/pack/install.ts` (license check after purchase)
- `core.carinaai.uk/.env.example` (`STRIPE_PRICE_PACK_*`, revenue share config)

## Step-by-step

1. Schema extension (Postgres hub DB):

   ```sql
   ALTER TABLE packs ADD COLUMN pricing_tier TEXT DEFAULT 'free' CHECK (pricing_tier IN ('free', 'premium', 'certified'));
   ALTER TABLE packs ADD COLUMN price_gbp_cents INT;
   ALTER TABLE packs ADD COLUMN author_revenue_share_bps INT DEFAULT 7000; -- 70%
   ALTER TABLE packs ADD COLUMN carina_revenue_share_bps INT DEFAULT 2000; -- 20%
   ALTER TABLE packs ADD COLUMN platform_fee_bps INT DEFAULT 1000; -- 10%
   ```

2. Business rules document in `selling-a-pack.md`:
   - Community packs: free, author maintains
   - Premium packs: author sets price; revenue split 70/20/10
   - Carina-certified: VERLOX review + badge; may be free or premium

3. Hub UI:
   - Free packs: `carina pack install` only
   - Premium packs: "Buy" creates Stripe Checkout; on success webhook grants license token stored in `~/.carina/pack-licenses.json`

4. `carina pack install` for premium:
   - Requires valid license or prompts checkout URL

5. Author dashboard (minimal v1):
   - `GET /api/author/packs` with sales count (authenticated authors only)
   - Full dashboard can be Phase 4.1; document API stub if UI deferred

6. Stripe Connect or manual payout: v1 can record sales and manual payout monthly (document in selling-a-pack.md); automate Connect in follow-up prompt if needed.

7. Tests: webhook grants license; install fails without license; install succeeds after mock purchase.

## Expected behavior

- Free packs unchanged
- Premium pack purchase flow completes on staging Stripe
- Revenue split documented for authors

## Test

```bash
cd core.carinaai.uk && pnpm test src/skills/hub/
```

- Stripe test mode checkout for one fixture premium pack

## Pitfalls

- Premium packs still MIT source optional; payment is for maintained/certified distribution on Hub, clarify in docs
- Tax/VAT: "prices ex VAT" for UK B2B unless billing system handles VAT
