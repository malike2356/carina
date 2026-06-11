# Carina Build Workspace

Instructions, action prompts, and build-plan docs for Carina.

## Current status

See `prompts/do_this_next.md` for the live capability matrix and prompt completion status.

See `BUILD_NEXT_CHECKLIST.md` for the full Standalone Carina vs Hermes vs Propreneur comparison and the Hermes tool gap build queue.

See `build-plan/COMPARISON.md` and `../CONFIGURATION_READINESS.md` for **verified Carina metrics** (5,369 tests, 23 providers, 18 channel adapters, 71 tools, 16 packs, 96 curated skills). Use these in all marketing and comparison copy.

See `TRUST_BUILD_CHECKLIST.md` for the Carina + Labyrinth Scout + blockchain trust moat build tracker (update checkboxes when you ship items).

See `maintenance_and_improvement_plan.md` for the continuous improvement loop (instrumentation, evals, fast path, small releases).

## Product identity

Carina standalone is a **general-purpose autonomous agent**. Domain knowledge (property, healthcare, finance, etc.) is available only through optional skill packs the operator enables. No vertical pack is active by default.

## Skill packs (all optional)

**16 shipped packs** under `core.carinaai.uk/src/skills/packs/` (96 curated skills). Enable with `ACTIVE_SKILL_PACKS=pack1,pack2`:

| Pack | Domain |
|---|---|
| property-uk | UK property |
| healthcare | Healthcare admin |
| finance | Finance and accounting |
| legal-uk | UK legal |
| sales-crm | Sales and CRM |
| devops | DevOps and kanban |
| smart-home | Home Assistant |
| mlops | ML deployment |
| data-science | Data science |
| core-engineering | Coding, GitHub, debugging |
| creative-basics | Design, diagrams, ideation |
| productivity | Google, Notion, OCR, weather |
| research-basics | arXiv, RSS, investigation |
| email-extended | Extended email workflows |
| media-extended | Media tooling |
| social-extended | Social integrations |

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

## Remaining work (high level)

1. ~~`carina-agent` on npm~~ **Done** ([npm](https://www.npmjs.com/package/carina-agent) v0.1.0)
2. Public GitHub core only: `bash scripts/export-carina-core-public.sh` then push to `malike2356/carina-agent` (**keep `carina-ai` private**). See `PUBLIC_REPOSITORY.md`.
3. On-chain ERC-8004/8126 activation (attester wallet)
4. install.carinaai.uk curl installer host
5. Agent federation (deferred; see `BUILD_NEXT_CHECKLIST.md`)
6. Scout test triage (FINAL_AUDIT.md)

Gaming skills and cross-agent handoff are excluded by policy.
