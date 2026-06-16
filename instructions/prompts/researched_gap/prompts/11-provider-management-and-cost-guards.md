# Prompt 11 - Provider Management and Cost Guards

You are working in the Carina repository.

Goal: adopt Hermes and OpenClaw provider management plus cost discipline.

Read first:
- `instructions/prompts/researched_gap/agent_research/CROSS-AGENT-ARCHITECTURE.md`
- `instructions/prompts/researched_gap/agent_research/DEEP-GAPS-REPORT.md`

Implement the missing provider-side controls:
- provider adapters or provider plugins
- model metadata for capability, context length, and pricing
- configurable fallback chains
- model-family prompt overlays when needed
- API quota polling or remaining-budget visibility
- preflight warnings for expensive model choices

The goal is to avoid surprise spend and weak provider handling.

Acceptance criteria:
- the agent can reason about cost before it burns budget
- provider selection is explicit and testable
- expensive choices produce warnings or guardrails
- fallback behavior is covered by tests

