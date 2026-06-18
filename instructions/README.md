## 7 Pillars of Engineering

1. **Security first** - Security is not a feature. It is the foundation every decision sits on.
2. **AI powered from foundation** - AI is woven into the architecture from inception, not stitched on after the fact.
3. **No emojis, no fluff, direct but warm** - Speak like a human. Clear, concise, professional. No filler.
4. **No em-dashes, no en-dashes, no AI typography** - If a human wouldn't type it, neither should the output. Plain ASCII, natural cadence, no machine artefacts.
5. **Cause no risk to data, information, assets, or finance** - What people entrust to us must never be harmed. No data loss, no financial damage, no compromised assets.
6. **Ethical, within the bounds of human ethics** - Build in a way that is natural, sustainable, and protective of well-being. Technology serves people, not the other way around.
7. **Compliance with law and regulation** - Know the jurisdiction. Follow the law. Whether local or global, operate within the legal framework of the geography you serve.

---

## Instructions Directory Map

```
instructions/
│
├── build-plan/          BUILD PLAN AND ROADMAP
│   ├── AGENTS.md        Agent architecture decisions
│   ├── COMPARISON.md    Feature comparison vs competitors (marketing accuracy rules)
│   ├── ROADMAP.md       Ordered build roadmap
│   ├── TARGET.md        Target user and market
│   ├── TOOLS.md         Tool inventory and decisions
│   ├── UNIQUE.md        Carina's differentiators
│   ├── WORKFLOW.md      Development workflow
│   └── archive/         Superseded planning docs (do not delete; useful for context)
│
├── design/              VISUAL AND UX DESIGN
│   ├── branding/        Brand decisions and journey
│   │   ├── decisions/   Logo and UI decisions with rationale
│   │   └── journey/     Design process documentation
│   ├── images/          Reference images for design work
│   │   ├── carina/      Carina product screenshots and mockups
│   │   └── scout/       Scout product screenshots and mockups
│   └── prompts/         ChatGPT and image-gen prompts for design work
│       ├── prompt_01_launcher_primary.md    Screen 1 launcher redesign
│       ├── prompt_02_launcher_sidebar.md    Screen 2 sidebar nav redesign
│       └── prompt_03_tui.md                TUI terminal interface redesign
│
├── media/               AUDIO/VIDEO AND SENSITIVE FILES (gitignored)
│   └── what_is_carina*.mp3   Voice recordings about product positioning
│
├── operations/          OPERATIONAL RUNBOOKS AND CHECKLISTS
│   Deployment, configuration, audits, kanban, readiness checks
│
├── outreach/            SALES, PARTNERSHIPS, ENTERPRISE
│   Pitch decks, templates, one-pagers, university and partner kits
│
├── product/             PRODUCT IDENTITY AND POSITIONING
│   ├── PRODUCT_BIBLE.md          Canonical product definition
│   ├── MANIFESTO.md              VERLOX/Carina manifesto
│   ├── WHAT_IS_CARINA.md         What Carina is (distilled)
│   ├── CARINA_CATEGORY.md        Market category definition
│   ├── LABYRINTH_SCOUT_BIBLE.md  Scout product definition
│   └── what_is_carina*.txt       Raw voice-to-text transcripts
│
├── prompts/             AGENT BUILD PROMPTS (prompt packs for Carina development)
│   ├── researched_gap/  Gap analysis and research prompts
│   └── the_Ultimate_Carina_Upgrade/  12-gap upgrade prompt series
│
├── security/            SECURITY DOCUMENTATION AND HARDENING
│   Threat models, hardening checklists, incident SLAs
│
├── strategy/            PRODUCT STRATEGY AND THINKING
│   ├── competitive/     Analysis vs Hermes, OpenClaw, Odysseus, Claude
│   └── *.md             Architecture strategy, positioning, platform thinking
│
└── trust/               TRUST AND OPERATOR ACCOUNTABILITY
    Operator trust log templates, trust build checklists
```
