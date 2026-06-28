**Status: COMPLETED 2026-06-23**

# Sprint 4 - Prompt 29: Aiva Marketing Positioning Polish

**Sprint:** 4
**Prompt number:** 29
**Primary agent:** Codex (static HTML) or Cursor
**Estimated hours:** 2-3 h
**Depends on:** 07-aiva-landing-page.md (archived baseline); `sprint-4-CARINA_AI_EMPLOYEE_PLAN.md` (GTM canon)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `01-devends/prompts/02-archived_prompts/archives_from_pending_prompts/sprint-4/action/`.

---

## Read First

1. `sprint-4-CARINA_AI_EMPLOYEE_PLAN.md` - canonical sentence and copy rules
2. `03-frontends/marketing/carinaai.uk/aiva/index.html` - current `/aiva` page
3. `03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/aiva/AivaHireClient.tsx` - app hire copy
4. `03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/aiva/workers/AivaWorkersClient.tsx` - empty state

---

## Context

Prompt 07 shipped `/aiva` with hero "Hire a worker. Not another chatbot." GTM review (2026-06-23) adopted a single ecosystem sentence and a comparison section. This prompt aligns live marketing and app empty states without a full redesign.

**Do not:** rename product to "AI Workforce"; add `carinaai.uk/scout` (Scout stays at labyrinthscout.com); use em dashes.

---

## Step 1: Hero and subhead (`aiva/index.html`)

Keep h1 direction (hire, not chatbot). Update subhead to include full stack:

```html
<p class="hero-lead">
  Hire an Aiva: an AI employee that works 24/7, backed by real humans,
  governed by Scout, and ready in minutes.
</p>
```

Primary CTA: **Start free** -> `https://aiva.carinaai.uk/register` (or existing trial URL).
Secondary CTA: **See Aiva in action** -> anchor to conversation mock or `#how-it-works`.

Add one line below CTAs (small, muted):

```html
<p class="hero-tagline">Powered by Carina. Governed by Scout. Backed by VERLOX humans.</p>
```

---

## Step 2: "Why Aiva is different" section

Insert after hero or before pricing. Two-column comparison:

**Heading:** `Why Aiva is different`

| Others | Aiva |
|--------|------|
| AI only | AI + human VA backup included |
| No governance | Scout monitored and auditable |
| Generic workflows | Built on real VA operations |
| No escalation path | Human reply in your channel |
| Another chatbot | A named employee you hire |

Use existing site tokens (`--amber`, `--border`, card grid). No emojis.

---

## Step 3: Scout trust block

Existing trust section should link to `https://labyrinthscout.com` with copy:

> Every Aiva is governed by Scout: audit trail, permission boundaries, and operator oversight.

Do not imply Scout is hosted under carinaai.uk.

---

## Step 4: Tier teaser (workforce framing)

Near pricing or CTA footer, three pills:

- **Starter** - 1 Aiva
- **Team** - up to 5 Aivas
- **Business** - unlimited Aivas + white-label

Link to `app.carinaai.uk/billing/aiva` or register funnel.

---

## Step 5: App copy alignment

In `AivaHireClient.tsx` and `AivaWorkersClient.tsx` empty state:

- Page title / h1: **Hire an Aiva**
- Subtext includes: "Powered by Carina. Backed by real humans when it matters."
- Do not change onboarding step 6 ("Meet your Aiva"); that stays celebration-only.

---

## Step 6: Meta and SEO

```html
<title>Hire an Aiva | VERLOX</title>
<meta name="description" content="Hire an Aiva: AI employees for WhatsApp, email, and web chat. Powered by Carina, governed by Scout, backed by real humans. 15-day free trial.">
```

---

## Done When

- [x] `/aiva` hero subhead uses canonical positioning (hire + humans + Scout + minutes)
- [x] "Why Aiva is different" comparison section present
- [x] Scout links to labyrinthscout.com only
- [x] Tier teaser uses 1 / 5 / unlimited Aiva framing
- [x] App hire page and empty state aligned with "Hire an Aiva" + Carina/human line
- [x] No em dashes; no "AI Workforce" as primary headline
- [x] `python3 ../scripts/fix-writing-style.py` clean on edited HTML/TSX if run from carina root
