# Gap 10 - Prompt 01: Database Schema and Carina Blog Tools

**Status: COMPLETED 2026-06-23**

**What was built:**
- `backends/servers/core.carinaai.uk/src/blog/store.ts` (incidents, subscribers, research runs; schema via `ensureIncidentBlogSchema()`)
- `backends/servers/core.carinaai.uk/src/blog/types.ts`, `slug.ts`
- `backends/servers/core.carinaai.uk/src/tools/blog.ts` (blog-create, blog-list, blog-approve, blog-publish, blog-research-run, blog-search-source, and related tools)
- `backends/servers/core.carinaai.uk/src/cli/commands/blog.ts` (`carina blog` CLI; `search-source` uses `runWebSearch`)
- Unit tests in `src/blog/store.test.ts`

> **REUSE RULE:** See `REUSE-RULES.md` in this directory. Implement the behavior described below in Carina's own voice. No competitor product names, labels, CLI output, or UI copy may appear verbatim in shipped code.

**Gap:** 10 Incident Blog
**Prompt number:** 01 of 05
**Name:** Database Schema and Carina Blog Tools
**Primary agent:** Claude Code
**Estimated hours:** 6-8 h
**Depends on:** Nothing (first prompt)

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

1. `/opt/lampp/htdocs/verlox/carina/labyrinthscout.com/incidents/index.html` -- the existing page (understand the HTML structure for each incident entry)
2. `/opt/lampp/htdocs/verlox/carina/console.labyrinthscout.com/src/compliance/digest.ts` -- existing subscriber table schema
3. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/agents/cron-job-types.ts` -- cron job type system
4. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/tools/registry.ts` -- tool registration pattern
5. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/CLAUDE.md` -- stack rules and coding conventions

---

## Context

The incident blog at `labyrinthscout.com/incidents/` is currently a static HTML file with 17 hardcoded incidents. This prompt builds the data layer and tooling to make it dynamic -- a PostgreSQL-backed incident store, Carina CLI commands for managing content, and tool definitions so Carina itself can create, read, update, and manage incidents programmatically.

The blog data lives in a new PostgreSQL table. It does NOT use the existing `compliance_digest_subscriptions` table for content -- that table is for subscribers only. Incidents get their own table.

---

## Step 1: Database Schema

Create a migration file at `core.carinaai.uk/src/infrastructure/migrations/005-incident-blog.sql`.

```sql
-- Incident blog table
CREATE TABLE IF NOT EXISTS incident_blog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,              -- URL-safe identifier: "500m-claude-bill"
  company         TEXT NOT NULL,                     -- Affected company: "Enterprise (unnamed)", "Samsung"
  damage          TEXT NOT NULL,                     -- Damage summary: "$500,000,000", "13-hour outage"
  category        TEXT NOT NULL,                     -- financial | security | brand | legal
  date_occurred   TEXT NOT NULL,                     -- Display date: "May 2026", "2024-2025"
  body_html       TEXT NOT NULL,                     -- Full incident description HTML
  sources_json    JSONB NOT NULL DEFAULT '[]',       -- Array of {label, url} objects
  scout_fix_html  TEXT NOT NULL,                     -- "Scout fix: ..." text
  status          TEXT NOT NULL DEFAULT 'draft',     -- draft | approved | published | rejected
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by     TEXT,                              -- Operator who approved
  approved_at     TIMESTAMPTZ,
  newsletter_sent BOOLEAN NOT NULL DEFAULT FALSE,    -- Has this been sent to subscribers?
  newsletter_sent_at TIMESTAMPTZ
);

-- Subscriber table (extends existing compliance_digest_subscriptions pattern)
CREATE TABLE IF NOT EXISTS incident_blog_subscribers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  subscribed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed       BOOLEAN NOT NULL DEFAULT FALSE,    -- Email confirmation
  confirm_token   TEXT,                              -- Confirmation token
  unsubscribed_at TIMESTAMPTZ,
  last_sent_at    TIMESTAMPTZ,
  source          TEXT DEFAULT 'incidents-page'      -- Where they subscribed from
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_incident_blog_status ON incident_blog(status);
CREATE INDEX IF NOT EXISTS idx_incident_blog_category ON incident_blog(category);
CREATE INDEX IF NOT EXISTS idx_incident_blog_published_at ON incident_blog(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_blog_slug ON incident_blog(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_blog_subscribers_email ON incident_blog_subscribers(email);
```

Also add the migration to the auto-run list. Check how existing migrations are loaded (likely in `src/infrastructure/migrations/run.ts` or similar) and add `005-incident-blog.sql`.

---

## Step 2: Carina Blog Module

Create `core.carinaai.uk/src/blog/` directory with these files:

### `src/blog/types.ts`

TypeScript interfaces matching the schema:

```typescript
export type IncidentCategory = 'financial' | 'security' | 'brand' | 'legal';
export type IncidentStatus = 'draft' | 'approved' | 'published' | 'rejected';

export interface IncidentSource {
  label: string;
  url: string;
}

export interface BlogIncident {
  id: string;
  title: string;
  slug: string;
  company: string;
  damage: string;
  category: IncidentCategory;
  dateOccurred: string;
  bodyHtml: string;
  sources: IncidentSource[];
  scoutFixHtml: string;
  status: IncidentStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  newsletterSent: boolean;
  newsletterSentAt: Date | null;
}

export interface BlogSubscriber {
  id: string;
  email: string;
  subscribedAt: Date;
  confirmed: boolean;
  confirmToken: string | null;
  unsubscribedAt: Date | null;
  lastSentAt: Date | null;
  source: string;
}
```

### `src/blog/store.ts`

CRUD functions using the `pool` from `src/memory/db.ts`:

```typescript
export async function createIncident(data: CreateIncidentInput): Promise<BlogIncident>;
export async function getIncident(idOrSlug: string): Promise<BlogIncident | null>;
export async function listIncidents(opts?: { status?: IncidentStatus; category?: IncidentCategory; limit?: number; offset?: number }): Promise<BlogIncident[]>;
export async function updateIncident(id: string, data: UpdateIncidentInput): Promise<BlogIncident>;
export async function deleteIncident(id: string): Promise<void>;
export async function approveIncident(id: string, approvedBy: string): Promise<BlogIncident>;
export async function publishIncident(id: string): Promise<BlogIncident>;
export async function rejectIncident(id: string): Promise<BlogIncident>;
export async function markNewsletterSent(id: string): Promise<void>;
export async function getPublishedIncidents(): Promise<BlogIncident[]>;
export async function getUnsentNewsletterIncidents(): Promise<BlogIncident[]>;

// Subscribers
export async function subscribe(email: string, source?: string): Promise<BlogSubscriber>;
export async function confirmSubscriber(token: string): Promise<boolean>;
export async function unsubscribe(email: string): Promise<void>;
export async function listActiveSubscribers(): Promise<BlogSubscriber[]>;
```

Every function must handle errors gracefully. Use parameterised queries (no string interpolation). Return typed results.

### `src/blog/slug.ts`

Generate URL-safe slugs from titles:

```typescript
export function generateSlug(title: string): string;
// "DPD AI Chatbot Swears at Customer and Calls Itself Useless"
// => "dpd-ai-chatbot-swears-at-customer"
// Truncate at ~60 chars, strip special chars, lowercase, hyphenate
```

---

## Step 3: Carina CLI Commands

Extend `src/cli/commands/` with a new command group `carina blog`. Create `src/cli/commands/blog.ts` (or a `blog/` directory if the command grows large).

The user-facing CLI experience:

```bash
# Content management
carina blog create          # Interactive: prompts for title, company, damage, category, body, sources
carina blog list            # List all incidents with status and date. Flags: --status draft|approved|published|rejected, --category financial|security|brand|legal
carina blog show <slug>     # Full incident details, formatted for terminal
carina blog edit <slug>     # Interactive edit
carina blog delete <slug>   # Soft-delete (set status to rejected with deletion reason)

# Human-in-the-loop workflow
carina blog approve <slug>  # Mark as approved, ready for publish
carina blog publish <slug>  # Set status published, set published_at, trigger page rebuild
carina blog reject <slug>   # Reject with reason. Prompts: "Reason for rejection:"
carina blog review          # Show all drafts awaiting approval

# Newsletter
carina blog subscribers list
carina blog newsletter send # Send newsletter for all published, unsent incidents

# Page generation
carina blog generate-page   # Regenerate the static incidents/index.html from published data
```

Implementation notes:
- Use `carina blog` as the command prefix (not `carina incident` or `carina content`)
- Every command must support `--json` flag for programmatic use
- The `approve` command must record the approving user
- The `publish` command must: set status to published, set published_at, and trigger `generate-page`
- The `generate-page` command rebuilds the static HTML file

Register the new command group in the CLI command index.

---

## Step 4: Carina Tool Definitions

Create `src/tools/blog.ts` with tool definitions so Carina itself can manage the blog:

```typescript
// Tool: blog-create
// Tool: blog-list
// Tool: blog-show
// Tool: blog-edit
// Tool: blog-approve
// Tool: blog-publish
// Tool: blog-reject
// Tool: blog-review (list drafts)
// Tool: blog-search-source (web search for new incident sources -- used by the research pipeline)
// Tool: blog-generate-page
// Tool: blog-newsletter-send
```

Each tool follows the existing pattern from `src/tools/`. Registration in the tool registry as usual.

Key tool parameters:

**blog-create:**
- title (required)
- company (required)
- damage (required)
- category (required, enum: financial|security|brand|legal)
- date_occurred (required)
- body_html (required)
- sources (required, array of {label, url})
- scout_fix_html (required)

**blog-approve:** id_or_slug (required)

**blog-publish:** id_or_slug (required)

**blog-reject:** id_or_slug (required), reason (optional)

**blog-newsletter-send:** (no params -- sends all unsent published incidents)

**blog-search-source:** query (required) -- searches the web for potential AI incident sources

Register all blog tools in `TOOL_RISK_REGISTRY` in `src/tools/tool-risk-registry.ts`:
- blog-create: riskClass 'write', dangerous true
- blog-approve: riskClass 'write', dangerous true
- blog-publish: riskClass 'write', dangerous true
- blog-reject: riskClass 'write', dangerous false
- blog-newsletter-send: riskClass 'write', dangerous true (sends emails to real people)
- All read tools: riskClass 'read'

---

## Verification

After implementation:

```bash
# Create a test incident via CLI
carina blog create --title "Test Incident" --company "TestCorp" --damage "$1,000,000" --category financial --date-occurred "June 2026" --body "<p>Test body</p>" --sources '[{"label":"Test Source","url":"https://example.com"}]' --scout-fix "Scout fix: test"

# List it
carina blog list

# Approve it
carina blog approve test-incident

# Publish it
carina blog publish test-incident

# Generate the page
carina blog generate-page

# Verify the page was updated
grep "Test Incident" /opt/lampp/htdocs/verlox/carina/labyrinthscout.com/incidents/index.html

# Verify tools are registered
pnpm cli  # start carina, ask it to use blog-list tool

# Clean up
carina blog delete test-incident
```
