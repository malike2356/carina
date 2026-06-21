# Prompt 19 - Deep Research and Teacher Escalation

You are working in the Carina repository.

Goal: borrow Odysseus-style deep research and teacher escalation.

Read first:
- `instructions/prompts/researched_gap/agent_research/DEEP-GAPS-REPORT.md`
- `instructions/prompts/researched_gap/agent_research/CROSS-AGENT-ARCHITECTURE.md`

Implement:
- a research pipeline that can plan, search, extract, synthesize, and stop when the quality gate passes
- parallel query generation when appropriate
- a clean streaming progress model for long research tasks
- teacher escalation or stronger-model fallback when the local model fails a turn
- a way to capture the successful teacher answer as reusable knowledge or a skill

This is the pattern that turns repeated failure into future competence.

Acceptance criteria:
- research tasks can run without constant manual steering
- there is an explicit quality gate
- escalation is visible and recoverable
- the success path can be retained for future reuse

