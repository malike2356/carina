# Prompt 02 - Memory Discipline and Context Compaction

You are working in the Carina repository.

Goal: adopt Hermes-style memory discipline and compaction safety.

Read first:
- `instructions/prompts/researched_gap/agent_research/CROSS-AGENT-LEARNING.md`
- `instructions/prompts/researched_gap/agent_research/CONTEXT-OVERFLOW-FIX.md`
- the current memory and context assembly code

Implement a memory policy that:
- stores declarative facts, not instructions to self
- avoids task logs, commit SHAs, PR numbers, and temporary state
- treats stale details as a bug
- keeps durable memory compact and high-value

Implement context compaction protection:
- add a warning prefix for resumed or compacted context when needed
- preserve task continuity without reviving stale instructions
- trim history before trimming durable memory or the core prompt

Add the budget and overflow controls described in the research where Carina is currently weak:
- tunable max memory context
- context size guardrails
- a sane fallback if the prompt budget grows too large

Acceptance criteria:
- memory injection stays compact
- stale work artifacts are not stored as memory
- compaction does not resurrect old tasks
- tests cover the compaction and memory filtering rules

