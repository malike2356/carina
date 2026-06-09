# Action: Moving Target Deception (System Prompt Marker Rotation)

## Goal
Build moving-target deception from scratch: rotating system-prompt verification markers, decoy instructions/credentials, and randomized tool names, so attackers cannot craft exploits that remain valid over time. This is listed as a Scout feature on both carinaai.uk and labyrinthscout.com but does not exist in the codebase yet.

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/02-scout-injection-dashboard/02-moving-target.md`
- **Confirmed greenfield**: `grep -ril "moving.target\|decoy\|marker.*rotat\|rotation" console.labyrinthscout.com/src --include="*.ts"` returns NO results. Nothing to extend here.
- However, two adjacent systems already exist that this feature must integrate with rather than duplicate:
  - `console.labyrinthscout.com/src/security/honeypot-manager.ts` (295 lines, class `HoneypotManager`); ALREADY generates and rotates decoy credentials and detects leaks. The spec's "decoy instructions injected into system prompt" and "decoy API key... Scout monitors for this value in outputs" overlaps significantly with what `HoneypotManager` does. Read it fully before writing `decoy-generator.ts`; you may only need to build the ROTATION SCHEDULING and SYSTEM-PROMPT-INJECTION wiring around the existing honeypot manager, not a second decoy system.
  - `console.labyrinthscout.com/src/security/prompt-guard.ts`; the system prompt assembly point where markers/decoys must be injected; read how the system prompt is currently built before adding rotating content to it
  - `console.labyrinthscout.com/src/alerts/dispatcher.ts` (`alertDispatcher`); use this for `alert_on_decoy_leak`/`alert_on_stale_marker`, do not build a parallel alert path
- The spec's "tool name randomization" (mapping a randomized public tool name to the real internal tool) is a separate concern from `HoneypotManager`; this part IS genuinely new and must be built.
- Conventions: TypeScript strict, no emojis/em-dashes, every new module gets a `*.test.ts` under `__tests__/` (matching the convention in `src/security/__tests__/` and `src/alerts/__tests__/`).

## Files to create
```
console.labyrinthscout.com/src/deception/
  moving-target.ts; Core rotation engine: holds current marker, decoy set, tool-name map; exposes current state and rotation timestamps
  decoy-generator.ts; THIN wrapper that requests decoy values FROM HoneypotManager rather than generating its own (read honeypot-manager.ts first; reuse credential-generation, do not fork it)
  rotation-scheduler.ts; setInterval-based scheduler driving marker/decoy/tool-name rotation per the configured intervals
  decoy-tokens.json; Pool of marker token templates (e.g. "[VERIFY_TOKEN: {random_4}]")
  deception-config.ts; Per-tenant RotationConfig (marker_interval_minutes, decoy_rotation_minutes, tool_name_rotation_minutes, pool sizes, alert flags)
  stale-marker-detector.ts; Checks incoming messages against the last 5 rotated-out markers; fires an alert on a match
  __tests__/
    moving-target.test.ts
    rotation-scheduler.test.ts
    stale-marker-detector.test.ts
console.labyrinthscout.com/src/api/
  markers.ts; GET /api/admin/scout/markers (current marker + rotates_at)
```

## Files to modify
- `console.labyrinthscout.com/src/security/prompt-guard.ts`; add a hook that injects the current rotation marker and decoy block (sourced from `moving-target.ts`) into the assembled system prompt before each model call; read how the system prompt is currently constructed and add to it, do not replace it
- `console.labyrinthscout.com/src/server.ts` (or wherever routers are registered; confirm with `grep -n "Router\|app.use" src/server.ts`); register the new `markers` router under `/api/admin/scout/markers`
- `console.labyrinthscout.com/src/migrations.ts`; add a table for rotation history (`marker_value`, `rotated_at`, `retired_at`) needed by `stale-marker-detector.ts` to check the last 5 markers; follow the existing migration style in this file

## Step-by-step
1. Read `honeypot-manager.ts` in full (all 295 lines). Identify its `Honeypot` interface, `randomFromAlphabet`, `mapRow`, and the `HoneypotManager` class's generation/rotation/leak-detection methods.
2. Read `prompt-guard.ts` to find exactly where/how the system prompt string is assembled for each model call.
3. Read `alerts/dispatcher.ts` exports (`alertDispatcher`, `toSecurityEvent`) to understand how to fire `stale_marker_detected` and `decoy_leak` alerts through the existing pipeline.
4. Create `deception-config.ts` with the `RotationConfig` interface and defaults exactly as specified (marker_interval_minutes: 15, decoy_rotation_minutes: 60, tool_name_rotation_minutes: 30, marker_pool_size: 100, decoy_pool_size: 20, alert_on_decoy_leak: true, alert_on_stale_marker: true).
5. Create `decoy-tokens.json`: an array of marker templates with `{random_N}` placeholders, e.g. `["[VERIFY_TOKEN: {random_4}]"]`.
6. Create `moving-target.ts`: a class/module holding `currentMarker`, `previousMarkers: Marker[]` (last 5 retained), `currentToolNameMap: Map<realName, publicName>`, and methods `getCurrentMarker()`, `getCurrentToolName(realName)`, `resolveRealToolName(publicName)`. Persist rotation history to the new migration table.
7. Create `decoy-generator.ts` as a thin adapter: `getCurrentDecoyBlock(tenantId): Promise<string>` that calls into `honeypotManager` (the existing singleton exported at line 295 of `honeypot-manager.ts`) to obtain active decoy values, then formats them into the markdown block shown in the spec (lines 29-40). Do not write a second credential generator.
8. Create `rotation-scheduler.ts`: uses `setInterval` (or the codebase's existing job-scheduling pattern; check `console.labyrinthscout.com/src/scheduler.ts` first and reuse it if it exists) to rotate markers every `marker_interval_minutes`, decoys every `decoy_rotation_minutes` (by calling `honeypotManager.rotate()` if that method exists), and tool names every `tool_name_rotation_minutes`.
9. Create `stale-marker-detector.ts`: `checkIncomingMessage(message, currentMarker, previousMarkers)` per the spec's pseudocode (lines 70-78), firing a `high`-severity `stale_marker_detected` alert via `alertDispatcher` when a retired marker appears in user input.
10. Create `markers.ts` API router: `GET /api/admin/scout/markers` returns `{ current, rotates_at }`.
11. Modify `prompt-guard.ts` to call `moving-target.ts` for the current marker and `decoy-generator.ts` for the decoy block, concatenating both into the system prompt assembly (read the existing assembly code first so you append in the right place with the right formatting).
12. Add the rotation-history migration to `migrations.ts`, following the existing table-creation style in that file (check whether it uses raw SQL strings or a migration framework).
13. Register the `markers` router in `server.ts`.

## Expected behavior
- `GET /api/admin/scout/markers` returns `{ "current": "A7X2", "rotates_at": "2026-06-07T14:15:00Z" }` and the value changes after the configured interval elapses
- A user message containing a marker value that was retired more than one rotation ago triggers a `high`-severity alert and the request is blocked
- A user message containing the current decoy API key in agent OUTPUT triggers a `CRITICAL` alert via the existing `honeypotManager` leak-detection path (verify this flows through correctly rather than building a parallel detector)
- Tool names presented to the user/agent rotate on schedule; the agent correctly maps the rotated public name back to the real tool internally

## Test
- `moving-target.test.ts`: marker rotation produces a new value at the configured interval; `previousMarkers` retains exactly the last 5; tool-name mapping round-trips (`getCurrentToolName` → `resolveRealToolName` returns the original)
- `rotation-scheduler.test.ts`: use fake timers (Vitest `vi.useFakeTimers()`) to assert rotation callbacks fire at the configured intervals without waiting in real time
- `stale-marker-detector.test.ts`: a message containing a marker from 2 rotations ago triggers the alert; a message containing the CURRENT marker does not
- Run `pnpm test -- deception` and confirm all pass
- Manual verification per the spec's curl transcript (lines 82-101), substituting `sleep 900` with the test's fake-timer equivalent in CI and only running the real-time wait manually

## Dependencies
- `honeypot-manager.ts` must be read and reused for decoy generation/leak detection; do NOT fork its credential logic
- `alerts/dispatcher.ts` must be read and reused for alert delivery; do NOT build a parallel alert path
- Confirm whether `console.labyrinthscout.com/src/scheduler.ts` already provides job-scheduling infrastructure before writing a bespoke `setInterval` loop
