# Source Chat: Carina and Aiva Cost, Workspace, Comms, and Channel Friction

Date: 2026-07-13
Source: operator request in active agent session

## Decisions Captured

- Model routing must become business-aware and task-aware:
  - Mini or local models first for low-risk chat, routine summarisation, and cheap background work.
  - OpenAI tokens for action-based work, tool calling, app control, and moderate operational tasks.
  - Claude for serious calculation, mathematical work, deep reasoning, long persistent tasks, mission-critical output, and very high value work.
- All three levels must be token efficient. Use proven public patterns where they exist, including prompt compression, response caching, semantic caching, budget enforcement, and observability.
- Subscription users must not burn more provider cost than their plan can sustain. BYOK users may use their own provider keys, but usage should still be tracked for product analytics and guardrails.
- Cost policy must include payment and transfer overhead plus margin. Baseline markup target is 3.5 percent cost overhead plus 1.5 percent platform margin, subject to configuration.
- Operators need a dashboard for token usage, cost, margin, alerts, and per-user economics.
- Aiva employees must be reachable directly from the mobile app and web UI. Users should not need to switch to WhatsApp, Slack, Telegram, or another channel to chat with, assign tasks to, and monitor Aiva employees.
- Aiva marketing currently overstates human VA involvement. Reposition human VA support as backup and escalation when AI cannot complete a task, not as an invisible always-on human service.
- Carina and Aiva workspace UX is too close to a generic chat app. It should feel like an agentic OS workspace: tasks, worker state, completed work, approvals, channels, documents, and operational outcomes should be visible around chat.
- Aiva launcher quality should be raised to feel polished, simple, and credible.
- WhatsApp setup should support a WhatsApp Web pairing path in addition to official WhatsApp Business API setup. Easy setup scales; complex setup creates abandonment.

## Research References

- LiteLLM proxy patterns: budget tracking, model routing, caching, spend logs.
- GPTCache style semantic caching for repeat and similar requests.
- LLMLingua prompt compression for long prompt and RAG token reduction.
- Baileys and whatsapp-web.js for WhatsApp Web pairing, with clear warning that unofficial WhatsApp Web automation can break and must not be used for spam.

## Non-Goals

- Do not bypass provider terms or platform anti-abuse policies.
- Do not copy external project code without license review.
- Do not overpromise human VA capacity.
- Do not hide real provider cost from internal ops dashboards.
