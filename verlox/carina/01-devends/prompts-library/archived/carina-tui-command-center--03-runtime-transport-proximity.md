---
id: 2026-07-13_carina_tui_command_center_03_runtime_transport
title: Carina TUI Command Center 03, runtime transport proximity
product: carina
capability: tui-command-center
status: completed
source: operator-request
source_chat:
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-tui-command-center--03-runtime-transport-proximity.md
repo_paths:
  - 02-backends/core.carinaai.uk/src/tui
  - 02-backends/core.carinaai.uk/src/agents
  - 02-backends/core.carinaai.uk/src/gateway
depends_on:
  - carina-tui-command-center--01-contract-audit-and-test-harness.md
tags:
  - carina-tui
  - runtime
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm exec vitest run src/tui
---

# Prompt 03: Runtime Transport Proximity

**Status: COMPLETED 2026-07-13**

**What was built:**

- Added `src/tui/runtime-transport/types.ts` with the `TuiRuntimeTransport` contract, runtime events, snapshots, usage, tools, and stream handlers.
- Added JSON-RPC, in-process, mock transport adapters and a safe selector controlled by explicit mode or `CARINA_TUI_TRANSPORT`.
- Updated the Ink TUI, session hook, and model picker to depend on the transport interface rather than the concrete gateway client.
- Added transport tests and marked runtime transport proximity as present in the Command Center contract.

## Objective

Move Carina TUI closer to the agent runtime without breaking current gateway behavior. Support a runtime transport abstraction that can run through local in-process calls, JSON-RPC gateway, and future WebSocket or HTTP transports.

## Current Gap

Carina Ink TUI uses `GatewayClient` for sessions and streaming. The older operator TUI uses `CarinaOrchestrator` in-process. These are useful, but they are split and not covered by a unified runtime transport contract.

## Target Files

- `02-backends/core.carinaai.uk/src/tui/ink/transport/json-rpc.ts`
- New `02-backends/core.carinaai.uk/src/tui/runtime/`
- New `02-backends/core.carinaai.uk/src/tui/runtime-transport/`
- `02-backends/core.carinaai.uk/src/tui/ink/app.tsx`
- `02-backends/core.carinaai.uk/src/tui/app.ts`
- Tests under `02-backends/core.carinaai.uk/src/tui`

## Implementation Prompt

Create a `TuiRuntimeTransport` interface that supports:

- `healthCheck`
- `createSession`
- `listSessions`
- `switchSession`
- `streamChat`
- `interrupt`
- `sendSteer`
- `getRuntimeSnapshot`
- `subscribeRuntimeEvents`
- `resolveApproval`
- `listTools`
- `getUsage`

Implement adapters:

- `jsonRpcTransport`, wrapping the existing `GatewayClient`.
- `inProcessTransport`, wrapping `CarinaOrchestrator` and current local runtime helpers.
- `mockTransport`, for deterministic TUI tests.

Add a selector:

- Default to the current JSON-RPC path.
- Use in-process mode only when explicitly requested through a safe flag or local config.
- Keep existing behavior for production deployments.

Wire the Ink TUI through the transport interface without removing existing capabilities.

## Acceptance Criteria

- The TUI no longer hard-codes one runtime path in the top-level app.
- Both JSON-RPC and in-process transports satisfy the same tests.
- Streaming, session creation, session switching, model switching, approvals, and interrupt still work.
- Runtime events can be normalized for later timeline work.
- No user-visible text mentions Keprix or Hermes.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm exec vitest run src/tui
```
