# Prompt 02: Peer Review System for Skills


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Skills that pass the automated scanner but have `high` findings need manual review.
The peer review system in the ops admin panel gives a reviewer role the tools to approve,
reject, or request changes to submitted skills.

## What to Build

### 1. Review queue

In the ops admin panel, add a "Skill Review" tab. The queue shows skills pending review:

```
Skill Name            Author       Submitted     Findings    Actions
property-valuation    anon-sub     2h ago        1 HIGH      [Review] [Auto-reject]
web-recon-workflow    anon-sub     1d ago        2 MEDIUM    [Review] [Approve]
```

### 2. Review page

Clicking [Review] opens a full-width review page:
- Left: skill metadata (name, description, pack category, permissions requested)
- Center: skill source code with syntax highlighting and line numbers
  - Scan findings are highlighted inline (amber for high, yellow for medium)
- Right: reviewer actions panel

Reviewer actions:
```
[Approve]         - mark approved, publish to hub
[Request Changes] - enter feedback message, send to author
[Reject]          - enter rejection reason, permanent reject
[Re-scan]         - run scanner again (in case skill was edited)
```

### 3. Review state machine

Skill states:
```
pending -> scanning -> (auto-approved | needs-review | auto-rejected)
needs-review -> (approved | changes-requested | rejected)
changes-requested -> pending (author submits revision)
```

In PostgreSQL:
```sql
ALTER TABLE skills ADD COLUMN
  review_status TEXT NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  revision_count INTEGER DEFAULT 0;
```

### 4. Review comments API

```
GET    /api/ops/skills/review-queue    - list skills needing review
GET    /api/ops/skills/:id/review      - get skill for review (includes scan results)
POST   /api/ops/skills/:id/approve     - approve skill
POST   /api/ops/skills/:id/reject      - reject with reason
POST   /api/ops/skills/:id/request-changes  - request changes with feedback
```

### 5. Author notification

When a review decision is made, notify the skill author:
```typescript
if (decision === 'approved') {
  await sendEmail(author.email, 'Your skill was approved', `${skillName} is now live on the Carina Skills Hub.`);
} else if (decision === 'changes-requested') {
  await sendEmail(author.email, 'Changes requested for your skill', `Reviewer feedback: ${comment}`);
}
```

## Verification Checklist

- [ ] Submit a skill with a HIGH finding - appears in review queue
- [ ] Click Review - skill source shown with HIGH finding highlighted on the relevant line
- [ ] Click Approve - skill moves to approved state, disappears from queue
- [ ] Click Request Changes - author receives email with feedback
- [ ] Approve count badge on "Skill Review" nav item shows pending count

## Files to Create or Modify

- MODIFY `ops.carinaai.uk/views/layout.ejs` - add Skill Review nav link with badge
- CREATE `ops.carinaai.uk/views/skill-review.ejs`
- CREATE `ops.carinaai.uk/routes/skill-review.ts`
- MODIFY `ops.carinaai.uk/server.ts` - register skill review routes
- MODIFY `src/api/skills.ts` - add review queue and decision endpoints
- MODIFY `docker/postgres/init.sql` - add review columns to skills table
