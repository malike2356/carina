# Odysseus Gap Close + Playbook Series: Overview

**Date:** 2026-06-16
**Sources:**
- `instructions/strategy/PewDiePie_talks_about_Odysseus.txt.md` (Odysseus product pitch)
- `instructions/strategy/COOKBOOK_TO_PLAYBOOK_ROADMAP.md` (playbook architecture)
- `instructions/gap-analysis/ODYSSEUS_2026-06-15.md`
- `instructions/gap-analysis/odysseus_gap_analysis.md`
- Gap analysis from app.carinaai.uk production review (chat proxy, BYOK, stub research)

**Purpose:** Close every remaining gap between Carina and the Odysseus workspace story PewDiePie sells, while advancing model routing from **cookbook** (deterministic recipe) to **playbook** (situational plays with paths, scoring, and reasoning). We are not chefs. In cyber and ops, we run playbooks.

---

## Three Products, One Story

| Surface | Path | Role |
|---------|------|------|
| **Carina Cloud** | `app.carinaai.uk` | Hosted BYOK workspace for property professionals |
| **Carina Core** | `core.carinaai.uk` | Self-hosted agent kernel + `/workspace` surfaces |
| **Carina Ops** | `ops.carinaai.uk` | Internal admin (not the customer product) |

Prompts 01-17 in `app.carinaai.uk_ui_redesign_prompts/` already shipped the shell, rich chat, panels, library, tasks, research UI, themes, shortcuts. **This series finishes parity** and adds the playbook engine.

---

## Naming: Cookbook vs Playbook

| Term | Meaning | User-facing name |
|------|---------|------------------|
| **cookbook** | Internal module: hardware profile, model catalog, deterministic recommender | Deprecated in UI copy |
| **playbook** | Situational decision engine: task + constraints, multiple paths, scoring, domain plays | All new UI, CLI, docs |

Rules:
- Keep `src/cookbook/` as an internal dependency of `src/playbook/`. Do not delete it.
- Add `carina playbook` CLI. Keep `carina cookbook` as a hidden alias that prints a deprecation notice and forwards to `carina playbook hardware` (hardware-only subcommand).
- Routes: `/playbook` not `/cookbook`. Sidebar label: **Playbook**.
- Docs and marketing: "Playbook" only.

---

## Global Rules (All Prompts)

- Read every file in "Files to inspect first" before writing code.
- Never use em dashes or en dashes. Never use emojis. Plain ASCII only.
- TypeScript strict mode. PHP `declare(strict_types=1)` where applicable.
- Every new TS module needs matching `*.test.ts` unless the prompt says otherwise.
- Do not remove or rename existing public APIs without a deprecation shim (6 months).
- Do not add model calls to unrelated hot paths.
- Preserve Carina advantages: MIT license, Scout security, domain packs, channels, multi-tenancy.
- Match existing code style in each subproject.

---

## Build Order

Execute in order. Later prompts assume earlier ones unless marked independent.

### Track A: Carina Cloud (`app.carinaai.uk`) - Production and UX gaps

| # | Prompt | Priority | Depends on |
|---|--------|----------|------------|
| 01 | Production chat fix (proxy, BYOK gate, errors) | P0 | UI redesign 00-03 |
| 02 | Research core wiring + chat-about-results | P0 | 01 |
| 03 | Email workspace + auto-reply review flow | P1 | 01 |
| 04 | Document editor (human types, AI assists) | P1 | 01 |
| 05 | Calendar + CalDAV sync | P1 | 04 optional |
| 06 | Model compare page | P2 | 01 |
| 07 | Images gallery + editor | P2 | 01 |
| 08 | Personas + group chat | P2 | 01 |
| 09 | Brain panel: auto-extract memory/skills settings | P1 | UI redesign 08-09 |
| 10 | Library unified tabs (Chats, Documents, Research, Archive) | P1 | 02, 04 |
| 11 | Search and AI defaults settings | P2 | 01 |
| 12 | Mobile shell + PWA | P2 | UI redesign 00-02 |
| 13 | Node pairing bridge (cloud links to self-hosted host) | P2 | core O7 |
| 14 | Unified Brain panel (Memory + Skills + Settings tabs) | P1 | 09 |

### Track B: Carina Core (`core.carinaai.uk`) - Playbook engine

| # | Prompt | Phase | Depends on |
|---|--------|-------|------------|
| 20 | Playbook Phase 1: constraints + task classifier | Week 1-2 | existing `src/cookbook/` |
| 21 | Playbook Phase 2: path generator + scorer | Week 3-4 | 20 |
| 22 | Playbook Phase 3: domain plays (property, security, business) | Week 5-7 | 21 |
| 23 | Playbook Phase 4: learning loop + play curator | Week 8-10 | 22 |
| 24 | Playbook Phase 5: cross-product integration | Week 11-12 | 22 |
| 25 | Playbook workspace UI in core (`/playbook`) | UI | 21 |
| 27 | Cookbook-to-playbook migration (aliases, routes, copy) | Polish | 20, 25 |

### Track C: Carina Cloud Playbook surface

| # | Prompt | Depends on |
|---|--------|------------|
| 26 | Playbook page in app.carinaai.uk | 21, 01 |

### Already covered elsewhere (do not duplicate)

| Feature | Existing prompt |
|---------|-----------------|
| Three-zone shell, sidebar, sessions | `app.carinaai.uk_ui_redesign_prompts/02` |
| Rich messages, tool calls, input bar | `04-06` |
| Memory, skills, notes panels | `08-10` |
| Library, tasks, research UI shell | `11-13` |
| Themes, appearance, shortcuts | `14-16` |
| Ops agent tools config | `17` (ops.carinaai.uk) |
| Core: deep research executor | `ODYSSEUS_CLOSE_PROMPTS` O2 |
| Core: compare executor | O3 |
| Core: documents API | O4 |
| Core: notes/tasks | O5 |
| Core: images API | O6 |
| Core: node host/pairing | O7 |
| Core: MIT footer | O8 |

---

## Gap Scorecard (What This Series Closes)

| PewDiePie / Odysseus pitch | Before | After this series |
|----------------------------|--------|-------------------|
| Chat just works | Broken on production | 01 |
| Deep research with real output | Stub | 02 |
| Email read + auto-reply review | Core triage only | 03 |
| Document editor (you type, AI helps) | Core only | 04 |
| Calendar + NL scheduling | Notes reminders | 05 |
| Model compare | Core only | 06 |
| Image gallery/editor | Core only | 07 |
| Characters + group chat | CLI personality only | 08 |
| Memory/skills auto-extract | Hidden in ops | 09, 14 |
| Library with docs + research tabs | Sessions only | 10 |
| Cookbook hardware scan | `carina cookbook` | 20-21, 25-27 as **Playbook** |
| Situational "what should I do?" | Not built | 20-24 Playbook engine |
| Mobile | Responsive only | 12 |
| Self-hosted node on your machine | Core CLI | 13 |

---

## Verification Commands

After each track:

```bash
# Cloud
cd /opt/lampp/htdocs/verlox/carina/app.carinaai.uk
pnpm run build
pnpm test  # if configured

# Core
cd /opt/lampp/htdocs/verlox/carina/core.carinaai.uk
pnpm test
pnpm run build

# Deploy cloud (when ready)
bash deploy.sh
```

---

## Success Criteria (Series Complete)

1. User signs in at app.carinaai.uk, adds BYOK key, sends "hello", gets a streamed reply (01).
2. Research job returns real cited output from core, not placeholder text (02).
3. `/playbook` in core and cloud shows hardware + task form + 4 scored paths (20-21, 25-26).
4. Email, documents, calendar, compare, images reachable from cloud sidebar (03-07).
5. Brain panel has auto-extract toggles and confidence slider (09, 14).
6. Library has Chats, Documents, Research, Archive tabs (10).
7. `carina cookbook` prints deprecation and forwards to playbook (27).
8. At least 15 domain play YAML files load and evaluate (22).
