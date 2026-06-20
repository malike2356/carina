# Carina Marketing Site Upgrade - Overview and Context

## What this series is

A complete redesign of `carinaai.uk/index.html` from its current state to the final approved positioning.

There are 5 prompts in this series numbered 01 through 05. Each prompt is self-contained with exact HTML, CSS, and copy. Execute them in order. No prompt depends on work outside this folder.

## Current state problems

The current `carinaai.uk/index.html` (2,557 lines) has the following issues that the redesign fixes:

1. The page title and meta description lead with "self-hosted AI agents that do the work" - this is feature language, not positioning language.
2. The hero headline does not match the approved "Your work lives in 20 apps. Your intelligence shouldn't." hook.
3. There is no Learning Loop section anywhere visible - the moat is invisible.
4. The tagline used throughout is "Intelligence. Connected. Evolving." - this has been superseded by "One Memory. One Agent. Everywhere."
5. The page has too many sections and loses clarity before the user reaches the differentiators.
6. The overall colour palette and font system is serviceable but does not match the Linear/Stripe/Vercel design inspiration.

## Approved final positioning (do not change these)

- Tagline: One Memory. One Agent. Everywhere.
- Hero hook: YOUR WORK LIVES IN 20 APPS. YOUR INTELLIGENCE SHOULDN'T.
- Category claim: The Operating System for Knowledge Work
- Section order: Hero - Moat (Learning Loop) - One Memory (Channels) - Workspace - Scout cross-sell - Final CTA

## File locations

- Marketing site: `/opt/lampp/htdocs/verlox/carina/carinaai.uk/index.html`
- Assets referenced: `/opt/lampp/htdocs/verlox/carina/carinaai.uk/assets/`
- Demo GIFs referenced in copy (may exist or may need creating as placeholders):
  - `workspace-demo.gif`
  - `learning-demo.gif`
  - `channels-demo.gif`
  - `security-demo.gif`

## Design system for this redesign

```css
:root {
  --bg:           #06090f;
  --bg-lift:      #0c1118;
  --bg-card:      #111722;
  --border:       rgba(255,255,255,0.07);
  --border-mid:   rgba(255,255,255,0.12);
  --green:        #16c97e;
  --green-dim:    rgba(22,201,126,0.12);
  --green-glow:   rgba(22,201,126,0.20);
  --text-primary: #f0f4f8;
  --text-mid:     #8a9bb0;
  --text-dim:     #4d6070;
  --amber:        #f5a623;
  --ff-sans:      'Inter', system-ui, sans-serif;
  --ff-display:   'Inter', system-ui, sans-serif;
  --r:            6px;
  --r-md:         10px;
  --r-lg:         16px;
  --transition:   200ms cubic-bezier(0.4,0,0.2,1);
}
```

Accent colour is green (#16c97e), not teal. This matches the app.carinaai.uk product colour so the landing page and product feel like one system.

## Font

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

## What is NOT changing

- The nav link structure (Tools, Channels, Memory, Skills, Scout, Pricing, Docs, GitHub)
- The pricing section (keep existing pricing if present, or omit if not present)
- The footer link structure
- The `/assets/pwa/` favicon references

## Deployment

After editing: `bash /opt/lampp/htdocs/verlox/carina/scripts/deploy-marketing.sh`

Do not deploy until all 5 prompts are complete and the page has been reviewed in a browser.
