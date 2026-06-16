# Prompt 02 - Research Core Wiring + Chat About Results

## Objective

Replace stub research output in `app.carinaai.uk` with real execution via `core.carinaai.uk`. Add "Discuss in chat" so users can continue a thread from a completed research report (Odysseus Library > Research + chat-about-results loop).

---

## Context

**Working directories:**
- `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`
- `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk`

**Current state:** `src/app/api/research/route.ts` generates placeholder markdown when `CARINA_INTERNAL_KEY` is unset.

**Prerequisite:** Prompt 01 (internal key auth pattern established).

**Files to inspect first:**
- `app.carinaai.uk/src/app/api/research/route.ts`
- `core.carinaai.uk/src/agents/deep-research.ts` (O2 in ODYSSEUS_CLOSE_PROMPTS)
- `core.carinaai.uk/src/api/research-api.ts` or gateway research routes
- `app.carinaai.uk/src/app/(workspace)/research/page.tsx`

---

## Step 1 - Core research job API for cloud

In core, ensure endpoints exist (create if missing):

```
POST /api/internal/research/start
  Headers: x-internal-key
  Body: { jobId, workspaceId, query, mode, rounds }
  Returns: { accepted: true }

GET /api/internal/research/status/:jobId
  Returns: { status, output?, sources?, error? }
```

Executor runs `deep-research.ts` in background. Updates job store (in-memory + optional file cache keyed by jobId).

Webhook or poll: cloud polls status every 2s until `completed` or `failed` (max 10 minutes).

---

## Step 2 - Wire cloud POST /api/research

In `triggerResearchJob`:

1. Require `CARINA_INTERNAL_KEY`; if missing in production (`NODE_ENV=production`), fail job with error "Research backend not configured" (not stub).
2. In development only: allow stub with banner in output: "DEV STUB".
3. On success, persist `output`, `sources` JSON on `research_jobs` row.

Add `GET /api/research/[id]` for single job detail.

---

## Step 3 - Research UI polish

On `research/page.tsx`:

1. Job list: status badge (queued, running, completed, failed).
2. Completed job: render markdown output with `MarkdownContent` from chat components.
3. Sources panel: list citations with external links.
4. Export: download `.md` button (client-side blob).
5. **Discuss in chat** button:
   - `POST /api/sessions` new session titled `Research: {query truncated}`
   - `POST /api/sessions/{id}/context` or insert system context pin with research summary (first 4000 chars) + link to full job id
   - Redirect to `/chat/{sessionId}` with query param `?researchJob={id}`

---

## Step 4 - Chat session research context

In `ChatView.tsx`, if `researchJob` query param present:

1. Fetch job via `GET /api/research/[id]`.
2. Auto-pin as context chip: "Research: {title}".
3. Pre-fill input placeholder: "Ask a follow-up about this research..."

Extend `buildSystemPrompt` in `carina-chat.ts` to append research summary when context pin type is `research`.

---

## Step 5 - Tests

- `app.carinaai.uk`: API route test mocks core fetch; verifies status transitions.
- Core: deep-research test already from O2; add internal route auth test.

---

## Acceptance criteria

- [ ] Production research job with valid key completes with real sources (not example.com placeholders).
- [ ] Failed core call surfaces error on job row and in UI.
- [ ] "Discuss in chat" opens new session with research context pinned.
- [ ] Dev stub only when `NODE_ENV !== 'production'` and no internal key.
