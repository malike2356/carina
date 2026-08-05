# Prompt 04 - Casual Messages and Platform Formatting

You are working in the Carina repository.

Goal: make Carina behave correctly in casual conversation and across channels.

Read first:
- `instructions/prompts/researched_gap/agent_research/CROSS-AGENT-LEARNING.md`
- `instructions/prompts/researched_gap/agent_research/UI-CLI-GUI-REPORT.md`
- the existing channel adapters and message formatting helpers

Implement:
- casual message handling, so the agent does not overreact to "ok", "thanks", or banter
- group-chat awareness, so it stays silent unless mentioned or explicitly needed
- platform-specific formatting guidance for Telegram, Slack, WhatsApp, Discord, and similar channels

Follow the OpenClaw pattern:
- no markdown tables where the platform handles them badly
- no heavy formatting where the channel strips it
- mention-gated replies for noisy group contexts

Acceptance criteria:
- casual messages do not trigger verbose tool work
- group chats do not get spammed
- platform output is readable and channel-aware
- tests cover at least one platform-specific formatting path

