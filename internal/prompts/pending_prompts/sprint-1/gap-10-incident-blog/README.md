# Gap 10: AI Incident Blog -- Dual-Control Automated Research and Publishing

**Date:** 2026-06-19 (rewritten: dual-control architecture)
**Status:** PROMPTS WRITTEN -- Ready for implementation
**Total Prompts:** 5
**Estimated Days:** 3-4 with 1 agent (Claude Code)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Architecture: Dual Control

The incident blog has two interfaces to the same database. Both have full control. Neither is subordinate.

```
                    ┌─────────────────────┐
                    │   Blog Store (DB)    │
                    │   incidents table     │
                    │   subscribers table   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                  │
    ┌─────────▼──────────┐          ┌───────────▼──────────┐
    │   ADMIN UI          │          │   CARINA CONVERSATION │
    │   (ops.carinaai.uk) │          │   (CLI / Telegram /   │
    │                     │          │    Web / anywhere)     │
    │   - CRUD forms      │          │                        │
    │   - Approve/publish │          │   - "Show me drafts"  │
    │   - Newsletter btn  │          │   - "Approve #3"      │
    │   - Subscriber list │          │   - "Publish all"     │
    │   - Research trigger│          │   - "Send newsletter" │
    └─────────────────────┘          └────────────────────────┘
```

The operator can:
- Click buttons in the admin UI at ops.carinaai.uk
- Talk to Carina conversationally anywhere (CLI, Telegram, web)
- Mix both: review drafts in the UI, approve via Carina, publish manually, let Carina send the newsletter
- Either side can do anything. Both read/write the same database. No locks, no ownership.

The research pipeline can be triggered:
- Automatically via Carina's Sunday check-in
- Manually from the admin UI ("Run Research" button)
- Manually via Carina conversation ("Run incident research now")

---

## What Already Exists (Reuse This)

| Component | Location | What It Does |
|-----------|----------|-------------|
| Incidents page | `labyrinthscout.com/incidents/index.html` | 974-line static page, Scout-branded |
| Carina tools | `src/tools/` | Tool dispatch, security, approval, audit |
| Carina check-in | `src/agents/check-in.ts` | Proactive check-in rotation |
| Carina API | `src/api/` | API surface |
| Resend email | `src/tools/email.ts` | Email via Resend |
| Web search | `src/tools/web-search.ts` | SearXNG/Tavily/Brave |
| Admin panel | `ops.carinaai.uk/` | Express/EJS, port 4000, password-protected |
| Research base | `instructions/prompts/researched_gap/` | 17 sourced incidents |

---

## Prompt Inventory

```
gap-10-incident-blog/
├── README.md                                  (this file)
├── 01-db-schema-and-carina-tools.md           Database + Carina blog tools (UNCHANGED from v1)
├── 02-dual-interface.md                       Admin UI + Carina conversation, shared store
├── 03-research-pipeline.md                    Carina check-in + manual trigger from both sides
├── 04-subscribe-and-newsletter.md             Carina API endpoints + newsletter from both sides
└── 05-page-generator-and-integration.md       Static HTML generator, wired into publish flow
```

---

## Execution Order

```
Day 1:
  Prompt 01 -- Database schema + Carina blog tools (UNCHANGED)

Day 2:
  Prompt 03 -- Research pipeline (check-in + manual triggers)
  Prompt 04 -- Subscribe API + newsletter send

Day 3:
  Prompt 02 -- Dual interface (admin UI + Carina conversation)
  Prompt 05 -- Page generator + integration

Day 4:
  End-to-end testing: both interfaces, all paths
```

---

## Key Architecture Decisions

1. **One database, two interfaces.** Admin UI and Carina conversation share the same PostgreSQL tables. No sync, no conflict resolution. Both read/write directly.
2. **Carina check-in handles automation.** The Sunday research is a check-in slot. Manual triggers bypass the day check.
3. **Carina API for public endpoints.** Subscribe/confirm/unsubscribe are Carina API routes.
4. **Page generator is a shared function.** Called by both admin UI (button) and Carina (tool). Same code path.
5. **Newsletter is a shared function.** Can be triggered from admin UI button or Carina conversation. Same send logic.
6. **Human-in-the-loop is mandatory regardless of interface.** Research creates drafts. Either interface approves. No auto-publish.

---

## Anti-Goals

- NOT forcing the operator into one interface
- NOT requiring Carina to be running for admin UI to work
- NOT requiring the admin UI for Carina to manage the blog
- NOT a public comment system or RSS feed (future)

---

## Reference Files

- `labyrinthscout.com/incidents/index.html` -- existing page (template)
- `src/agents/check-in.ts` -- check-in system (extend with incident research)
- `src/api/` -- API surface (add subscribe endpoint)
- `src/tools/email.ts` -- email tool (newsletter)
- `src/tools/web-search.ts` -- web search (research)
- `ops.carinaai.uk/src/routes/` -- admin routes (add blog section)
- `ops.carinaai.uk/src/views/` -- EJS templates (add blog views)
