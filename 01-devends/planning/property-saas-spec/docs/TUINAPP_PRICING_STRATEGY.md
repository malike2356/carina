# TuinApp Pricing Strategy - Competitive Analysis & Recommendation

**Date:** 2026-05-26
**Context:** Pricing research against UK/US staff management + HR platforms. Carina is positioned as the moat that stretches value above competitors at the same price point.
**Source:** May 2026 market data, competitive analysis against BrightHR, Parim, Ubeya, Connecteam, Deputy, When I Work, HiBob, BambooHR.

---

## Competitive Landscape (May 2026)

| Tool | Free tier | Lowest paid | Mid-tier | Top tier | Pricing model |
|---|---|---|---|---|---|
| **BrightHR (UK)** | None | £16.67/mo for 5 staff (~£6/employee) | £21.20/mo per 5-staff block (Enhanced, +24/7 advice line) | £28.20/mo per 5-staff block (Full + EAP) | Per-employee, 24-60 mo contracts |
| **Parim** | None | £47/mo starting | Custom (Professional) | Custom (Premium) | Flat fee, unlimited users, by shift volume |
| **Ubeya** | Free for invited users only | $4/active worker ($50/mo min, Basic) | $7/active worker ($259/mo min, Pro) | $10/active worker ($499/mo min, Super) | Per active worker booked that month |
| **Connecteam** | Free up to 10 users | $29/mo flat for 30 users (Basic, per hub) | $49/mo (Advanced) | $99/mo (Expert) | Flat per-hub, then +per-user above 30 |
| **Deputy** | None | $5/user/mo (Lite, $30 min) | $6.50/user/mo (Core) | $9/user/mo (Pro) | Pure per-user |
| **When I Work** | 14-day trial | $2.50/user/mo (single location) | $5/user/mo (multi-location) | - | Pure per-user, cheapest mass-market |
| **HiBob** | None | ~$16/emp/mo | ~$20/emp/mo | ~$25/emp/mo | Mid-market HRIS, quote-only |
| **BambooHR** | None | ~$10/emp/mo (Core, $250/mo min ≤25 emp) | ~$17/emp/mo (Pro) | ~$25/emp/mo (Elite) | Quote-only |

---

## What The Data Reveals

### Free Tier Dynamics
- Half the market has **no free tier** (BrightHR, Deputy, HiBob, BambooHR, Parim)
- The half that does (Connecteam, Ubeya, Homebase) treats it as an **acquisition funnel**, not a real product
- A free tier is a competitive weapon BrightHR can't easily copy (they'd have to give away their advice line)

### Pricing Model Patterns
- **Flat-fee with generous staff cap** (Parim, Connecteam) wins on transparency
- **Per-user pricing** scales scary fast: BrightHR at 30 employees on Enhanced = £636/mo. That's how they make their margin - and how they lose deals
- **Per-user model** creates friction as teams grow (every new hire costs more)
- **Flat model** builds loyalty (add staff, same price)

### The Sweet Spot
- **£50-£100/mo flat** for the workhorse tier is the SMB-plus sweet spot
- Below £50: looks like a toy
- Above £150: enters BambooHR's lane where they'll out-feature you on pure HR depth

---

## Recommended Pricing: Trial → Pro → Enterprise (Final Model)

Flat fee + staff cap model (Parim-style). **No permanent free tier.** Free is replaced by a time-limited full-access trial.

| Tier | Mechanism | What it includes | Position vs market |
|---|---|---|---|
| **30-day trial** | Full Pro access. No credit card required. "Long enough for one complete payroll cycle." After day 30: account becomes **read-only** (not blocked - still log in, view data, export). Banner: "Activate Pro to unlock writes." Data preserved (no purge) until tenant explicitly closes account or hits 12-month dormant policy (GDPR-friendly). | Same as Pro for 30 days. No Carina after trial ends. | No forever-drain on Carina LLM costs. Read-only state preserves data so we don't lose them to "they deleted everything" perception. Beats BrightHR (no trial at all) and When I Work (14-day only). CTA: "Start free trial" (no card). |
| **Pro (most popular)** | £79/mo flat (25 staff included, then £3 per extra staff) | All 10 pillars (CRM + accounting + safety + L&D + engagement + AR + ATS) + Carina 500 actions/mo + public API + webhooks + MCP + priority support | 40-60% below BrightHR Enhanced for the same headcount (BrightHR Enhanced 25 emp ≈ £530/mo). Sits at Parim's price floor but with 10× the feature surface. £79 is the "you can't ignore this" number. |
| **Enterprise** | from £299/mo custom | Unlimited staff + SSO/SAML + custom domain + full white-label + Carina unlimited actions + dedicated CSM + 99.95% SLA + dedicated tenant cluster option + reseller programme | Below HiBob enterprise (~£500-780/mo for 25 emp). Above Connecteam's $119/mo Expert. Pitched to multi-site/regulated buyers. |

### Trial Mechanics (After Day 30)

```
Day 0: Sign up → Full Pro access (30 days)
         │
         ├── User subscribes (card) → Pro tenant, ongoing
         │
         └── Day 31: No payment
                   │
                   ▼
         Account goes read-only:
           ┌──────────────────────────────────────────────┐
           │  WARNING:  Trial ended. Activate Pro to unlock     │
           │  writes and keep using Carina. Your data is │
           │  safe - nothing has been deleted.          │
           │                                            │
           │  [Activate Pro - £79/mo]                    │
           └──────────────────────────────────────────────┘
                   │
                   ├── User activates → Full Pro restored
                   │
                   └── User never activates → 12-month dormant policy
                             → Account auto-closed, data permanently deleted
                               (GDPR-compliant)
```

### Why This Beats Option A's Permanent Free Tier

| Consideration | Permanent Free Tier | 30-Day Trial + Read-Only |
|---|---|---|
| Carina LLM cost drain | £10/mo per free tenant, forever - costs scale with signups, not revenue | Zero after day 30. Only paying users consume LLM resources. |
| User psychology | "Free forever" doesn't create urgency to upgrade | Day 31 read-only block is a natural conversion trigger |
| Data retention | Users might abandon data with no incentive to return | Read-only preserves their work, they can come back anytime - and they know their data is waiting |
| Brand perception | Free tier can signal "not a serious product" if too generous | 30-day full-access trial signals confidence. "We know you'll love it in one payroll cycle." |
| Competitive strength | BrightHR has no free tier - but Connecteam does (10 users) | 30-day full-access beats Connecteam's limited free tier and BrightHR's nothing. No one offers a full-access no-CC trial at this depth. |
| CTA clarity | "Sign up free" - generic | "Start free trial" (converters) + "Join waitlist" (not ready yet) - two distinct intents |

---

## Why £79 and Not £49 / £99 / £149

| Price | Verdict |
|---|---|
| **£49** (old Starter price) | Too low. Buyers think "what's broken?" and we don't fund Carina LLM costs (~£10/mo per active tenant). |
| **£79** Done:  | Under the £80 psychological barrier. Massive discount vs BrightHR Enhanced. Funds infra comfortably (~£61 gross margin/tenant after LLM + Stripe + hosting). |
| **£99** (old Growth-equivalent rebased) | Fine, but loses the "shocking value" narrative against BrightHR. Defensible if you want more margin headroom. |
| **£149** (old Growth price) | Now puts us above Parim's £47 by 3× without a unique feature story. Hard to defend without invoking ATS depth. |

---

## Why a Single Paid Tier (Not Pro + Business)

Old plan had 4 tiers (Starter, Growth, Business, Enterprise). Compressing into Free → Pro → Enterprise is stronger because:

1. **No decision paralysis.** Buyers pick "the paid one" or "talk to us"
2. **Forces bundling.** Everything that justifies the moat (Carina, ATS, AR, accounting) lives in Pro - we can't accidentally gate the moat behind a higher tier
3. **Sales motion is binary.** Self-serve = Pro. Multi-site/regulated = Enterprise. No mid-funnel friction

---

## Carina's Role in Pricing

**Carina is the moat - she should be the price-stretcher, not the price-justifier.**

People pay £79/mo because Carina drafts the contract, not despite it. The tier structure should never gate Carina behind a higher tier. She lives in Pro, making Pro the obvious choice:

- **Trial:** Carina (full access, 30 days) - enough to get addicted
- **Pro:** Carina (500 actions/mo) - enough to run a business
- **Enterprise:** Carina (unlimited) - for power users

**No Carina on read-only accounts.** Once the trial ends without payment, Carina stops. This is intentional - Carina's LLM costs are the biggest variable expense. Only paying tenants should consume her. The "Powered by TuinApp" branding on exports still exists regardless of trial status.

---

## Unit Economics (Per Pro Tenant)

| Line | £/mo |
|---|---|
| Revenue | +79.00 |
| Carina LLM (Gemini Flash + Claude Sonnet mix, 500 actions cap) | -10.00 |
| Stripe processing (~3%) | -2.37 |
| Shared infra amortised (DB + Reverb + Meilisearch + storage on Contabo VPS) | -3.00 |
| Email + SMS + push (Postmark/Twilio/Expo) | -2.50 |
| **Gross margin per Pro tenant** | **+61.13** |

**Note:** No permanent free tier means zero Carina LLM drain on non-paying users. Trial users consume ~£30 of LLM costs over 30 days (full Carina access), but trials convert at sufficient rates to absorb this. Running the numbers: if trial-to-Pro conversion is even 15-20%, the £30 trial cost per converted user is recovered in the first month of subscription.

**Scaling:** 100 Pro tenants = £6,113/mo gross. 1,000 Pro tenants = £61K/mo gross. Healthy.

---

## Open Questions (For Next Session)

- [ ] Confirm DeepSeek V4 Flash pricing for final Carina LLM cost calculation
- [ ] Should the "£3 per extra staff" above 25 cap scale linearly or hit a ceiling?
- [ ] Enterprise minimum threshold - is £299/mo right or should it be £249?
- [ ] Annual discount structure - 20% off? 25% off?
- [ ] Carina action limits for Pro - 500/mo right or need adjusting?
- [ ] Trial duration - 30 days (one payroll cycle) or 14 days (standard)?
- [ ] Read-only grace period - how many days after trial end before locking? (Current: immediate on day 31)
- [ ] Auto-close dormant accounts - 12 months the right threshold?
