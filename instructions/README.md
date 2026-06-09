# Carina Build Workspace

Instructions, action prompts, and build-plan docs for Carina.

## Current status

See `prompts/do_this_next.md` for the live capability matrix and prompt completion status.

See `BUILD_NEXT_CHECKLIST.md` for the full Standalone Carina vs Hermes vs Propreneur comparison and the Hermes tool gap build queue.

See `TRUST_BUILD_CHECKLIST.md` for the Carina + Labyrinth Scout + blockchain trust moat build tracker (update checkboxes when you ship items).

## Product identity

Carina standalone is a **general-purpose autonomous agent**. Domain knowledge (property, healthcare, finance, etc.) is available only through optional skill packs the operator enables. No vertical pack is active by default.

## Skill packs (all optional)

Enable with `ACTIVE_SKILL_PACKS=pack1,pack2`:

| Pack | Domain |
|---|---|
| property-uk | UK property |
| healthcare | Healthcare admin |
| finance | Finance and accounting |
| core-engineering | Coding, GitHub, debugging |
| creative-basics | Design, diagrams, ideation |
| productivity | Google, Notion, OCR, weather |
| research-basics | arXiv, RSS, investigation |

## User resources

```
CARINA_RESOURCES_DIR/   (default: ~/.carina/resources)
  skills/               JSON skill files
  knowledge/            Markdown for RAG
  packs/                Custom pack directories
```

Use `@resources/path` in file tool paths.

## Structure

```
instructions/
  prompts/              Spec files (what to build)
  action-prompts/       Cursor-ready build instructions (status: mostly DONE)
  build-plan/           Reference docs (TARGET, TOOLS, ROADMAP)
  strategy/             Architecture decisions
```

## Remaining work

1. Background process tool (phase2-tools/02-process)
2. Scout dashboard HTML frontend (phase5-advanced/03-scout-dashboard)
3. Scout test triage (FINAL_AUDIT.md)

Gaming skills and cross-agent handoff are excluded by policy.
