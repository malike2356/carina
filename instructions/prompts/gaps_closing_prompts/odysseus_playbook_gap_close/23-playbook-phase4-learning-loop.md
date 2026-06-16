# Prompt 23 - Playbook Phase 4: Learning Loop + Play Curator

## Objective

Track which plays were recommended vs chosen, outcomes, and evolve scoring weights. Weekly curator cycle archives stale plays. PewDiePie: "self-evolving... writes its own instruction... next time quicker."

---

## Context

**Depends on:** Prompt 22

**Read:** COOKBOOK_TO_PLAYBOOK_ROADMAP Phase 4

**Mirror:** `src/skills/curator.ts` patterns

---

## Step 1 - play-tracker.ts

Persist to `~/.carina/playbook-executions.jsonl` (or SQLite if project already uses it for ops):

```typescript
export interface PlayExecution {
  id: string;
  playId: string;
  domain: string;
  recommendedPathId: string;
  chosenPathId: string;
  outcome?: 'success' | 'partial' | 'failure';
  outcomeNotes?: string;
  timeToDecisionMs: number;
  constraintOverrides: string[];
  createdAt: string;
}
```

API:
- `recordPlayExecution(exec: PlayExecution)`
- `listExecutions(filters)`

---

## Step 2 - play-scorer-evolution.ts

- Aggregate last N executions per play
- If `chosenPathId !== recommendedPathId` > 40% of time, shift weights toward chosen path characteristics
- If recommended path failure rate > 30%, flag play for review
- Export `getEvolvedWeights(playId): WeightVector`

Apply evolved weights in `path-scorer.ts` when `PLAYBOOK_LEARNING_ENABLED=true`.

---

## Step 3 - play-emergence.ts

Detect:
- User goals matching no play (suggest new play stub in logs)
- Manual path executed repeatedly without play definition

Output: `EmergenceReport[]` for operator review. Do not auto-create plays.

---

## Step 4 - play-curator.ts

Weekly cycle (cron hook or `carina playbook curator run`):

- Archive plays unused 90+ days
- Flag plays with failure rate > 30%
- Never delete; move to `domains/_archived/`

CLI:
```
carina playbook curator report
carina playbook curator run [--force]
```

---

## Step 5 - Tests

- Recording execution updates JSONL
- Evolution shifts weights after synthetic 50 runs
- Curator archives zero-usage play in test fixture

---

## Acceptance criteria

- [ ] Executions recorded from CLI when user picks path (`--chosen path_id`)
- [ ] Curator report lists flagged plays
- [ ] Learning disabled by default
