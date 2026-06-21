# Carina Kernel Phase 1: Write the manifesto

## Goal

Publish a one-page manifesto at `MANIFESTO.md` that answers what Carina is, why it exists, and why developers should build on it.

## Context

- Brand rules: `core.carinaai.uk/docs/kernel/BRAND_RULES.md` (from prompt `00`)
- Strategy source: `CARINA_AS_LINUX.md` sections "The Analogy" and "One Sentence Positioning"
- Canonical docs site: `docs.carinaai.uk/` (Docusaurus); manifesto lives at repo root for GitHub/npm visibility
- Writing style: no em-dashes, no emojis; run `python3 ../scripts/fix-writing-style.py` on the file when done

## Dependencies

`00-lock-brand-and-boundaries.md`

## Files to create

- `MANIFESTO.md` (repo root: `/opt/lampp/htdocs/verlox/carina/MANIFESTO.md`)
- `docs.carinaai.uk/docs/developer/manifesto.md` (short Docusaurus page linking to full manifesto or embedding it)

## Files to modify

- `docs.carinaai.uk/sidebars.ts` (add manifesto under Developer section)
- `core.carinaai.uk/README.md` (link to `../MANIFESTO.md` or copy one-line link)
- `carinaai.uk/index.html` (footer link "Manifesto" pointing to `https://carinaai.uk/docs/developer/manifesto` or `/MANIFESTO.md` on GitHub)

## Step-by-step

1. Write `MANIFESTO.md` with these sections (keep total length under 120 lines):

   - **Opening** (2 paragraphs): Carina is the free, open-source kernel for building AI agents. Built in Portsmouth, UK. MIT forever.
   - **The problem** (1 paragraph): fragmented agent stacks; every team reinvents tools, memory, channels.
   - **What the kernel provides** (bullet list): tools registry, memory/RAG, model routing (23 providers), channels (18 adapters), skill/pack system, MCP.
   - **What is not the kernel** (table): Scout (commercial security), Carina Ops (hosted SaaS), products (Propreneur, Flitz, COMPASS).
   - **The Linux analogy** (short table mirroring `CARINA_AS_LINUX.md` kernel/security/distro/hub rows).
   - **Who should build on Carina**: ISVs, vertical SaaS, internal platforms, researchers.
   - **Call to action**: `npm install -g carina-agent`, read "Build your first domain pack", contribute on GitHub.
   - **License**: MIT. Scout is optional and commercial.

2. Use this anchor quote verbatim in the opening:

   > Carina is the free, open-source kernel for building AI agents. It provides everything an agent needs: tools, memory, channels, model routing, so you can focus on what your agent does, not how it runs.

3. Create `docs.carinaai.uk/docs/developer/manifesto.md` as a Docusaurus page with front matter:

```yaml
---
title: Manifesto
sidebar_position: 1
---
```

Either `@include` the manifesto content or summarize in 3 paragraphs with a link to `https://github.com/malike2356/carina-agent/blob/main/MANIFESTO.md` (adjust URL if public repo path differs).

4. Wire sidebar entry in `docs.carinaai.uk/sidebars.ts` under the developer docs group.

5. Add footer link on `carinaai.uk/index.html` (match existing footer link pattern in that file).

## Expected behavior

- A developer landing on GitHub or docs understands Carina as a platform kernel, not a single chatbot product
- Manifesto clearly states Scout is commercial and Carina core is free

## Test

- `wc -l MANIFESTO.md` is between 60 and 120 lines
- `cd docs.carinaai.uk && pnpm build` succeeds
- No em-dashes in `MANIFESTO.md` (`grep -P '[\x{2013}\x{2014}]' MANIFESTO.md` returns nothing)
