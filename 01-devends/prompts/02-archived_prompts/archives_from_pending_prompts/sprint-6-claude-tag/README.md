# Sprint 6 -- Channel-Aware Team Agent (archived)

Completed 2026-06-25. Implemented in `02-backends/core.carinaai.uk/`.

Prompts:

- `sprint-6-claude-tag-00-master.md` -- index and done checklist
- `sprint-6-claude-tag-01-passive-channel-reading.md`
- `sprint-6-claude-tag-02-channel-context-ingestion.md`
- `sprint-6-claude-tag-03-ambient-agent-mode.md`
- `sprint-6-claude-tag-04-channel-scoped-memory.md`
- `sprint-6-claude-tag-05-at-mention-channel-trigger.md`

Validation: `pnpm exec vitest run src/agents/ambient src/gateway/channels/adapters/slack-ambient.test.ts src/gateway/channels/adapters/slack-channel-trigger.test.ts`
