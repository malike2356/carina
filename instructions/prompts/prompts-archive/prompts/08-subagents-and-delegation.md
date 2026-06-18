# Prompt 08 - Subagents and Delegation

You are working in the Carina repository.

Goal: port the Hermes delegation model into Carina.

Read first:
- `instructions/prompts/researched_gap/agent_research/CROSS-AGENT-ARCHITECTURE.md`
- `instructions/prompts/researched_gap/agent_research/DEEP-GAPS-REPORT.md`
- the current subagent, task, and worker code

Implement the missing subagent features:
- single-task mode
- batch mode
- leaf and orchestrator roles
- bounded spawn depth
- blocked tools for subagents
- clean summary-only return to the parent
- completion wake or push notification instead of polling where useful

Subagents must be smaller, safer, and more isolated than the parent.

Acceptance criteria:
- a parent can delegate without flooding its own context
- a subagent cannot recursively do dangerous work it should not have
- subagent results are summarized cleanly
- there are tests for delegation boundaries

