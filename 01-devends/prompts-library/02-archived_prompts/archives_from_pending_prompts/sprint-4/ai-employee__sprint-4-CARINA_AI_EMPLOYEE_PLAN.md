# Carina AI Employee; Product Plan

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

**Status:** GTM canon (archived from pending 2026-06-25; Sprint 4 closed)
**Date:** 22 June 2026 (updated 23 June 2026)
**Author:** Laud Paul-Gablah
**Implementation index:** `02-archived_prompts/sprint-4-action-README.md`

---

## Canonical positioning (use everywhere)

**One sentence (footer, billing, onboarding email, `/aiva` subhead):**

> Hire an Aiva. Powered by Carina. Governed by Scout. Backed by real humans.

**Hero headline (marketing + app empty states):** *Hire an Aiva.*

**Hero subhead (marketing `/aiva`):**

> An AI employee that works 24/7, backed by real humans, governed by Scout, and ready in minutes.

**Celebration copy (onboarding step 6 only):** *Meet your Aiva.* Do not use as homepage hero.

**Do not use pre-launch:** "AI Workforce" as primary category name; "employ.carinaai.uk"; em dashes in any copy.

---

## Brand stack

| Layer | What it is | Buyer sees it? |
|-------|-----------|----------------|
| **VERLOX** | Company | Yes (footer, trust) |
| **Carina** | Agent OS (orchestration, memory, tools, subagents) | No (tagline only: "Powered by Carina") |
| **Scout** | Governance, audit, signals | Yes (trust line; link to labyrinthscout.com) |
| **Aiva** | The hired worker (persona, channels, training) | Yes (primary product name) |
| **Human VA team** | Escalation pool, reply-in-channel, SLA | Yes (differentiator; not a separate SKU) |

**Customer mental model:** One named employee (Sarah, your Property Manager Aiva). Carina may spawn internal subagents; the customer never sees orchestration.

**Competitive frame:** Not ChatGPT (tool), not Carina alone (framework), not Spinnable alone (software-only employee). **AI employee backed by a real VA operation + Scout governance.**

---

## What This Is

Aiva is the customer-facing AI employee product: VERLOX's digital workforce layer on top of an existing VA business. Businesses hire Aivas that operate 24/7 on email, WhatsApp, Slack, and web, with human VA oversight included from day one.

When AI cannot handle a case, a human VA takes over in the same channel. The client sees results, not plumbing.

---

## Why This Works (moat order)

### 1. Real VA operations (primary moat)
VERLOX already runs a VA business. Real clients, workflows, edge cases, and a human pool (`admin.carinaai.uk/va-queue`). Competitors can copy UI; they cannot copy operations overnight.

### 2. Human-in-the-loop included
Not optional, not upsold. Escalation, VA reply, hand-back to Aiva, resolved emails. This is the selling point.

### 3. Scout governance
Audit trail, kill switch, fleet signals, Business-tier custom rules (`/settings/governance`). Procurement story; Scout stays a separate product at `labyrinthscout.com` (do not merge URLs).

### 4. One Aiva, many capabilities
Internal: Carina subagents/orchestration. External: one persona, one inbox experience. Do not sell "five agents, five bills."

---

## URL and surface map

### Marketing (`carinaai.uk`)
- `/`; Carina platform + ecosystem (enterprise/self-host audience)
- `/aiva`; **primary AI employee funnel** (exists; polish via prompt 29)
- Scout; link out to `https://labyrinthscout.com` (not `carinaai.uk/scout`)
- `/platform`; defer until post-launch (risk diluting Aiva funnel)

### Application (`app.carinaai.uk`)
- `/aiva`; hire and list workers
- `/aiva/workers/[id]`; worker detail
- `/billing/aiva`; subscriptions (Starter / Team / Business)
- `/settings/branding`, `/settings/governance`; Business tier
- No `app.carinaai.uk/scout` product surface; governance settings only

### Internal
- `admin.carinaai.uk`; VA queue, fleet, customers, revenue

### Cross-sell
- `va.verlox.uk`; banner: "Want AI workers alongside your human VA? Meet Aiva." → `carinaai.uk/aiva`

---

## Tier structure (workforce size)

Implemented in `slotLimitForTier()` (`aiva-stripe-checkout.ts`):

| Tier | Aiva slots | Buyer-facing label |
|------|------------|-------------------|
| **Starter** | 1 | Your first Aiva |
| **Team** | 5 | Your AI team (up to 5 Aivas) |
| **Business** | 999 (unlimited) | Scale your workforce; white-label, custom training, Scout rules |

Pricing (pence, migrations): Starter 2900, Team 9900, Business 29900 per month.

**Copy rule:** Team/Business upsell uses "grow your team" / "more Aivas," not "buy more agents."

---

## Pre-built roles (launch set; proto-marketplace)

Six templates in `aiva-role-templates.ts` (not a store yet):

| Role | Channels (default) |
|------|-------------------|
| Property Manager | WhatsApp, email |
| Outreach Coordinator | email |
| Financial Analyst | email, Slack |
| Content Assistant | email, Slack |
| Calendar Manager | WhatsApp, email |
| Customer Support | web, email |

**Phase 4+:** Aiva Role Marketplace (one-click install). **Launch:** templates at hire + onboarding only. Skill pack marketplace (`/packs`) remains a Carina power-user surface, not the Aiva buyer funnel.

---

## Marketing: "Why Aiva is different" (prompt 29)

Add to `03-frontends/marketing/carinaai.uk/aiva/index.html`:

| Others | Aiva |
|--------|------|
| AI only | AI + human VA backup |
| No governance story | Scout monitored |
| Generic playbooks | VERLOX VA workflow expertise |
| No audit trail | Full activity + escalation trail |
| Software company guessing | Services company that built software |

---

## Launch-ready loop (must work before public launch)

1. Register → onboarding → hire from role template → welcome on a real channel
2. Inbound message → Aiva reply → escalate → human VA replies in-channel → hand back
3. Stripe subscription + slot limits enforced (prompts 22-24)
4. Usage limits protect margins (prompt 19)
5. Escalation-resolved email to workspace owner (prompt 18, done)

---

## Sprint 4 execution priority (codebase audit 2026-06-24)

| Priority | Prompts | Why |
|----------|---------|-----|
| 1 | 09 onboarding | Time-to-value |
| 2 | 22-24 billing | Can charge reliably |
| 3 | 13, 14, 17 channels | Real delivery |
| 4 | 19 usage limits | Margin protection |
| 5 | 29 marketing polish | Narrative on live `/aiva` |
| 6 | 11 emails | Lifecycle completeness |
| 7 | 21 GDPR | Compliance |
| 8 | 26 admin fleet | Ops visibility |
| 9 | 02 infra security | Post-GTM hardening (IP allowlist after launch; see `docker/config/gtm-rollout.json`) |

Archived (do not re-open without new gaps): prompts 01, 03-29 except 02.

---

## Launch phases

### Phase 1: Internal dogfood (now)
VA team uses admin queue; AI assists; training flywheel.

### Phase 2: Beta (4-6 weeks)
5-10 existing VA clients; reduced pricing; measure TTFR and escalation rate.

### Phase 3: Public launch (8-12 weeks)
`/aiva` funnel, Stripe live, onboarding complete, channels reliable.

**Post-GTM security (after Phase 3 stable):** enable nginx IP allowlists on `admin.carinaai.uk` and staging. Config: `core.carinaai.uk/docker/config/gtm-rollout.json`. Env: `NGINX_ADMIN_IP_ALLOWLIST`, `NGINX_STAGING_IP_ALLOWLIST` (default `false` at launch).

### Phase 4: Enterprise + marketplace (ongoing)
White-label partners, role marketplace, self-host for regulated verticals.

---

## What we already have (repo)

- Carina platform, subagents, memory, skills
- Scout client, signal cache, governance settings
- Aiva API, role templates, hire UI, worker detail
- Channels: Slack, Telegram, WhatsApp/email partial, web widget partial
- VA queue, reply, hand-back, escalation emails
- Billing scaffold: Stripe checkout, slot limits, trial
- White-label branding, training tab, Scout governance (Business)
- Marketing `/aiva` page (needs prompt 29 polish)

---

## What still needs build (pending prompts)

**None** in `01-pending_prompts/`. Sprint-4 is closed.

**VPS only:** run `docker/docs/VPS-SECURITY-CLOSEOUT.md` on the server (fail2ban, certbot dry-run). IP allowlist is **after GTM setup** (`docker/config/gtm-rollout.json`; keep `NGINX_*_IP_ALLOWLIST=false` at launch).

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| AI hallucinates to a client | Escalation + VA reply; confidence thresholds; training from resolutions |
| Human VAs overwhelmed | Queue priority, SLA metrics, learning loop |
| Competitor copies software | Cannot copy VA ops + client relationships quickly |
| Positioning sprawl (too many doors) | Single funnel: `carinaai.uk/aiva` → `app.carinaai.uk` |
| Premature "marketplace" promise | Templates at hire only until Phase 4 |

---

## The unfair advantage

> A services company using AI workers already knows what clients need, because human VAs have been doing it. When the AI breaks, a human VA fixes it.

That is not a feature. That is the business.
