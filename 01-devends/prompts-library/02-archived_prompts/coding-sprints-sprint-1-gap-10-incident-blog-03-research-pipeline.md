# Gap 10 - Prompt 03: Research Pipeline -- Check-In and Manual Trigger

**Status: COMPLETED 2026-06-23**

**What was built:**
- `backends/servers/core.carinaai.uk/src/blog/research-runner.ts` (shared discovery pipeline, `recordResearchRun`)
- `backends/servers/core.carinaai.uk/src/agents/checks/incident-research-check.ts` (Sunday check-in slot)
- Check-in rotation wired in `src/agents/check-in.ts`
- `listResearchRuns()` in store; `carina blog research-log` and `research-status` CLI commands
- Manual triggers from ops admin and `POST /api/incident-blog/admin/research-run`
- Tests in `src/blog/research-runner.test.ts`

> **REUSE RULE:** See `REUSE-RULES.md` in this directory. Implement the behavior described below in Carina's own voice.

**Gap:** 10 Incident Blog
**Prompt number:** 03 of 05
**Name:** Research Pipeline
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** Prompt 01 (blog tools registered)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read First

Before writing a single line, read:

1. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/agents/check-in.ts` -- THE FULL FILE
2. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/agents/checks/email-check.ts` -- example check
3. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/blog/store.ts` -- getPublishedIncidents, createIncident
4. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/tools/web-search-provider.ts` -- web search API

---

## Context

Incident research can be triggered three ways:

1. **Automatic (Carina check-in):** Every Sunday, Carina's check-in rotation fires the incident-research slot. Carina searches, drafts, and reports.
2. **Admin UI button:** Operator clicks "Run Research" on the admin panel. Triggers the same pipeline.
3. **Carina conversation:** Operator says "Run research now." Same pipeline.

All three paths call the same function. Only the trigger differs.

---

## Step 1: Shared Research Function

Create `src/blog/research-runner.ts`:

```typescript
import { getPublishedIncidents, createIncident } from './store.js';
import { generateSlug } from './slug.js';
import { runWebSearch } from '../tools/web-search-provider.js';

export interface ResearchResult {
  found: number;
  drafted: number;
  skipped: number;
  errors: string[];
}

// This function is called by ALL three trigger paths.
// It does NOT call the LLM directly -- it returns the prompt context.
// The caller (check-in, admin UI handler, or Carina conversation) feeds
// the prompt to Carina, who does the actual research.

export function buildResearchPrompt(): string {
  // Gets existing incidents for dedup context
  // Returns the prompt that Carina executes
  // ...
}

export async function processResearchFindings(
  findings: Array<{
    title: string; company: string; damage: string;
    category: string; date_occurred: string;
    body_html: string; sources: Array<{label: string; url: string}>;
    scout_fix_html: string;
  }>
): Promise<ResearchResult> {
  // Deduplicate and save findings as drafts
  // Called after Carina returns her research results
  // ...
}

// Track research runs
export async function recordResearchRun(result: ResearchResult): Promise<void>;
export async function getLastResearchRun(): Promise<ResearchRun | null>;
```

The research prompt:

```
INCIDENT RESEARCH TASK

Search the web for NEW AI agent incidents from the past 30 days.

Search queries to try:
- "AI agent incident 2026"
- "LLM security breach"
- "AI coding agent damage"
- "AI chatbot lawsuit"
- "prompt injection attack 2026"
- "autonomous AI failure"
- "AI agent data leak"

For each credible incident found:
1. Verify the source is legitimate (news outlet, security blog, academic paper, official disclosure)
2. Skip: duplicates of existing incidents, incidents without named companies, opinion pieces, incidents older than 90 days
3. Save as DRAFT using blog-create. NEVER set status to anything other than draft.
4. Each incident must have at least one verifiable source URL.

EXISTING INCIDENTS (do NOT duplicate):
{{existingSummary}}

IMPORTANT: Drafts ONLY. The operator reviews and approves all drafts. Do not publish anything.
```

---

## Step 2: Carina Check-In Slot

Create `src/agents/checks/incident-research-check.ts`:

```typescript
import type { CheckResult } from './email-check.js';
import { getPublishedIncidents } from '../../blog/store.js';

export async function checkIncidentResearch(): Promise<CheckResult> {
  const now = new Date();

  // Only fire on Sunday (0 = Sunday in UTC)
  if (now.getUTCDay() !== 0) {
    return { name: 'incident-research', summary: '', urgent: false };
  }

  // Check if already ran today (handled by check-in's lastChecks tracking)

  const published = await getPublishedIncidents();
  const existingSummary = published.map(i =>
    `- ${i.title} (${i.company}, ${i.dateOccurred}). Sources: ${i.sources.map(s => s.url).join(', ')}`
  ).join('\n');

  return {
    name: 'incident-research',
    summary: `INCIDENT RESEARCH SLOT -- Sunday check.\n\n${buildResearchPrompt().replace('{{existingSummary}}', existingSummary || 'None yet.')}`,
    urgent: false,
  };
}
```

Register in `src/agents/check-in.ts`:

```typescript
// In CHECK_ROTATION:
const CHECK_ROTATION = ['email', 'weather', 'project-status', 'incident-research'] as const;

// In buildCheckInPrompt():
} else if (check === 'incident-research') {
  results.push(await checkIncidentResearch());
}
```

---

## Step 3: Manual Triggers

**Admin UI trigger:**

The "Run Research" button in the admin UI (prompt 02) hits:

```
POST /admin/incident-blog/research-run
```

The route handler:
1. Calls `buildResearchPrompt()` to get the prompt
2. Runs it through Carina's agent loop (or returns the prompt context for Carina to execute)
3. Carina does the web search and drafts
4. Returns result: "Research complete. N new drafts. M skipped."
5. Redirects back to the incident list with a flash message

Implementation note: The admin UI route handler needs access to Carina's agent loop to execute the research. If this is complex, a simpler approach: the button creates a Carina cron job that fires immediately (`schedule: 'now'`), Carina executes it, and the admin UI polls for completion or shows a "Research started" message.

**Carina conversation trigger:**

Operator says "Run research now." Carina uses `blog-research-run` tool (from prompt 01) which:
1. Calls `buildResearchPrompt()`
2. Executes the research (web searches, drafting)
3. Calls `processResearchFindings()` with her results
4. Reports: "Research complete. 2 new drafts. 1 duplicate skipped."

This is direct -- Carina does the work in real time during the conversation.

---

## Step 4: Research History

Track research runs in a lightweight table:

```sql
CREATE TABLE IF NOT EXISTS incident_research_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_by  TEXT NOT NULL,              -- 'check-in' | 'admin-ui' | 'carina-conversation'
  found_count   INTEGER NOT NULL DEFAULT 0,
  drafted_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_log     TEXT
);
```

Add to `src/blog/store.ts`:
```typescript
export async function recordResearchRun(result: ResearchResult, triggeredBy: string): Promise<void>;
export async function getLastResearchRun(): Promise<ResearchRun | null>;
```

Add to `carina blog` CLI:
```bash
carina blog research-status   # Show last research run: when, triggered by, found/drafted/skipped
carina blog research-log      # Show history of research runs
```

---

## Pitfalls

1. **Sunday timing.** If Carina is not running on Sunday, research does not run. A future enhancement could make the check "run if not run this week" rather than "run on Sunday only." For v1, Sunday-only is acceptable.
2. **Admin UI research execution.** The admin UI route handler triggering Carina's research is the trickiest integration point. If calling Carina's agent loop from Express is complex, use the "create an immediate cron job" pattern as a bridge.
3. **Dedup is imperfect.** Slug matching and URL overlap catch most duplicates. The operator catches the rest during review.
4. **Rate limiting.** Search providers may rate-limit. Fewer results is acceptable. Better real than hallucinated.
5. **Research prompt is code.** Consider storing it as a workspace file the operator can edit, rather than a hardcoded constant.

---

## Verification

```bash
# Test check-in integration
# Temporarily modify day check to force research
# Observe Carina logs during check-in cycle

# Test manual trigger via Carina
carina blog research-run

# Test manual trigger via admin UI
# Click "Run Research" button
# Verify drafts appear in the list

# Check research history
carina blog research-status
carina blog research-log
```
