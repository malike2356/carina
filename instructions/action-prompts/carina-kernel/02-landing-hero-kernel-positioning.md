# Carina Kernel Phase 1: Landing page hero and kernel positioning

## Goal

Update `carinaai.uk` so the hero and above-the-fold copy position Carina as "the free, open-source kernel for AI agents."

## Context

- Current hero title in `carinaai.uk/index.html`: "Carina; self-hosted AI agent for operators"
- Target hero from `CARINA_AS_LINUX.md`: "The free, open-source kernel for AI agents"
- Sub-hero: "Build AI agents. On anything. For anything."
- Three-column value props: "Any model. Any channel. Any domain."
- Install command stays `npm install -g carina-agent` until prompt `08` renames the package
- Trust badges: MIT | 71 tools | 23 providers | 18 channels | Scout-optional (not "Scout-secured" as default)
- Brand rules: `core.carinaai.uk/docs/kernel/BRAND_RULES.md`
- Manifesto link from prompt `01` should appear in footer or hero secondary CTA

## Dependencies

`00-lock-brand-and-boundaries.md`, `01-manifesto.md`

## Files to modify

- `carinaai.uk/index.html` (hero, meta tags, og:title, og:description)
- `carinaai.uk/style.css` or inline styles in `index.html` if hero layout needs a third column
- `scripts/deploy-marketing.sh` (only if new static assets are added)

## Step-by-step

1. Read `carinaai.uk/index.html` in full. Locate the hero `<section>` and existing three-feature grid (or equivalent).

2. Update `<title>`, meta description, og:title, og:description, twitter:title, twitter:description to kernel positioning:

   - Title: `Carina; the free, open-source kernel for AI agents`
   - Description: mention MIT, tools, memory, channels, domain packs; Scout as optional commercial layer

3. Replace hero headline with:

   ```html
   <h1>The free, open-source kernel for AI agents</h1>
   ```

   Subheadline:

   ```html
   <p class="hero-lead">Build AI agents on any model, any channel, any domain. MIT licensed. Built in the UK.</p>
   ```

4. Add or update a three-column section directly under the hero:

   | Column | Heading | Body |
   |--------|---------|------|
   | 1 | Any model | 23 LLM providers, BYOK, automatic fallback |
   | 2 | Any channel | 18 adapters: Telegram, Slack, email, web, and more |
   | 3 | Any domain | Optional skill packs; install only what you need |

5. Keep the install code block:

   ```bash
   npm install -g carina-agent
   carina setup
   carina chat
   ```

6. Add trust badge row (small caps or pill badges): `MIT` `71 tools` `23 providers` `18 channels` `16 packs`

7. Primary CTA: "Get started" links to `https://carinaai.uk/docs/user/getting-started`
   Secondary CTA: "Read the manifesto" links to docs manifesto page from prompt `01`

8. Do not remove existing sections (security, use cases) in this prompt; only reframe intro copy where it says "self-hosted operator agent" to "kernel/platform" where accurate.

9. Verify mobile layout: three columns stack vertically under 768px (match existing responsive patterns in the file).

## Expected behavior

- First-time visitor understands Carina as an open platform kernel within 5 seconds
- OG/social previews show kernel positioning when link is shared

## Test

- Open `carinaai.uk/index.html` locally or via static server; hero text matches spec
- `grep "kernel for AI agents" carinaai.uk/index.html` matches at least title and h1
- No claim that Scout is free or included by default
