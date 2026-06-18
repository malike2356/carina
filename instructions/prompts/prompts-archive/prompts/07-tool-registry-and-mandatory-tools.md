# Prompt 07 - Tool Registry and Mandatory Tools

You are working in the Carina repository.

Goal: adopt the Hermes tool registry and mandatory tool discipline.

Read first:
- `instructions/prompts/researched_gap/agent_research/CROSS-AGENT-ARCHITECTURE.md`
- `instructions/prompts/researched_gap/agent_research/AGENT-SYSTEM-PROMPTS.md`
- the existing tool registration and tool invocation code

Implement or improve:
- registry-based tool discovery
- toolset grouping
- session-scoped tool enablement and disablement
- mandatory tool routing for facts, current state, file contents, and system facts
- a compact tool description source of truth

If Carina already has a tool layer, do not rewrite it blindly. Add the missing structure and discipline from the research.

Acceptance criteria:
- tool definitions are discoverable without brittle manual wiring
- the agent knows which questions must go through tools
- subagents can receive a reduced toolset
- tests cover at least one mandatory-tool path

