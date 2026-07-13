# Active implementation prompts

**Updated:** 2026-07-13

`pending/` holds prompts that still need code, docs, verification, or launch work. Verified-complete build prompts live under `../archived/`. Long-lived specs, architecture references, and checklists live under `../reference-prompts/`.

For the full library structure, read `../INDEX.md` and `../docs/AGENT-RULES.md`.

## Active work

No executable build prompts are pending as of 2026-07-13.

### Scout console mutual architecture (Prompts 34-36)

| File | What it is | Status |
|------|-----------|--------|
| `../archived/scout-console--34-carina-scout-mutual-architecture.md` | Carina-Scout mutual architecture foundation | **Archived 2026-07-09** |
| `../archived/scout-console--35-carina-agentic-security-layer.md` | Agentic security layer on Carina side | **Archived 2026-07-09** |
| `../archived/scout-console--36-scout-protects-carina.md` | Scout governance protecting Carina runtime | **Archived 2026-07-09** |

### Aiva provisioning, marketplace, onboarding (Prompts 37-41)

| File | What it is | Status |
|------|-----------|--------|
| `../archived/aiva-provisioning--01-agent-provisioning-wizard.md` | NL role description to live worker (Prompt 37) | **Archived 2026-07-09** |
| `../archived/aiva-marketplace--01-agent-template-marketplace.md` | One-click template marketplace (Prompt 38) | **Archived 2026-07-09** |
| `../archived/aiva-onboarding--01-abc-simple-two-step-complete-welcome.md` | Two-step onboarding + welcome email (Prompt 39) | **Archived 2026-07-09** |
| `../archived/aiva-onboarding--02-mobile-first-frictionless-channels.md` | Mobile-first shell + channel setup (Prompt 40) | **Archived 2026-07-09** |
| `aiva-onboarding--03-aiva-is-carina-applied.md` | Product positioning: Aiva = Carina applied (Prompt 41) | Phase 2 pending |

### Carina capabilities (Prompts 42-43)

| File | What it is | Status |
|------|-----------|--------|
| `../archived/carina-capabilities--01-unified-runtime-manifest.md` | Unified runtime capability manifest (Prompt 42) | **Archived 2026-07-09** |
| `../archived/carina-capabilities--02-safe-execution-gate.md` | Safe capability execution gate (Prompt 43) | **Archived 2026-07-09** |

### KNIME adoption pack (2026-07-09)

| File | What it is | Status |
|------|-----------|--------|
| `../reference-prompts/knime-adoption--00-architecture-reference.md` | Series map | Reference |
| `../reference-prompts/knime-adoption--BUILD-ORDER.md` | Cross-product build order | Reference |
| `../archived/knime-adoption--01-agent-studio-playbook-embed.md` | Embed Keprix Visual Studio | **Archived 2026-07-09** |
| `../archived/knime-adoption--02-aiva-property-starter-graph.md` | Deal analyse template + Aiva hire | **Archived 2026-07-09** |
| `../archived/knime-adoption--03-scout-agent-lifecycle.md` | Deploy/monitor/drift/retrain | **Archived 2026-07-09** |
| `../archived/knime-adoption--04-integrations-hub-surface.md` | Carina connector marketplace UI | **Archived 2026-07-09** |
| `../archived/knime-adoption--05-worker-playbook-runner.md` | Aiva triggers Keprix playbook runs | **Archived 2026-07-09** |

Keprix counterparts: prompts **233-238** in `keprix/planning/prompts/pending-prompts/`. Master reference: `keprix/planning/prompts/reference/233-knime-adoption-master-reference.md`. Carina pack complete; live E2E blocked on Keprix 233/234/237.

### Aiva native social channels (archived 2026-07-09)

Build prompts 01-07: `../archived/aiva-social-channels--01` through `07`. Pack index: `../archived/aiva-social-channels--README.md`.
Reference (spec, deploy order, agent rules): `../reference-prompts/aiva-social-channels--*`.
Deploy verification: `../reference-prompts/aiva-social-channels--BUILD-ORDER.md` and `apps-on-keprix/xeclone/HOSTING.md`. Code complete; live deploy verification remains manual.

### Propreneur v3 (prompts 10-32)

Executable prompts for Phase 3+ ship gate: `propreneur/v3-prompts/propreneur-v3--10` through `--32` (plus `10b`, `14b`).
Prompts 01-09 are archived under `../archived/propreneur-v3--*`.
Planning hub: `carina/02-backends/proprenuer-v3/`.

### Aiva launch readiness (reference; gate NOT READY)

| File | What it is | Status |
|------|-----------|--------|
| `../reference-prompts/aiva-launch-readiness.md` | Launch gate checklist for first paid customer | Code pass 2026-07-08; gate NOT READY |
| `../reference-prompts/aiva-launch-readiness-AUDIT.md` | Per-item audit with evidence | Updated 2026-07-08 |

**Shipped in 2026-07-08 code pass:** Email Handler poll-to-draft pipeline, OAuth + IMAP connect, paid checkout welcome email, FAQ + quickstart doc, Starter = 2 employees marketing alignment.

**Still manual:** legal placeholders, live Stripe, uptime monitoring, backup restore drill, founder dogfood week.

### Reference docs (not in pending)

| Doc | Location |
|-----|----------|
| Aiva launch gate + audit | `../reference-prompts/aiva-launch-readiness*.md` |
| Pricing strategy + Stripe ops | `../reference-prompts/pricing-strategy.md` |
| Paddle registration guide | `../reference-prompts/aiva-business-plan--00-paddle-registration-guide.md` |
| Mutation engine architecture | `../reference-prompts/mutation-engine--00-architecture-reference.md` |

## Recently archived (selected)

| Area | Completed |
|------|-----------|
| Carina Aiva cost controls, workspace comms, and WhatsApp Web setup | 2026-07-13 |
| Carina TUI Command Center pack | 2026-07-13 |
| Carina capabilities manifest + gate (Prompts 42-43) | 2026-07-09 |
| Aiva provisioning + onboarding 37, 39-40 | 2026-07-09 |
| Scout console mutual architecture 34-36 | 2026-07-09 |
| Aiva social channels 01-07 | 2026-07-09 |
| Mutation engine 01-06 | 2026-07-06 |
| Propreneur v3 01-09 | 2026-07-06 |
| Keys server 01 | 2026-07-06 |
| Platform gap pack, carina-mobile, scout-bundling | 2026-07-04 |

Full list: `../archived/` and [PENDING-INDEX.md](PENDING-INDEX.md).

## Agent workflow

1. **Before you start:** Read [PATH-MAP.md](PATH-MAP.md). Check `../archived/` for COMPLETED copies.
2. **While building:** Follow [REUSE-RULES.md](REUSE-RULES.md) for Carina voice and naming.
3. **When finished:** Follow [POST-BUILD-CHECKLIST.md](POST-BUILD-CHECKLIST.md), refresh the pending index, then commit.

## Folder layout

```
pending/              Executable build prompts only
docs/                 Agent rules, indexes, checklists (this folder)
reference-prompts/    Specs, architecture refs, build orders
archived/             Completed build prompts
```

No prompt-index build script exists in this folder at this snapshot; update [PENDING-INDEX.md](PENDING-INDEX.md) manually after moves.
