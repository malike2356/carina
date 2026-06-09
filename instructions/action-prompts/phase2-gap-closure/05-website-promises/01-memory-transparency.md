# Action: Build User-Facing Memory Transparency (View/Edit/Search/Stats UI)

## Goal
Build a user-facing `console.carinaai.uk/memory` page (view, search, edit, delete, add memory entries, with usage stats and compression tips) backed by a REST API, adapted from the EXISTING VERLOX-internal memory viewer rather than built from nothing.

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/05-website-promises/01-memory-transparency.md`
- **Partial gap-closure: an internal memory viewer exists but is the WRONG AUDIENCE.** Read these first:
  - `ops.carinaai.uk/routes/memories.ts`; read in FULL; this is VERLOX's PRIVATE admin memory viewer (per the repo-root `CLAUDE.md` directory map: "ops.carinaai.uk/; VERLOX PRIVATE ADMIN - never shipped to customers"). It almost certainly already has list/view/search logic against whatever memory storage Carina uses; that storage layer and its query patterns are exactly what the new user-facing API needs to reuse.
  - `ops.carinaai.uk/views/memories/*.ejs`; read these EJS templates to understand the current data shape (categories, entries, priority, stats) before designing the new UI; the spec's mockup (lines 36-66) maps closely onto what's likely already rendered here for VERLOX's internal use
  - Find where Carina's actual memory is stored: `grep -rln "memory\|MEMORY.md\|memories" core.carinaai.uk/src --include="*.ts" | head -20`; the spec assumes a `packages/cloud` backend with a memory API; this codebase's real memory storage (likely file-based, mirroring the `~/.claude/.../memory/` pattern this very environment uses, or a DB table) is what `memory-api.ts` must read/write
- The key distinction: `ops.carinaai.uk/memories` is VERLOX staff looking at Carina's memory of THEM; the spec wants END USERS looking at Carina's memory of THEMSELVES, exposed at `console.carinaai.uk/memory`. The backend query/storage layer can be shared; the API must be re-scoped to the authenticated tenant/user (never expose cross-tenant memory), and the UI is a new, customer-facing surface.
- Conventions: TypeScript strict, no emojis/em-dashes, match this repo's existing web UI styling conventions (read `core.carinaai.uk/src/gateway/web.ts` (223 lines) for the user-facing web chat's HTML/CSS/JS conventions; the new memory page should look consistent with it, not with the internal `ops` admin styling).

## Files to create
```
core.carinaai.uk/src/web/memory/
  index.html; Memory management page (console.carinaai.uk/memory)
  memory.css
  memory-viewer.js; List/display entries by category
  memory-editor.js; Add/edit/delete via modal (spec lines 68-85)
  memory-search.js; Live search/filter
core.carinaai.uk/src/api/
  memory-api.ts; REST handlers for the 7 documented routes (lines 26-33), SCOPED TO THE AUTHENTICATED TENANT ONLY
  __tests__/
    memory-api.test.ts
```
Note: file locations above assume the user-facing surface belongs in `core.carinaai.uk` (the shipped product) rather than a nonexistent `packages/cloud`. If this repo has a separate customer-console codebase you find during investigation that better matches "console.carinaai.uk", place the files there instead and document why.

## Files to modify
- `ops.carinaai.uk/routes/memories.ts`; DO NOT move or rewrite this; it stays VERLOX-internal. Only reference it as the pattern for querying/storing memory, and factor out any genuinely shared storage-access code into a location both `ops.carinaai.uk` and the new user-facing API can import (only if such sharing is structurally easy; do not force a shared module across two independently-deployed apps if it creates a tangled cross-app dependency; duplication of a small storage-access shim is preferable to that)
- `core.carinaai.uk/src/gateway/web.ts`; add a route/link to the new `/memory` page in the existing web gateway's navigation, following its current routing pattern

## Step-by-step
1. Read `ops.carinaai.uk/routes/memories.ts` and its EJS views in full. Document: (a) what storage backend memory lives in (files? DB table? both?), (b) the exact shape of a memory entry (category, content, priority, timestamps), (c) how stats (`X / Y chars, Z% full`) are computed.
2. Find Carina's actual end-user memory storage by grepping `core.carinaai.uk/src` for memory read/write code; confirm whether end-user memory uses the SAME storage mechanism the `ops` viewer reads (in which case reuse is direct) or a DIFFERENT one (in which case `memory-api.ts` needs its own storage-access layer modeled on, but independent from, the `ops` one).
3. Design `memory-api.ts` against the documented routes (lines 26-33: list, get, create, update, delete, search, stats), with EVERY handler scoped to `req.user.tenantId` (or this codebase's equivalent auth context; read how `gateway/web.ts` currently authenticates a user) so no tenant can ever see another tenant's memory. This scoping is the single most important security property of this feature; get it wrong and it is a data breach, not a missing feature.
4. Implement the stats endpoint (`GET /api/memory/stats`) computing per-category character counts and percentages against whatever size limits this codebase's memory system actually enforces (read the storage layer for any existing limit constants; do not invent `1,375`/`2,200` thresholds from the spec's mockup numbers, which are illustrative for a specific user, not universal limits).
5. Build the UI (`index.html` + JS modules) matching the spec's layout (lines 36-66): category-grouped entry list, search box, "+ New Entry" button opening the modal (lines 68-85) with Category/Content/Priority fields, and a stats panel with the "Auto-compress now" action wired to whatever compression mechanism exists (if none exists yet, the button can trigger a simple "remove entries below a priority threshold older than N days"; confirm this is acceptable scope by checking whether `ops`'s viewer has an equivalent and mirroring it; do not invent a complex compression algorithm).
6. Wire `memory-viewer.js`/`memory-search.js`/`memory-editor.js` to the API using this codebase's existing frontend conventions (read how `gateway/web.ts`'s existing pages call their backend; fetch with what auth header pattern, what error handling).
7. Add the `/memory` route registration to `gateway/web.ts`'s router.

## Expected behavior
- `https://console.carinaai.uk/memory` (or this codebase's equivalent authenticated user-facing URL) shows ONLY the logged-in user's own memory entries, grouped by category
- Typing "PostgreSQL" in search live-filters to matching entries
- Editing an entry's content and saving updates it immediately; the NEXT chat session reflects the change (verify by checking that the memory-read path used at chat time reads from the same storage the API writes to)
- Deleting an entry removes it and Carina no longer references it
- Adding a new entry makes it appear immediately and be referenced in the next chat
- The stats panel shows accurate character counts against real limits, not the spec mockup's illustrative numbers
- A user can NEVER see another tenant's memory entries via any of the 7 API routes (verify explicitly with a cross-tenant test)

## Test
- `memory-api.test.ts`: each of the 7 routes returns correctly-scoped data; CROSS-TENANT ACCESS ATTEMPTS ARE REJECTED (this is the most important test in this prompt; write it first); CRUD round-trips correctly; search matches on content; stats arithmetic is correct against fixture data
- UI smoke test (if this codebase has any frontend test conventions; `grep -rn "playwright\|cypress\|@testing-library" package.json`): the page loads, search filters, modal opens/saves
- Run `pnpm test -- memory` and confirm all pass

## Dependencies
- Step 1-2 (understanding existing storage and the `ops` viewer's patterns) is the prerequisite for everything; do not invent a new memory storage format when one already exists and is in active use
- Tenant-scoping depends on this codebase's existing auth/session context in `gateway/web.ts`; read it before writing a single API handler
