# Business Model and Platform Architecture

## The Tollbooth Strategy

Carina's commercial architecture is modelled on payment network infrastructure, not on
application software. The distinction matters for how revenue scales.

An application charges per seat or per user. When you grow, you hire more support staff, ship
more features, and the cost of serving each customer stays roughly proportional to revenue.
Margin is capped by headcount.

Infrastructure charges per transaction. Building the road is the upfront cost. Every vehicle
that uses the road pays a toll. The road does not care how many vehicles are on it; it just
collects the toll. Visa operates on this model with 67% gross margin because Visa owns the
routing layer, not the risk layer. Banks lend money and carry default risk. Visa routes messages
about money and earns a fraction of every message.

Carina's equivalent:

| Visa role | Carina equivalent | Current state |
|---|---|---|
| Banks carry credit risk | Users bring their own AI API keys (BYOK) | Built |
| Merchants absorb interchange | AI model cost is embedded in partner pricing | Partial |
| Visa owns routing only | Carina owns orchestration and governance | Core: built |
| Two roads for the planet | Carina positioned as the standard | Not yet established |

The question driving every architectural decision: does this make Carina more like Visa
(infrastructure that earns on volume) or more like Barclays (a vendor that lends risk)?

## The Four Revenue Layers

### Layer 1: Platform Subscriptions (Carina)

| Tier | Price | What It Covers |
|---|---|---|
| Self-Hosted | Free (MIT) | Full agent, self-managed, no Scout, community support |
| Cloud | GBP 29/workspace/month | Hosted, all agent capabilities, basic analytics |
| Cloud + Scout Monitor | GBP 78/workspace/month | Cloud plus Scout monitoring and alerting |
| Cloud + Scout Govern | GBP 128/workspace/month | Cloud plus full Scout governance suite |
| Enterprise | Custom | Dedicated, SSO, data residency, SLA |

The free tier is the acquisition engine. Developers self-host, build things on Carina, and when
they take those things to production with real client data, they need Scout.

### Layer 2: Aiva Workforce Subscriptions

| Tier | Price | What It Covers |
|---|---|---|
| Starter | GBP 149/month | 1 AI worker, all pre-built roles, email + WhatsApp, VA backup |
| Team | GBP 349/month | Up to 5 workers, all channels, priority VA backup |
| Business | GBP 699/month | Up to 15 workers, white-label, dedicated VA liaison |
| Enterprise | Custom | Unlimited workers, custom roles, dedicated VA team, SLA |

### Layer 3: Scout Standalone

| Tier | Price | What It Covers |
|---|---|---|
| Scout Monitor | GBP 49/month/cluster | Observe: monitoring, audit log, 6-channel alerts |
| Scout Govern | GBP 99/month/cluster | Act: kill switch, compliance export, injection shield |
| Enterprise | Custom | Dedicated, SOC 2 evidence, regulatory support |

Sold to any company running any AI agent, regardless of whether they use Carina.

### Layer 4: Metered Usage (Tollbooth)

Beyond the included volume in each subscription tier, usage is metered:

| Event Type | Billable Unit | Notes |
|---|---|---|
| AI message (tokens) | Per 1,000 tokens | Cost plus margin (65% margin floor enforced) |
| Tool call | Per call | Flat micro-fee |
| Skill invocation | Per invocation | Flat micro-fee |
| Scout audit record | Per record | Flat micro-fee |
| Webhook delivery | Per webhook | Flat micro-fee |
| Memory read/write | Per operation | Flat micro-fee |

Implementation: Stripe Usage Records, wired to `platform_events` table in PostgreSQL via
`src/billing/platform-event-emitter.ts`. The margin floor (`MARGIN_FLOOR = 0.65`) is enforced
in `src/hosted/margin-report.ts`.

### Layer 5: Partner API (White-Label)

Technology companies who embed Carina in their own products become certified platform partners:

| Partner Tier | Price | Includes |
|---|---|---|
| Starter | GBP 99/month | Up to 5 client workspaces, API access, revenue share |
| Agency | GBP 299/month | Up to 25 client workspaces, higher revenue share |
| Enterprise | Custom | Unlimited workspaces, custom revenue share, dedicated support |

Partners earn subscription revenue from their clients. VERLOX earns a metered toll on every
AI event in the partner's product. Both grow together without additional VERLOX headcount.

### Layer 6: Marketplace Revenue Share

Third-party skill pack authors publish to the marketplace. Every paid pack installation splits
revenue:
- Author: their `author_revenue_share_bps` (basis points, stored on `pack_submissions` row)
- VERLOX: its `carina_revenue_share_bps`
- Platform fee: `platform_fee_bps` on the transaction

The schema for these fields exists in the skills hub database (`hubPool`). The submission,
review, and payout flow is built (TB-006 sprint).

## Existing Commercial Infrastructure (Built)

The following commercial infrastructure is live in the codebase:

**Partner accounts:** `partner_accounts` table, `partner-service.ts` (create, get, list, link),
`partner-brand.ts`, `partner-billing.ts`, `partner-pack-catalog.ts`.

**Partner API keys:** `partner_api_keys` table, `partner-api-key-service.ts` (create, rotate,
revoke, hash-compare), `partner-gateway-auth.ts` middleware, `partner-rate-limit.ts` middleware.

**Platform events:** `platform_events` table, `platform-event-emitter.ts` (emit with partner_id,
org_id, event_type, tokens_in, tokens_out, model, latency_ms, metadata).

**White-label plans:** `white-label-plans.ts` (Starter GBP 99/5 workspaces, Agency GBP 299/25
workspaces, Enterprise custom), `margin-report.ts` (65% floor enforcement).

**Stripe billing:** `hosted-billing.ts` (subscription management, usage records), `billing-routes.ts`
(webhook handling), `aiva-subscription-store.ts` (subscription state queries).

**Admin console:** `admin.carinaai.uk` has Partner admin (list, detail, suspend, API key revoke),
Marketplace admin (submission list, review, approve, reject, publish), and usage analytics.

**Partner self-service:** `app.carinaai.uk/developer/` has API key management (create, scope,
revoke) and usage dashboard (charts, groupBy, CSV export).

## The Network Effect Logic

The platform becomes more valuable as more participants join:

- More partners: more AI events, more toll revenue, more case studies
- More skill pack authors: richer marketplace, more reasons for new users to choose Carina
- More enterprise Scout customers: more compliance precedents, better SOC 2 positioning
- More self-hosters: community knowledge, bug reports, pull requests, Scout discovery

This is why the MIT license on the core is a revenue strategy, not charity. Self-hosters are the
top of the funnel. They build things on Carina. When those things reach production, they need Scout
(revenue). When their clients want the managed version, they point them to Aiva or the hosted
platform (revenue). When they build a product on Carina, they become a partner (revenue).

## Unit Economics Target

The 65% gross margin floor (`MARGIN_FLOOR = 0.65` in `margin-report.ts`) is the target at scale.
At current stage:
- AI model API costs are the primary variable cost (passed through at cost + margin)
- Infrastructure (server, bandwidth) is largely fixed
- VA team (Aiva) is a step function, not linear (the same team scales to 50+ Aiva clients before
  a headcount addition is needed)
- Engineering (founder time) is effectively zero in cash terms at current stage

As partner volume grows and metered usage generates compounding revenue, the margin profile
approaches the Visa model: high volume, low marginal cost, high structural margin.
