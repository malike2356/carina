# Carina Skill Roadmap

**Date:** 2026-06-15  
**Catalog:** `core.carinaai.uk/src/skills/packs/` + `pack-manifests.ts`  
**Reference:** Hermes ~115 procedural skills (excluding gaming); Carina targets curated quality over raw count.

## Current snapshot

| Metric | Count |
|---|---:|
| Shipped pack manifests | 18 |
| On-disk pack modules | 17 (+ template) |
| Curated pack skills | **120** |
| npm-only packs | 2 (`property-uk`, `healthcare`) |
| Template / demo | 1 (`hello-world-template`, not counted) |

Enable packs with `ACTIVE_SKILL_PACKS=operator-daily,core-engineering` or `carina packs install <name>`.

## Catalog by domain

| Pack | Skills | Category | Daily operator value |
|---|---:|---|---|
| `operator-daily` | 12 | operator | **P0** workspace, memory, backups, email, MCP |
| `core-engineering` | 19 | engineering | **P0** coding, GitHub, TDD, orchestration |
| `productivity` | 8 | productivity | **P0** Google, Notion, OCR, weather |
| `devops` | 9 | devops | **P1** CI, Docker, K8s, backups, disk |
| `email-extended` | 5 | email | **P1** Himalaya, templates, triage |
| `research-basics` | 5 | research | **P1** arXiv, investigation |
| `media-extended` | 6 | media | **P2** Spotify, TTS, video |
| `social-extended` | 6 | social | **P2** X, Discord, Slack |
| `data-science` | 8 | data | **P2** pandas, SQL, stats |
| `finance` | 5 | finance | **P2** VAT, invoicing |
| `creative-basics` | 7 | creative | **P2** diagrams, mockups |
| `mlops` | 6 | mlops | **P3** training, HF hub |
| `smart-home` | 5 | smart-home | **P3** Home Assistant |
| `legal-uk` | 6 | legal | vertical |
| `sales-crm` | 5 | sales | vertical |
| `borehole-africa` | 8 | africa | vertical (npm) |
| `property-uk` | 6 | property | vertical (npm) |
| `healthcare` | 5 | healthcare | vertical (npm) |

## Gap analysis vs Hermes (non-gaming)

| Hermes area | Carina status | Action |
|---|---|---|
| memory-consolidation | **Shipped** | `operator-daily/memory-consolidation` |
| obsidian / notes | **Shipped** | `productivity/obsidian-notes` + `workspace-notes-tasks` |
| kanban orchestration | **Shipped** | `devops/kanban-sprint`, `core-engineering/multi-agent-orchestration` |
| webhook subscriptions | **Shipped** | `devops/webhook-integrations` |
| backup / disk cleanup | **Shipped** | `devops/backup-migration`, `disk-space-reclamation` |
| Linear / issue trackers | **Shipped** | `operator-daily/linear-issues` |
| scheduled voice briefings | **Shipped** | `operator-daily/scheduled-voice-briefing` |
| MCP native client | **Shipped** | `operator-daily/mcp-server-connect` |
| workspace surfaces | **Shipped** | notes, documents, images gallery skills |
| gaming (minecraft, pokemon) | **Skipped** | policy |
| dogfood / red-teaming | **Deferred** | P3; not daily operator |

## Priority queue (future, not yet built)

### P2 (next wave, only if demand)

- `comprehensive-investigation` deep research playbook (overlap with `carina research` CLI; keep as skill not duplicate)
- `client-proposals` PDF + template workflow (partial overlap with `generate-pdf`)
- `teams-meeting-pipeline` calendar + notes (needs CalDAV)

### P3 (vertical / niche)

- Healthcare pack body on npm (`@verlox/pack-health`)
- Additional creative skills (excalidraw, manim) without duplicating `creative-basics`

### Explicitly not planned

- Duplicate GitHub skills (already 6 in `core-engineering`)
- Gaming skills
- Raw skill inflation to match Hermes 115 without operator value

## Discovery and visibility

| Surface | Behavior |
|---|---|
| `carina packs list` | All manifests from `PACK_MANIFESTS` |
| `skills-list` tool | DB skills after `loadPackSkills` |
| Agent prompt injection | Only skills from **active** packs (`ACTIVE_SKILL_PACKS`) |
| RAG corpora | Pack-scoped; general mode uses `user-resources` only |
| Hub | Optional publish via `carina pack publish` |

Pack skills are **hidden** from the agent until the pack is enabled; user-authored skills in `CARINA_RESOURCES_DIR` are always allowed.

## Validation

```bash
cd core.carinaai.uk
pnpm exec vitest run src/skills/skill-catalog.test.ts
pnpm exec vitest run src/skills/pack-loader.test.ts
```

`skill-catalog.test.ts` enforces unique names, manifest `skillCount` alignment, and minimum skill shape.

## Maintenance rules

1. One skill = one clear outcome; avoid near-duplicate triggers across packs.
2. `toolsUsed` must list real Carina tool names (see `TOOL_INVENTORY.md`).
3. Update `skillCount` in both `pack.json` and `pack-manifests.ts`.
4. Register new on-disk packs in `pack-resolver.ts` `LEGACY_PACK_LOADERS`.
5. Run `skill-catalog.test.ts` before merge.
