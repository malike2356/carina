# Prompt 09 - Session History and Memory Search

You are working in the Carina repository.

Goal: adopt the best session search and memory retrieval patterns from Hermes, OpenClaw, and Odysseus.

Read first:
- `instructions/prompts/researched_gap/agent_research/CROSS-AGENT-ARCHITECTURE.md`
- `instructions/prompts/researched_gap/agent_research/DEEP-GAPS-REPORT.md`

Implement or improve:
- session search across past work
- session lineage or parent-child tracking
- search shapes for discovery, scrolling, and recent browsing
- memory search when useful, not constant injection of everything
- a curated long-term summary plus on-demand detail retrieval

The important point is retrieval discipline: do not inject every past detail into every turn.

Acceptance criteria:
- past sessions are searchable
- retrieval is scoped and efficient
- memory stays curated instead of bloated
- the search path is useful enough to replace manual digging

