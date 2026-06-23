# Prompt 14 - Channel and Platform Adapters

You are working in the Carina repository.

Goal: adopt the channel adapter model from Hermes and OpenClaw.

Read first:
- `instructions/prompts/researched_gap/agent_research/UI-CLI-GUI-REPORT.md`
- `instructions/prompts/researched_gap/agent_research/CROSS-AGENT-ARCHITECTURE.md`

Implement or improve:
- per-platform adapters
- inbound parsing and outbound formatting per channel
- mention-gated behavior in group contexts
- session binding across platforms
- native approval cards or channel-friendly approval UI where the platform supports it

Do not make every channel look like the web. Each adapter should respect its platform.

Acceptance criteria:
- at least one adapter handles platform-specific formatting cleanly
- group behavior is not noisy
- channel code is isolated from core logic
- tests cover the adapter contract

