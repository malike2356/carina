# WORKFLOW.md — How Claude, Cursor, and Hermes Work Together

## The workflow

```
Claude:  Writes implementation prompts → commits to repo
Cursor:  Reads prompts → codes the files → commits to repo
Hermes:  Pulls commit → runs tests → verifies → deploys → reports
```

You (Laud) are the conductor. You move work between them. The repo is the handoff point.

## Roles

### Claude — Architect + Reviewer

What Claude does:
- Reads ROADMAP.md and TARGET.md to understand the plan
- Writes implementation prompts for Cursor
  - Each prompt covers one self-contained task
  - Includes: file paths, expected behavior, edge cases, test scenarios
  - Written as markdown files in the repo
- Reviews Cursor's code
  - Checks against the original prompt
  - Catches bugs, edge cases, style violations
  - Approves or requests changes
- Resolves ambiguities
  - If a spec is unclear, Claude makes the decision
  - Documents the decision
  - Does not ask Laud about minor implementation details

What Claude does NOT do:
- Write code directly (that's Cursor's job)
- Run terminal commands (that's Hermes's job)
- Deploy or test (that's Hermes's job)

### Cursor — Builder

What Cursor does:
- Takes Claude's prompts and writes the code
- Commits each completed task to the repo
- Runs syntax checks before committing
- Flags issues for Claude review

What Cursor does NOT do:
- Design architecture (that's Claude's job)
- Test against real servers (that's Hermes's job)
- Make decisions about what to build next (ROADMAP.md decides)

### Hermes — Tester + Deployer

What Hermes does:
- Pulls Cursor's commits
- Runs the full test suite
- Tests features end-to-end against real servers
- Hits endpoints, checks logs, verifies behavior
- If tests pass: deploys to staging, verifies, reports success
- If tests fail: reports exact errors to Claude with stack traces

What Hermes does NOT do:
- Write code (that's Cursor's job)
- Plan features (that's Claude's job)

## The handoff protocol

### Claude → Cursor
```
File: prompts/phase1-week1-email-pipeline.md
Content:
  - What to build
  - Files to create/modify
  - Expected behavior
  - Edge cases to handle
  - Test scenarios
  - Dependencies (what must exist first)
```

### Cursor → Claude
```
Git commit message: "feat: email ingestion pipeline classification"
  - What was built
  - Files changed
  - Any issues encountered
  - Anything that needs Claude's review
```

### Claude → Hermes
```
"Karina, pull commit abc123 and test the email ingestion pipeline.
Verify: IMAP connection, email classification, processing log, handler dispatch."
```

### Hermes → Claude
```
"Tests passed: 12/12.
End-to-end verified: real email sent, classified as rent_statement,
handler job dispatched, processing log updated.
Deployed to staging. Ready for production."
```

OR:
```
"Test failed: HandleRentStatement.php line 47.
Error: Property model not found — missing import.
Stack trace: [attached].
Claude, fix the prompt. Cursor needs to add 'use App\Models\Tenant\Property;'"
```

## Daily rhythm

```
Morning:   Claude writes prompts for the day's work.
           Laud reviews and approves.

Midday:    Cursor codes from Claude's prompts.
           Commits each completed task.

Afternoon: Claude reviews Cursor's commits.
           Requests fixes if needed.

Evening:   Hermes pulls all commits, runs full test suite,
           deploys to staging, sends briefing to Laud.
```

## File conventions

- Prompts go in: `prompts/phase{N}-week{N}-{description}.md`
- Claude's reviews go in: `reviews/YYYY-MM-DD-{task}.md`
- Hermes's test reports go in: `reports/YYYY-MM-DD-{phase}-{result}.md`

## When things go wrong

If Cursor can't build what Claude asked:
  Cursor commits what it has, documents the blocker.
  Claude revises the prompt with more detail or a different approach.

If Claude's review finds bugs:
  Claude writes a fix prompt. Cursor applies it. Claude re-reviews.

If Hermes finds bugs during testing:
  Hermes reports exact errors to Claude.
  Claude writes a fix prompt. Cursor applies it. Hermes re-tests.

If Claude, Cursor, and Hermes all agree but the feature is wrong:
  ROADMAP.md or TARGET.md has the error.
  Laud fixes the plan. Everyone resynchronizes.
