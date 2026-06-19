# Learning loop, memory, and skills

Carina improves over time without treating chat transcripts as the product. The loop captures reusable procedures, learned preferences, and searchable work summaries.

## What runs automatically

| Layer | When | Output |
|---|---|---|
| Skill capture | 3+ tools on a turn, or user correction | New or refined skill in the skills store |
| Preference learning | User correction with clear signal | Declarative preference in learning events |
| Task outcome indexing | Complex turn with no skill saved | `[task-outcome]` row in session memory (FTS searchable) |
| Curator | After skill create/refine (scheduler optional) | Draft promotion, dedupe, stale prune |

Defaults (opt out with env):

- `CARINA_AUTO_SKILL` is on unless `false`
- `CARINA_TASK_OUTCOMES` is on unless `false`
- `CARINA_SKILL_CURATOR_ENABLED` is on unless `false`

Workshop review queue (off by default):

- `CARINA_SKILL_WORKSHOP=true` queues auto-captured skills for operator approval before publish

Background session learner (off by default):

- `CARINA_AUTO_SKILL_LEARN=true` queues lighter workflow drafts from 2+ tool turns

## Operator commands

```bash
carina learning status
carina learning recap --days=7
carina learning events --limit=30
carina learning pending
carina learning preferences
carina learning improvements
carina learning versions <skill-name>
carina learning rollback <skill-name> <version>
carina curator report
carina memory sessions search "deploy staging"
```

In chat, Carina can call `session-search` to recall prior work. Durable `memory` facts are for stable operator preferences, not task logs.

## What you see in chat

After complex work Carina may append a short parenthetical notice:

- `(saved approach as skill: deploy-staging)`
- `(learned your preference: Operator prefers POST over GET)`
- `(indexed work summary for later search; topic: Deploy staging)`

These are summaries, not transcript dumps.

## Web API

When the web gateway is running:

- `GET /api/learning/status`
- `GET /api/learning/recap?days=7`
- `GET /api/learning/improvements`
- `GET /api/learning/preferences`
- `GET /api/workshop/drafts` (when workshop enabled)

Session search in the web UI sidebar uses `GET /api/memory/sessions/search`.

## Memory vs skills vs session search

| Need | Use |
|---|---|
| Stable fact about the operator | `memory` tool or MEMORY.md |
| Reusable multi-step procedure | Skill (learning loop or manual) |
| Find what happened last week | `session-search` or `carina memory sessions search` |
| Review before publishing auto skills | Workshop queue (`CARINA_SKILL_WORKSHOP=true`) |

Carina rejects stale work artifacts in long-term memory (PR numbers, "phase N done", commit SHAs). Task outcomes live in session transcripts with the `[task-outcome]` marker so FTS can find them without polluting curated memory.

## Related docs

- Skill packs: [skill-packs](../skill-packs/)
- Memory backends: `carina memory backends`
- REM promotion: `carina memory dreams`, `carina memory promote`
- Benchmark: `carina benchmark run learning.curator`
