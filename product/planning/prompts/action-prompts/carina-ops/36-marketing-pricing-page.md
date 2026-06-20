# Carina Ops Sprint 7.1: Marketing and pricing page

## Goal

Update `carinaai.uk` to sell Carina AI (free) and Carina Ops (paid) with clear pricing ladder.

## Context

- Site: `carinaai.uk/index.html`, `style.css`, `app.js`
- Scout mentioned as optional companion only; no cross-sell as main message
- Pricing: Free, Carina Ops Starter £49, Carina Ops Team £99

## Dependencies

- `24-billing-plan-ids.md`

## Files to modify

- `carinaai.uk/index.html`
- `carinaai.uk/style.css` (if new pricing section needs layout)
- `carinaai.uk/app.js` (if pricing toggle or CTA tracking)

## Step-by-step

1. Hero section:

- Headline: Carina AI
- Subhead: autonomous agent, free to start
- CTA: "Start free" -> `https://app.carinaai.uk/hosted-register`

2. Secondary section: Carina Ops

- Promise: "Bring your own keys, govern your agents, audit everything, control spend."
- Bullets: BYOK, workbench, usage, audit, team admin
- CTA: "See ops plans" scroll to pricing

3. Pricing table (three columns):

| Free | Ops Starter £49/mo | Ops Team £99/mo |
|------|-------------------|-----------------|
| Personal agent | 3 members | 25 members |
| Limited history | BYOK, workbench | + deployments, exports |
| | Basic audit | 90-day audit |

4. Scout footnote (small):

```text
Need agent governance and protection? See Labyrinth Scout at labyrinthscout.com
```

5. Do not link `ops.carinaai.uk` as customer login anywhere.

6. No emojis. No em dashes. Match existing site typography.

## Expected behavior

- Visitor understands free vs paid in one scroll
- All CTAs point to `app.carinaai.uk`, not ops host

## Test

Manual review in browser.
Validate links resolve.
Run writing style check if bulk copy changed:

```bash
python3 /opt/lampp/htdocs/verlox/scripts/fix-writing-style.py carinaai.uk/index.html
```
