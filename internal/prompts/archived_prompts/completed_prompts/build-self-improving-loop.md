# Build Carina's Autonomous Self-Improvement Loop

**Working directory:** /opt/lampp/htdocs/verlox/carina/core.carinaai.uk
**Goal:** Give Carina the same self-improving learning loop that Hermes has -- execute, evaluate, extract, refine -- running autonomously without human prompting.

---

## What Already Exists

Carina already has the pieces. They just aren't wired into an autonomous loop:

| Component | Location | Status |
|-----------|----------|--------|
| Skill auto-writer | `src/skills/skill-writer.ts` (or similar) | Exists, triggered manually |
| Skill curator | `src/skills/curator.ts` (or similar) | Exists, not scheduled |
| Skill documents table | Database (`skill_documents`) | Exists |
| Memory system | `src/memory/` | Exists, Postgres-backed |
| Tool execution pipeline | `src/tools/tool-runner.ts` | Exists |
| Agent loop | `src/agents/` | Exists |
| Episodic memory | `episodic_memories` table | Exists |

---

## What To Build

### 1. Post-Task Evaluation Hook

Every time Carina completes a complex task (multi-step, 3+ tool calls), it must pause and evaluate itself before responding to the user.

**New file:** `src/skills/post-task-evaluator.ts`

```
After every complex task (3+ tool calls):
  1. Pause before delivering the final response
  2. Ask internally: "Was this a novel approach? Did I figure something out?"
  3. If yes:
     a. Extract the pattern into a skill draft
     b. Check if a similar skill already exists
     c. If new: save as draft skill, notify user in a single line: "(saved approach as skill: <name>)"
     d. If similar exists: compare quality, update if better, skip if worse
  4. Never delay the user response. Run async after the response is sent.
```

**Key design rules:**
- Must not add latency to the user-facing response. Fire-and-forget after the turn completes.
- Maximum one line notification to the user: "(saved approach as skill: `<name>`)" -- not a paragraph.
- Skill drafts marked as `status: draft` until the curator reviews them.
- User can disable with `CARINA_AUTO_SKILL=false` in .env.

### 2. The Learning Loop (Execute → Evaluate → Extract → Refine)

**New file:** `src/skills/learning-loop.ts`

This is the core algorithm:

```
execute  →  The agent completes a task using existing skills/tools
    ↓
evaluate →  Post-task evaluator asks:
            - Did this task require 3+ tool calls? (threshold for "complex")
            - Was the approach novel? (not just following an existing skill)
            - Did the user correct me? (corrections are high-value learning signals)
            - Did I succeed? (failed tasks should also generate skills -- "how NOT to do X")
    ↓
extract →  Generate a skill draft:
            - Name: short, searchable, kebab-case
            - Trigger keywords: what phrases should trigger this skill?
            - Description: one sentence
            - Prompt suffix: the reusable part of the approach
            - Source: which tool calls were used, in what order
            - Success rate: did it work? (starts at 1/1 or 0/1)
    ↓
refine  →  If a similar skill already exists:
            - Compare success rates
            - If new approach is better: update the existing skill
            - If existing is better: increment its success counter, discard draft
            - If they complement each other: merge prompt suffixes
            - Record the refinement in skill_audit_log
```

**Key design rules:**
- The loop runs after the user-facing response, never during.
- Failed tasks generate skills too -- "Attempted approach X, failed because Y. Do not do this."
- User corrections are the highest-value signal. If the user says "no, do it this way instead" -- that MUST become a skill.
- Do not generate skills for trivial single-tool tasks (web-search, file-read alone).
- Maximum 1 skill draft per task.

### 3. Autonomous Curator (7-Day Cycle)

**Modify:** `src/skills/curator.ts` (or create scheduled wrapper)

The curator must run automatically every 7 days. Not on a cron job -- as a background task within Carina's own scheduler (the existing heartbeat system or a new scheduled check).

**Curator actions (in order):**

```
Every 7 days:
  1. Review all draft skills (status: draft)
     - If used 3+ times successfully: promote to active
     - If never used in 14 days: archive
     - If used but failed >50% of the time: flag for review, demote to draft

  2. Consolidate overlapping skills
     - Find skills with >70% trigger keyword overlap
     - Compare prompt suffixes
     - If they cover the same ground, merge into one skill
     - Keep the higher-success-rate version as the base
     - Log consolidation in skill_audit_log

  3. Remove unused skills
     - Skills not used in 30+ days: archive (don't delete)
     - Archived skills can be restored if triggered again
     - Never auto-delete -- only archive

  4. Generate a curator report
     - Skills created this week
     - Skills promoted/relegated/consolidated/archived
     - Total skill library health: count, freshness, success rate distribution
     - Saved to memory: `curator-report-YYYY-MM-DD` as an episodic memory entry

  5. Notify the user (if they've opted in)
     - Single-line summary in the next interaction
     - Example: "Curator reviewed 34 skills: 2 promoted, 1 consolidated, 3 archived."
     - Can be silenced with CARINA_CURATOR_SILENT=true
```

**Key design rules:**
- Curator never deletes. Only archives. Archived skills are restorable.
- Curator runs in the background. Does not interrupt the user.
- Curator generates an audit trail. Every action is logged in `skill_audit_log`.
- If Carina is not running when the 7-day window passes, curator runs on next startup.

### 4. Skill Usage Tracking

**Modify:** The skill loader in `src/skills/` to increment `usage_count` and `last_used_at` every time a skill is loaded.

**New columns** in `skill_documents` (migration):
```sql
ALTER TABLE skill_documents ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0;
ALTER TABLE skill_documents ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;
ALTER TABLE skill_documents ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE skill_documents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived'));
ALTER TABLE skill_documents ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
```

### 5. Skill Audit Log

**New table:** `skill_audit_log`
```sql
CREATE TABLE IF NOT EXISTS skill_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID REFERENCES skill_documents(id),
    action TEXT NOT NULL, -- 'created', 'promoted', 'archived', 'consolidated', 'merged', 'refined', 'demoted'
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6. The Compounding Benchmark

**New file:** `src/skills/benchmark.ts`

A self-test that measures how much faster Carina gets over time.

```
On startup, if CARINA_BENCHMARK=true:
  1. Find the 5 most-used skills
  2. For each skill, look up:
     - How many times was it used?
     - What was the average task completion time on first use vs 20th use?
     - What was the success rate on first use vs 20th use?
  3. Output: "Carina compounding report: 5 most-used skills average X% faster after 20 uses."
  4. Store the benchmark result in memory
```

This gives Carina the same "40% faster after 20 skills" story that Hermes has.

### 7. Wiring It All Together

**Modify:** `src/agents/carina-agent.ts` (or the main agent loop)

Add the post-task evaluation hook. After the agent completes a turn and sends the response, fire the evaluator asynchronously:

```typescript
// After response sent to user
if (turn.toolCalls.length >= 3 && config.autoSkill !== false) {
  setImmediate(() => {
    postTaskEvaluator.evaluate(turn).catch(err => {
      logger.warn('post-task evaluator failed', err);
    });
  });
}
```

**Modify:** `src/scheduler.ts` (or the heartbeat system)

Add the 7-day curator check. On startup and every 24 hours, check if the curator needs to run:

```typescript
const lastCuratorRun = await getLastCuratorRun();
if (Date.now() - lastCuratorRun > 7 * 24 * 60 * 60 * 1000) {
  runCurator().catch(err => logger.warn('curator failed', err));
}
```

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CARINA_AUTO_SKILL` | `true` | Enable/disable automatic skill creation from tasks |
| `CARINA_CURATOR_SILENT` | `false` | Suppress curator summary messages to user |
| `CARINA_CURATOR_INTERVAL_DAYS` | `7` | Days between curator runs |
| `CARINA_BENCHMARK` | `false` | Run compounding benchmark on startup |

---

## What NOT To Do

- Do NOT add latency to the user-facing response. The evaluation loop runs AFTER the response.
- Do NOT auto-delete skills. Archive only.
- Do NOT generate skills for single-tool tasks (web-search, file-read).
- Do NOT interrupt the user with curator reports unless they've opted in.
- Do NOT touch the existing skill-writer or curator code if it already exists and works -- extend it, don't replace it.
- Do NOT change the skill format. Use the existing SKILL.md structure.
- No emojis. No em-dashes. Plain ASCII.

---

## Files To Inspect First

- `src/skills/` -- all existing skill-related code
- `src/agents/` -- the agent loop (find where turns complete)
- `src/memory/` -- memory system for storing curator reports
- `src/tools/tool-runner.ts` -- understand how tool calls work
- `src/scheduler.ts` -- existing scheduling infrastructure
- `src/config/` -- configuration loading
- Database migration files -- existing skill_documents schema

---

## Acceptance Criteria

1. Carina creates a skill automatically after completing a complex task (3+ tool calls) without the user asking.
2. The user sees exactly one line: "(saved approach as skill: `<name>`)" -- not a paragraph.
3. The 7-day curator runs autonomously and consolidates/archives skills.
4. Skills track usage count, success/failure count, and last-used timestamp.
5. All curator actions are logged in `skill_audit_log`.
6. `CARINA_AUTO_SKILL=false` disables the entire system.
7. No added latency to normal chat responses.
8. All existing tests pass.
9. New tests for: post-task evaluator, learning loop, curator cycle, consolidation logic, benchmark.
10. Test: run 20 similar tasks, verify compounding -- the 20th task should be measurably faster than the 1st.
