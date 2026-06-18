# Prompt 20 - Configuration and Budget Management

You are working in the Carina repository.

Goal: adopt the typed configuration, iteration budget, and cost-aware controls seen in the source agents.

Read first:
- `instructions/prompts/researched_gap/agent_research/CROSS-AGENT-ARCHITECTURE.md`
- `instructions/prompts/researched_gap/agent_research/DEEP-GAPS-REPORT.md`
- the current Carina config code

Implement:
- typed config or schema validation
- config migration where needed
- per-agent or per-session config when useful
- iteration or turn budgets with refund behavior if applicable
- quota visibility or remaining-budget warnings
- model selection guardrails so Carina does not burn money by accident

Keep the config system disciplined. The goal is not more knobs; it is fewer surprises.

Acceptance criteria:
- config errors are caught early
- budgets are visible and enforced
- expensive paths are guarded
- the config model is testable and documented

