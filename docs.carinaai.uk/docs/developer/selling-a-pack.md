# Selling a domain pack on Carina Hub

This guide is for authors who want to publish **free community packs**, **premium paid packs**, or **Carina-certified** packs on [hub.carinaai.uk](https://hub.carinaai.uk).

Payment is for **maintained Hub distribution**, updates, and optional certification. Pack source may remain MIT; buyers pay for convenience and support, not a proprietary kernel license.

---

## Pricing tiers

| Tier | Price | Who maintains | Badge |
|------|-------|---------------|-------|
| **free** | &pound;0 | Author | Community |
| **premium** | Author sets price (ex VAT) | Author + Hub billing | Premium |
| **certified** | Free or premium | VERLOX review | Carina-certified |

### Revenue split (premium packs)

Default split on each sale:

| Party | Share |
|-------|-------|
| Author | 70% |
| VERLOX (Carina) | 20% |
| Platform fee | 10% |

Configure defaults with `HUB_PACK_AUTHOR_REVENUE_SHARE_BPS`, `HUB_PACK_CARINA_REVENUE_SHARE_BPS`, and `HUB_PACK_PLATFORM_FEE_BPS` on the Hub server.

**Payouts (v1):** sales are recorded in the Hub database. VERLOX pays authors **monthly by manual bank transfer** after invoice reconciliation. Stripe Connect automation is planned for a follow-up release.

**Tax/VAT:** list prices **ex VAT** unless your Stripe account is configured for tax-inclusive checkout. UK B2B customers may provide a VAT number on invoice.

---

## Publish a free pack

```bash
carina pack publish ./my-pack
```

Requirements:

- Valid `pack.json` (see [Creating packs](/docs/user/skill-packs/creating-packs))
- At least one knowledge `.md` file
- No `.env` or secrets in the tarball
- `CARINA_HUB_TOKEN` or `SKILLS_HUB_PUBLISH_KEY` for production Hub

Free packs install with:

```bash
carina pack install my-pack
```

---

## List a premium pack

1. Publish the pack tarball (same CLI as free).
2. Ask VERLOX ops to set Hub metadata on `skill_packs`:

   - `pricing_tier = 'premium'`
   - `price_gbp_cents` (e.g. `1999` for &pound;19.99 ex VAT)
   - Optional `stripe_price_id` or env `STRIPE_PRICE_PACK_<SLUG>`

3. Buyers click **Buy** on the Hub pack page. Stripe Checkout completes.
4. Webhook `checkout.session.completed` grants a license token.
5. Buyer saves token to `~/.carina/pack-licenses.json` (Hub UI can fulfill after redirect).
6. `carina pack install <slug>` sends the license on download.

Premium install without a license returns HTTP 402 and a checkout URL.

---

## Carina-certified packs

Certified packs pass VERLOX review for quality, security boundaries, and eval coverage. They may be free or premium.

- Badge: **Carina-certified** on Hub (distinct from community **verified** official packs).
- Certification does not change the MIT kernel license.
- Contact hello@carinaai.uk to request certification review.

---

## Author dashboard (API v1)

Full UI is deferred. Authors with a publish API key can query sales counts:

```bash
curl -s -H "X-Api-Key: $CARINA_HUB_TOKEN" \
  "https://hub.carinaai.uk/api/author/packs?author=Your%20Name"
```

Response includes `sales_count` per pack from `pack_sales`.

---

## License storage

After purchase, licenses live in:

```
~/.carina/pack-licenses.json
```

Example:

```json
{
  "licenses": {
    "my-premium-pack": {
      "packName": "my-premium-pack",
      "token": "pack_abc123...",
      "email": "buyer@example.com",
      "purchasedAt": "2026-06-14T12:00:00.000Z"
    }
  }
}
```

The Hub webhook also stores tokens server-side in `pack_licenses` for validation.

---

## What buyers get

- Tarball download from Hub while license is valid
- Updates to the published version on Hub (license is per pack name, not per version pin; major breaking changes may require a new product listing)
- No Scout or Carina Cloud subscription included

---

## What is not included

- Legal advice for regulated deployments
- Custom SLAs (see [Carina Enterprise](/docs/user/enterprise))
- Automatic npm private registry (use `@carina/pack-*` npm publish separately if needed)

---

## Hub operator env vars

```bash
HUB_STRIPE_SECRET_KEY=sk_test_...
HUB_STRIPE_WEBHOOK_SECRET=whsec_...
HUB_CHECKOUT_SUCCESS_URL=https://hub.carinaai.uk/?purchase=success
HUB_CHECKOUT_CANCEL_URL=https://hub.carinaai.uk/?purchase=cancel
STRIPE_PRICE_PACK_MY_PREMIUM_PACK=price_...   # optional per-pack Stripe Price ID
HUB_PACK_AUTHOR_REVENUE_SHARE_BPS=7000
HUB_PACK_CARINA_REVENUE_SHARE_BPS=2000
HUB_PACK_PLATFORM_FEE_BPS=1000
```

Webhook endpoint: `POST /api/webhooks/stripe/packs`

---

## Related docs

- [Carina Hub user guide](/docs/user/hub)
- [Publishing a pack](/docs/developer/publishing-a-pack)
- [Build your first domain pack](/docs/developer/first-domain-pack)
- [Commercial boundaries](/docs/user/pricing)
