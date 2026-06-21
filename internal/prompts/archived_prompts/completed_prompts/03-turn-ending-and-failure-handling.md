# Prompt 03 - Turn Ending and Failure Handling

You are working in the Carina repository.

Goal: adopt the Odysseus turn-ending model and the Hermes fail-safe execution discipline.

Read first:
- `instructions/prompts/researched_gap/agent_research/AGENT-SYSTEM-PROMPTS.md`
- `instructions/prompts/researched_gap/agent_research/CROSS-AGENT-LEARNING.md`

Implement the three-turn-end model:
- DONE
- BLOCKED
- KEEP GOING

The agent should only end a turn after one of those states is true.

Also implement:
- fail-silent prevention
- explicit retry-after-failure guidance
- one-step-forward behavior after a failed tool or command

The point is simple: a failed tool call is mid-task information, not the end of the task.

Acceptance criteria:
- failed tools do not cause silence
- failed tools do not cause fabricated success
- the assistant keeps moving until the task is actually finished or blocked
- tests cover the new turn-ending logic or the prompt contract

