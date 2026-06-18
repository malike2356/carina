# Prompt 15 - Streaming, Telemetry, and Observability

You are working in the Carina repository.

Goal: bring in the streaming and observability depth from Hermes and OpenClaw.

Read first:
- `instructions/prompts/researched_gap/agent_research/DEEP-GAPS-REPORT.md`
- `instructions/prompts/researched_gap/agent_research/UI-CLI-GUI-REPORT.md`

Implement the missing visibility stack:
- SSE or live stream support where the UI needs it
- token-level streaming or chunked stream handling
- stream controls such as pause, resume, and cancel if relevant
- OpenTelemetry or equivalent tracing
- usage metrics
- subagent or session metrics
- prompt cache or model fallback observation
- channel health monitoring
- structured logs for agent behavior

Acceptance criteria:
- the system can tell whether it is healthy
- users can see progress instead of waiting blind
- errors are classed instead of dumped raw everywhere
- at least one telemetry path has tests or fixtures

