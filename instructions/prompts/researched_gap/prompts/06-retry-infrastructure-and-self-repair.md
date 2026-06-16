# Prompt 06 - Retry Infrastructure and Self-Repair

You are working in the Carina repository.

Goal: adopt OpenClaw-style retries and doctor-level self repair.

Read first:
- `instructions/prompts/researched_gap/agent_research/CROSS-AGENT-ARCHITECTURE.md`
- `instructions/prompts/researched_gap/agent_research/DEEP-GAPS-REPORT.md`
- the current config, migration, and diagnostics code

Implement the missing recovery patterns:
- reusable retry helper with jitter and retry-after support
- doctor command or repair entry point
- config migration support
- state repair support
- channel capability repair or mismatch detection
- context-engine compatibility repair if needed

The goal is to make broken state recoverable without manual surgery.

Acceptance criteria:
- obvious config mistakes can be detected and repaired
- state migrations are explicit and testable
- failed operations retry once in a disciplined way instead of collapsing
- the repair path emits structured guidance instead of vague errors

