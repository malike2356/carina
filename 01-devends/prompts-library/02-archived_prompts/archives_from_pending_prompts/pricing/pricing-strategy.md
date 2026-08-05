# Pricing Strategy - All Products

**Status: COMPLETED 2026-07-19**

**What was built:** Live prices follow /.access/.stripe-credentials-and-price-id.md (Starter £49 / Team £99 / Business £199). public-pricing + billing slots aligned. Seat add-on checkout wired; STRIPE_PRICE_AIVA_SEAT_MONTHLY still needs founder SoT entry before live seat sales.


`scripts/stripe-setup-aiva.ts` (Aiva) and `keys-server/scripts/stripe-setup-keys-products.py`
(Mutant keys, Petraclus). Run against test mode first; founder sign-off before live mode.

**Last updated:** 2026-06-30

This document sets specific prices across all Verlox products based on market
positioning, willingness-to-pay analysis, and the Scout discount ladder.

---

## Labyrinth Scout (Existing, confirm prices before using elsewhere)

These are the authoritative Scout prices. RAG-007-scout-governance.md and
PRODUCT_POSITIONING.md both use £79 for Govern. Confirm against live Stripe
before publishing.

| Tier | Price | What It Includes |
| --- | --- | --- |
| Monitor | £49/month | Monitoring, threat detection, audit log search, 6-channel alerts, weekly report |
| Govern | £79/month | Everything in Monitor + kill switch, compliance export, injection shield, egress filter, honeypots, deception layer, JIT credentials, forensic tools |
| Enterprise | Custom | Dedicated infrastructure, custom log retention, SLA, SOC 2 evidence package |

---

## Carina Aiva

### Pricing Philosophy

Position against human labour cost (UK VA rates), not against SaaS tools.
A part-time UK VA costs £240-360/month. The AI Employee at £49/seat/month
is a trivially easy comparison.

### Tiers

| Tier | Monthly Price | What Is Included |
| --- | --- | --- |
| Starter | £149/month | 1 AI Employee, Scout Govern (free), 3 channel integrations, basic approval workflow, 1,000 tasks/month |
| Growth | £349/month | 5 AI Employees, Scout Govern (free), 10 channel integrations, advanced approval workflow, 10,000 tasks/month, priority support |
| Enterprise | Custom | Unlimited employees, SSO/SAML, dedicated infrastructure, SLA, custom onboarding, compliance package |

### Per-Seat Expansion

When a customer exceeds their included employee count:
- Additional AI Employee: £49/month each
- No limit on additional seats (important for growth customers)

### Annual Discount

12 months upfront: 2 months free (16.7% discount).
Starter annual: £1,490/year (vs £1,788 monthly).
Growth annual: £3,490/year (vs £4,188 monthly).

### Free Trial

14-day free trial. No credit card required. Limited to 1 AI Employee, 100 tasks.
Scout Govern included during trial (shows its value before purchase).

### Scout Bundling

Scout Govern (£79/month value) is included free at all Aiva paid tiers.
Do not show Scout as a separate line item in Aiva billing. It is bundled.
Do not advertise the saving on the Aiva pricing page - this creates confusion.
The message is: "AI Employees with built-in governance." Not "AI Employees plus
a £79 bonus."

---

## Carina Mutant

Mutant is MIT and free. The only revenue mechanism is Aiva Keys for optional
gated features (the key server).

### Aiva Key Tiers for Mutant

| Tier | Price | What It Unlocks |
| --- | --- | --- |
| Free | £0 | Core agent, local tools, 1 LLM provider, Telegram integration, basic memory |
| Basic | £9/month | 5 LLM providers, 5 channels, email integration, contacts sync, full memory |
| Pro | £29/month | All 23 LLM providers, all channels, deep research, cron automation, SDK access, mobile app |
| Developer | Free (local keypair) | All features, for contributors and developers building on Mutant |

Note: Keys are checked against keys.carinaai.uk. The keys server must be live
for paid tiers to work.

Scout for Mutant: full price, not discounted. Scout Monitor at £49/month or
Scout Govern at £79/month. Shown as optional in the Governance settings page.

### Revenue Forecast From Mutant Keys

This is supplementary revenue, not the primary model. With 500 users:
- 70% free, 20% Basic, 10% Pro = 100 Basic + 50 Pro
- Monthly: (100 x £9) + (50 x £29) = £900 + £1,450 = £2,350/month
- This is modest but meaningful for a free open-source product.

---

## Petraclus

### Pricing Philosophy

Anchor against Burp Suite Pro (£399/year = ~£33/month) and Metasploit Pro
(enterprise only). Position Petraclus as "the AI-native alternative": correlated
findings, automated report drafting, and case management that neither Burp nor
Metasploit provides.

### Tiers

| Tier | Price | What It Includes |
| --- | --- | --- |
| Community | Free | 3 active cases, OSINT and passive recon only, 2 report templates, 1 user, no active tools |
| Pro | £59/month | Unlimited cases, full tool set (all 72 tools), all report templates, API access, Scout Govern 50% for 12 months |
| Team | £159/month | Everything in Pro, up to 5 users, case sharing, client portal, team audit log |
| Enterprise | Custom | Unlimited users, dedicated infrastructure, SLA, SOC 2 evidence package, custom report templates |

### Scout Discount for Petraclus

Pro and Team: 50% off Scout Govern for the first 12 months.
- Scout Govern at full price: £79/month
- 50% discount: £39.50/month
- This is delivered as a promo code from keys.carinaai.uk on Pro/Team activation.
- After 12 months: standard Scout Govern price (£79/month). User must explicitly
  continue or the Scout subscription lapses.

Community: no Scout discount. No promo code.

### Annual Discount

Pro annual: £590/year (vs £708 monthly, saving £118 = ~2 months free).
Team annual: £1,590/year (vs £1,908 monthly).

### Revenue Model Analysis

For Petraclus to be a meaningful business, it needs 50+ Pro customers.
50 Pro = £2,950/month MRR. 10 Team = £1,590/month. That is £4,540/month from
Petraclus alone at modest penetration. This is achievable within 12 months of
launch given the security community's active tool adoption behaviour.

The key driver: Mutant community as the top-of-funnel. Mutant users who work
in security or build security tools will discover Petraclus. The conversion rate
from open-source Mutant user to Petraclus Pro customer is the most important metric
to track.

---

## Stripe Configuration Checklist

Before any product can accept payments:

- [ ] Create Verlox Ltd Stripe account (or confirm existing one)
- [ ] Set business address and company number in Stripe (matches legal docs)
- [ ] Create products in Stripe (scripts in repo; do not hand-create in dashboard):
  - [ ] Carina Aiva: `cd core.carinaai.uk && tsx scripts/stripe-setup-aiva.ts`
  - [ ] Mutant keys + Petraclus: `cd keys-server && python scripts/stripe-setup-keys-products.py`
- [ ] Copy printed price IDs into `.env` (core) and `keys-server/.env`
- [ ] Webhook endpoints (two destinations):
  - [ ] Aiva: `https://core.carinaai.uk/api/billing/stripe/webhook` (existing handler)
  - [ ] Keys (Mutant/Petraclus): `https://keys.carinaai.uk/api/v1/stripe/webhook`
- [ ] Test checkout flow for each product with a test card
- [ ] Enable tax collection (UK VAT at 20% for digital services; `automatic_tax` on Aiva checkout)
- [ ] Set up customer portal (for customers to manage subscriptions)

## Unit Economics and Competitive Positioning (review 2026-06-30)

### Carina Aiva

| Metric | Value | Notes |
| --- | --- | --- |
| Starter ARPU | £149/mo | vs UK part-time VA £240-360/mo; 2-3x cheaper than labour |
| Growth ARPU | £349/mo | 5 seats included; £69.80/seat effective vs £49 add-on |
| Scout bundle cost | £79/mo (internal) | Govern bundled free; real COGS if Scout infra is marginal |
| Extra seat | £49/mo | Pure expansion revenue; no Scout increment |
| Starter annual | £1,490/yr | 16.7% discount; improves cash flow and reduces churn |
| Break-even (illustrative) | ~8 Starter or 3 Growth | At ~£1,200/mo infra + API costs (estimate; validate at launch) |

Positioning: anchor on labour replacement, not SaaS comparables (Zapier, Intercom).
A £149/mo email-handling employee with governance is an easy CFO conversation.

### Carina Mutant keys

| Tier | Price | Conversion assumption |
| --- | --- | --- |
| Basic | £9/mo | Power users who need more channels |
| Pro | £29/mo | Developers running production workflows |

At 500 MAU with 20% Basic + 10% Pro: ~£2,350/mo supplementary (see forecast above).
Primary value is funnel to Petraclus and Aiva, not key revenue.

### Petraclus

| Competitor anchor | Price | Petraclus Pro |
| --- | --- | --- |
| Burp Suite Pro | ~£33/mo (£399/yr) | £59/mo (AI correlation + case mgmt justify premium) |
| Metasploit Pro | Enterprise only | Pro accessible to independents |

50 Pro customers = £2,950 MRR; 10 Team = £1,590 MRR. Mutant community is top-of-funnel;
track Mutant-to-Petraclus conversion as primary GTM metric.

### Scout standalone

Monitor £49 and Govern £79 sit below enterprise SIEM (£500+/mo) and above "nothing."
Bundled into Aiva; standalone for self-hosted Mutant is incremental, not core revenue.

---

## Pricing Review Policy

Review all prices 6 months after each product launches. Adjust based on:
- Conversion rate at each tier (if >30% take the highest tier, Pro is too cheap)
- Churn rate (if >5%/month, price may be too high or product not delivering value)
- Competitor price changes (monitor Burp Suite, Metasploit, and emerging AI security tools)
- Scout uptake rate (if few Petraclus customers convert to Scout, the discount is not working)

Do not change prices during the first 6 months. Early customers form pricing expectations.
Any increase requires 30 days notice and must not apply to existing subscribers
(grandfather existing pricing for 12 months after a price increase).
