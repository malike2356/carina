# Gap 23 - OpenAI-Compatible API Endpoints

**Status: COMPLETED 2026-06-21**

**What was built:**
- `src/api/openai-compatible/` auth, models, chat-completions, responses, embeddings routes
- Mounted on web server when `CARINA_OPENAI_API_ENABLED=true`
- Bearer auth via control auth, `CARINA_INTERNAL_KEY`, or `CARINA_OPS_TOKEN`
- Chat/responses route through gateway router; embeddings reuse memory embedder
- `src/api/openai-compatible.test.ts` coverage

**Gap:** 23
**Sprint:** 2
**Source:** OpenClaw docs (OpenAI chat completions + Responses API endpoints)
**Goal:** Expose OpenAI-compatible REST API endpoints so third-party tools,
  IDE extensions, and custom clients can use Carina as a drop-in LLM proxy
  without custom SDK integration.

**Primary agent:** Claude Code
**Estimated hours:** 3-4 h total

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Context

Carina has a rich internal API but no standard OpenAI-compatible endpoints.
Third-party tools (VS Code extensions, CLI tools, custom scripts) that expect
`POST /v1/chat/completions` cannot use Carina as a backend. OpenClaw exposes:

- `GET /v1/models` -- list available models
- `GET /v1/models/{id}` -- get model details
- `POST /v1/chat/completions` -- standard chat completions
- `POST /v1/embeddings` -- embeddings endpoint
- `POST /v1/responses` -- OpenResponses API (newer standard)

Adding these makes Carina a drop-in replacement for OpenAI API in any tool.

---

## Build Order

```
01-chat-completions.md    /v1/models + /v1/chat/completions endpoints
02-responses-embeddings.md  /v1/responses + /v1/embeddings + auth
```
