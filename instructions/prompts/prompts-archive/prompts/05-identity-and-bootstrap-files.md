# Prompt 05 - Identity and Bootstrap Files

You are working in the Carina repository.

Goal: adopt the OpenClaw and Hermes identity/bootstrap pattern.

Read first:
- `instructions/prompts/researched_gap/agent_research/AGENT-SYSTEM-PROMPTS.md`
- `instructions/prompts/researched_gap/agent_research/KARINA-PROMPT-BLOCKS.md`

Introduce the equivalent of:
- `SOUL.md`
- `IDENTITY.md`
- `TOOLS.md`
- `USER.md`
- `MEMORY.md`
- `HEARTBEAT.md`
- `BOOTSTRAP.md`

The split should follow the research:
- SOUL for voice and tone
- IDENTITY for self-definition
- bootstrap files for environment and workspace context

The goal is not more text. The goal is cleaner layering:
- stable identity
- session context
- volatile runtime facts

Acceptance criteria:
- the new files are loaded in the intended order
- the base voice is no longer generic or corporate
- the bootstrap set is small, explicit, and documented
- subagents can load a minimal subset when appropriate

