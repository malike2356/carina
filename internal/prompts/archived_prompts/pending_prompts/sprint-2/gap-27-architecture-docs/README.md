# Gap 27 - Documentation: Agent Architecture Deep-Dive

**Gap:** 27
**Sprint:** 2
**Type:** Documentation
**Source:** OpenClaw docs (Agent runtime, Agent loop, Multi-agent routing, System prompt, Session management, Command queue)
**Target dir:** `marketing/docs/docs.carinaai.uk/docs/developer/architecture/`

**Goal:** Write the missing architecture documentation pages. Carina's developer
  docs have only two architecture pages (overview + memory). OpenClaw has
  dedicated deep-dive pages for every subsystem. Write 5 new architecture
  pages in Carina's own voice and nomenclature.

**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 5-6 h total (5 deep technical pages)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Pages to write (all under docs/developer/architecture/)

| Page | Filename | Source to reference |
|------|----------|-------------------|
| Agent Loop & Turn Pipeline | agent-loop.md | `agents/agent-runner.ts`, `agents/tool-runner.ts` |
| Multi-Agent & Session Routing | multi-agent-routing.md | `workspaces/agent-routing.ts`, `gateway/router.ts` |
| Session Lifecycle | sessions.md | `agents/session-manager.ts`, `gateway/router.ts` |
| System Prompt Assembly | system-prompt.md | `agents/system-prompt.ts` |
| Delegation & Sub-agents | delegation.md | `agents/subagent-*.ts`, `agents/delegate*.ts` |

Each page: 500-1000 words, architecture diagrams in text (ASCII or Mermaid), code
references to real source files.

---

## Build Order

```
01-agent-loop-sessions.md    Agent loop + session lifecycle (2 pages)
02-routing-system-prompt.md  Multi-agent routing + system prompt (2 pages)
03-delegation.md             Delegation & sub-agents (1 page)
```

All three prompts can run in parallel since they cover different subsystems.

---

## Carina voice for architecture docs

- Use Carina terms: "Gateway Router" not "bridge", "skill packs" not "skills",
  "Scout" not "doctor", "ACP" not "OpenAcp"
- Reference real source paths: `internal/servers/core.carinaai.uk/src/`
- Architecture diagrams use Mermaid (supported by Docusaurus)
- Every page includes a "Where to find it in source" section with file paths
- No competitor names, no "unlike X which does Y", no emojis

---

## Done When
- [ ] 5 new architecture pages written
- [ ] Each page cross-references real source files
- [ ] Sidebar updated with new architecture pages
- [ ] `pnpm build` passes
