# Prompt 01 - System Prompt Hardening

You are working in the Carina repository.

Goal: harden Carina's base system prompt using the strongest patterns from Hermes and Odysseus.

Read first:
- `instructions/prompts/researched_gap/agent_research/AGENT-SYSTEM-PROMPTS.md`
- `instructions/prompts/researched_gap/agent_research/KARINA-PROMPT-BLOCKS.md`
- the current Carina prompt assembly code

Implement the missing behavioral blocks so the agent cannot:
- describe action instead of taking action
- fabricate tool results
- stop early when the task still needs work
- answer factual system questions from memory when a tool is required

Add, at minimum:
- tool-use enforcement
- anti-fabrication rule
- finishing-the-job rule
- mandatory tool-use list for facts, dates, state, file contents, hashes, and git history

Keep the text concise, direct, and cache-friendly. If prompt assembly is tiered, put the new blocks into the stable tier unless the pattern clearly belongs elsewhere.

Acceptance criteria:
- the prompt explicitly forces real tool calls for real actions
- the prompt explicitly forbids invented outputs
- the prompt has test coverage or snapshot coverage for the new prompt text
- existing behavior for casual or light requests does not regress

