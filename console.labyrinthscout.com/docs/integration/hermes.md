# Hermes Integration

Hermes agents that speak the OpenAI Chat Completions API use the same **Scout proxy** path as [OpenClaw](/integration/openclaw).

## Configuration

1. Enable proxy on Scout (`SCOUT_PROXY_ENABLED=true`).
2. Set Hermes `OPENAI_API_BASE` (or equivalent) to `http://scout-host:8080/v1`.
3. Set API key to `SCOUT_PROXY_KEY`.

## Upstream router

`LABYRINTH_LLM_ROUTER_URL` must point to the Hermes-compatible backend that actually calls your model provider.

## Event visibility

Proxy blocks and detections appear in the dashboard under `openai-proxy` source. For per-tool reporting, wrap Hermes tool execution with `@verlox/labyrinth-scout` `reportToolCall()`.

## Kill switch

Proxy mode does not poll instance status. Run a sidecar process with `startKillSwitchPolling()` from the SDK, or migrate long-running workloads to [Carina](/integration/carina) for native Redis kill-switch support.
