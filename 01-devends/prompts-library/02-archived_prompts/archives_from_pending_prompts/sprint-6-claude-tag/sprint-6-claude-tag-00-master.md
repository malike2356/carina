# Sprint 6 -- Claude Tag-Inspired: Channel-Aware Team Agent

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

**Sprint:** 6 -- Research App Integration & AI Employee Automation
**Prompt number:** 00 (master index)
**Status:** COMPLETED (2026-06-25)
**Source:** Anthropic Claude Tag announcement (June 23, 2026)
**Name:** Channel-aware team agent -- passive reading, ambient mode, @mention, channel memory
**Primary agent:** Claude Code (all prompts)
**Estimated hours:** 14-18 h total

---

## Summary

Channel-resident agent for Slack: passive reading, fact extraction, ambient
proactive checks, channel-scoped memory recall, and team-visible @mention
responses.

## Implementation (core.carinaai.uk)

| Area | Path |
|------|------|
| Ambient module | `src/agents/ambient/` |
| Slack adapter | `src/gateway/channels/adapters/slack-adapter.ts` |
| Router context injection | `src/gateway/router.ts` |
| Admin channel memory API | `src/admin/channel-memory-routes.ts` |
| Migrations | `channel_context_facts`, `ambient_channel_settings`, `channel_agent_bindings` |
| Docs | `docker/docs/CHANNEL-SETUP.md` (Slack scopes + `/ambient` commands) |
| Tests | 48 vitest cases under `src/agents/ambient/` and slack adapter tests |

## Enable

```bash
CARINA_AMBIENT_MODE_ENABLED=true
# optional: CARINA_SLACK_AMBIENT_EXCLUDE_CHANNELS=#exec,#finance
```

## Done when

- [x] Slack adapter reads all channel messages (not just @mentions)
- [x] Pipeline extracts facts, decisions, deadlines, people from message streams
- [x] Memory entries tagged with channel source and scoped per recall
- [x] Ambient mode surfaces relevant context, follows up stale threads
- [x] `@Carina` mention in any channel triggers agent with channel context
- [x] All features gated behind `CARINA_AMBIENT_MODE_ENABLED`
- [x] Scout audit log captures all ambient actions
- [x] GDPR-compliant: channel-scoped, purgeable, retention policy

## Sub-prompts

| # | File | Status |
|---|------|--------|
| 01 | sprint-6-claude-tag-01-passive-channel-reading.md | COMPLETED |
| 02 | sprint-6-claude-tag-02-channel-context-ingestion.md | COMPLETED |
| 03 | sprint-6-claude-tag-03-ambient-agent-mode.md | COMPLETED |
| 04 | sprint-6-claude-tag-04-channel-scoped-memory.md | COMPLETED |
| 05 | sprint-6-claude-tag-05-at-mention-channel-trigger.md | COMPLETED |
