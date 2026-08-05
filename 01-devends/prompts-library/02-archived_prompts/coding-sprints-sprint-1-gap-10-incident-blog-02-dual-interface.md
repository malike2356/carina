# Gap 10 - Prompt 02: Dual Interface -- Admin UI and Carina Conversation

**Status: COMPLETED 2026-06-23**

**What was built:**
- Ops admin routes: `backends/admin/ops.carinaai.uk/routes/incident-blog.ts`
- EJS views: `backends/admin/ops.carinaai.uk/views/incident-blog/` (list, view, edit, subscribers)
- Sandboxed HTML preview via iframe in `view.ejs`; `.ops-rich-preview` styles in `ops-shell.css`
- Expanded `BLOG MANAGEMENT` block in `backends/servers/core.carinaai.uk/src/agents/system-prompt.ts`
- Core ops API mirror: `backends/servers/core.carinaai.uk/src/api/incident-blog.ts` admin routes

> **REUSE RULE:** See `REUSE-RULES.md` in this directory. Implement the behavior described below in Carina's own voice.

**Gap:** 10 Incident Blog
**Prompt number:** 02 of 05
**Name:** Dual Interface
**Primary agent:** Claude Code
**Estimated hours:** 6-8 h
**Depends on:** Prompt 01 (blog tools + store working)

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

1. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/blog/store.ts` -- blog store (shared by both interfaces)
2. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/blog/types.ts` -- BlogIncident type
3. `/opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/src/routes/` -- existing admin route structure
4. `/opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/src/views/` -- existing EJS templates
5. `/opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/src/middleware/auth.ts` -- admin auth
6. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/tools/blog.ts` -- blog tool definitions from prompt 01
7. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/agents/system-prompt.ts` -- Carina's system prompt
8. `/opt/lampp/htdocs/verlox/carina/labyrinthscout.com/incidents/index.html` -- visual style (admin UI must match)

---

## Context

Two interfaces. One database. Full dual control.

**Interface A: Admin UI** at ops.carinaai.uk -- Forms, buttons, CRUD. Human-operated. Works even when Carina is not running. Good for batch operations, subscriber lists, quick scans.

**Interface B: Carina Conversation** -- Natural language. Works anywhere (CLI, Telegram, web chat). Good for reviewing drafts, approving with commentary, delegating research. "Show me drafts. Approve #1 and #3. Reject #2 as duplicate. Publish and send newsletter."

Both talk to `src/blog/store.ts`. Neither owns the data. The operator switches between them freely.

---

## Part A: Admin UI (Express/EJS)

The admin panel at ops.carinaai.uk gets a new "Incident Blog" section. It adopts the labyrinthscout.com dark theme.

### Routes

Create `ops.carinaai.uk/src/routes/incident-blog.ts`:

```
GET  /admin/incident-blog              -> List all incidents (filterable)
GET  /admin/incident-blog/:slug        -> View single incident with full preview
POST /admin/incident-blog/create       -> Create new incident
POST /admin/incident-blog/:slug/edit   -> Update incident
POST /admin/incident-blog/:slug/approve -> Approve
POST /admin/incident-blog/:slug/publish -> Publish (sets published_at, regenerates page)
POST /admin/incident-blog/:slug/reject  -> Reject (prompts for reason)
GET  /admin/incident-blog/subscribers   -> Subscriber list + stats
POST /admin/incident-blog/newsletter/send -> Trigger newsletter send
POST /admin/incident-blog/generate-page   -> Trigger page regeneration
POST /admin/incident-blog/research-run    -> Manually trigger incident research
```

All routes require admin authentication. The route handlers call the same `src/blog/store.ts` functions that Carina's tools call.

### Views

Create `ops.carinaai.uk/src/views/incident-blog/`:

**`list.ejs`** -- Dashboard:
- Stats bar: Drafts (N) | Approved (N) | Published (N) | Rejected (N) | Subscribers (N)
- Status filter tabs: All | Drafts | Approved | Published | Rejected
- Category filter: All | Financial | Security | Brand | Legal
- Incident rows: title, company, damage (red), category badge, status badge, date
- Action buttons: View | Approve | Publish | Reject | Edit
- "Create New" button
- "Run Research" button -- triggers the research pipeline immediately
- "Send Newsletter" button -- with unsent count
- "Regenerate Page" button

Status badge colors: draft=amber (#f59e0b), approved=blue (#3b82f6), published=green (#16c97e), rejected=grey (#4d6070)

**`view.ejs`** -- Single incident:
- Full rendered HTML preview (rendered in a sandboxed container)
- Metadata: status, category, company, damage, date, slug
- Sources with clickable links
- "Scout fix:" text in green
- Action buttons: Approve | Publish | Reject | Edit | Delete
- Rejection reason (if rejected)

**`edit.ejs`** -- Create/Edit form:
- Title, company, damage, category select, date occurred
- Body HTML (large textarea, monospace)
- Sources editor (dynamic add/remove rows: label + URL)
- Scout fix HTML input
- Slug (auto-generated, editable)

**`subscribers.ejs`** -- Subscriber management:
- Counts: total, confirmed, unsubscribed
- Subscriber table: email, subscribed date, confirmed, last sent
- Export option

### Visual Design

Adopt the labyrinthscout.com dark theme:

```css
:root {
  --bg:           #06090f;
  --bg-card:      #111722;
  --border:       rgba(255,255,255,0.07);
  --green:        #16c97e;
  --red:          #e63946;
  --amber:        #f59e0b;
  --blue:         #3b82f6;
  --text-primary: #f0f4f8;
  --text-mid:     #8a9bb0;
  --text-dim:     #4d6070;
}
```

The admin UI should feel like a professional CMS, not a dev tool. It should visually connect to the public incidents page. Same fonts, same colors, same card styling.

### Navigation

Add "Incident Blog" to the ops.carinaai.uk navigation sidebar/tabs.

---

## Part B: Carina Conversation Interface

Carina manages the blog through natural conversation using the blog tools from prompt 01. This is not a separate code path -- it is Carina being fluent in her own tools.

### System Prompt Extension

Add to Carina's system prompt (in `src/agents/system-prompt.ts` or a dedicated blog prompt file):

```
BLOG MANAGEMENT

You manage the AI Incident Blog at labyrinthscout.com/incidents/. All incidents are sourced, verified, and human-approved before publishing. You share control of the blog with the admin panel at ops.carinaai.uk -- both interfaces read/write the same database.

When the operator discusses the blog, use these tools:

- blog-review to show all drafts awaiting approval
- blog-list to show all incidents with filters (--status, --category)
- blog-show <slug> to show full details of one incident
- blog-approve <slug> to approve a draft for publishing
- blog-reject <slug> <reason> to reject a draft
- blog-publish <slug> to publish an approved incident to the live page
- blog-edit <slug> to modify any field
- blog-create to manually create a new incident
- blog-generate-page to rebuild the static incidents HTML
- blog-newsletter-send to send the weekly newsletter
- blog-research-run to trigger the research pipeline now
- blog-research-status to see the last research run
- blog-subscriber-list to see all subscribers

Rules:
1. Never publish or send a newsletter without explicit operator approval.
2. When reviewing, present a summary. Highlight new, suspicious, or duplicate-looking drafts.
3. When approving, confirm: "Approve 'Title' -- $X damage. Confirm?"
4. When rejecting, always record the reason.
5. After publishing, ask about newsletter: "Published. Send newsletter to N subscribers?"
6. After newsletter: report exact counts. "Sent to N. M skipped. X incidents included."
7. Research produces drafts only. Never auto-approve research findings.
8. Always cite sources. Credibility is the product.
```

### Conversation Patterns

The operator can say any of these from any Carina surface:

```
"What's new in the blog?"
"Show me drafts."
"Show me incident uber-budget-exhaustion."
"Approve the AWS one."
"Reject #2 as duplicate of existing incident."
"Publish all approved."
"Send the newsletter."
"How many subscribers?"
"Run research now."
"Create a new incident about..."
"Edit the damage figure on slackbot-insult to $2M."
```

Carina uses the blog tools to fulfill each request. No special commands. Just conversation.

---

## Part C: Shared Store -- No Conflicts

Both interfaces call the same functions in `src/blog/store.ts`. The architecture prevents conflicts:

- **No locking.** Both can read/write simultaneously. PostgreSQL handles concurrency.
- **No ownership.** An incident created by the admin UI can be approved by Carina. An incident drafted by Carina can be edited in the admin UI.
- **Status transitions are atomic.** `approveIncident()` sets status in one UPDATE. If the admin UI and Carina both try to approve the same incident simultaneously, one succeeds and the other gets a "status already changed" response.
- **Page regeneration is idempotent.** If both interfaces trigger `generateIncidentPage()` simultaneously, the last write wins. Both writes produce the same output because they read the same published incidents.

---

## Pitfalls

1. **Admin UI HTML preview must be sandboxed.** Rendered incident HTML from the database must be isolated (iframe or sanitized). Do NOT render raw user-authored HTML directly in the page.
2. **Slug uniqueness.** Both interfaces must validate slugs. The store function enforces uniqueness at the database level with the UNIQUE constraint.
3. **Mobile responsive.** Admin UI must work on mobile. Cards, tap-friendly buttons, collapsible filters.
4. **Carina must not hallucinate blog state.** If the operator asks "show me drafts" and there are none, say "No drafts waiting. Last research ran Sunday, found nothing new." Do not fabricate.
5. **Both interfaces visible at once.** The operator might approve via Carina on Telegram while looking at the admin UI. The admin UI should show the updated status on next page load. No real-time sync needed -- page refresh is sufficient.

---

## Verification

```bash
# Test admin UI
cd ops.carinaai.uk && pnpm dev
# Navigate to http://localhost:4000/admin/incident-blog
# Create, approve, publish an incident
# Verify page was regenerated

# Test Carina conversation
carina blog chat
# "Show me drafts"
# "Create a test incident"
# "Approve test-incident"
# "Publish test-incident"

# Test dual control
# Create via admin UI, approve via Carina conversation, publish via admin UI
# Verify both sides see the same state
```
