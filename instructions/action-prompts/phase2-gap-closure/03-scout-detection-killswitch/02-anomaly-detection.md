# Action: Complete Heuristic Anomaly Detection (7 Anomaly Types)

## Goal
Bring the EXISTING `AnomalyDetector`/`BaselineLearner` up to the spec's full set of seven anomaly types (token spike, unusual tool sequence, unusual hours, new tool usage, rapid cycling, sensitive tool access, new IP/location), each with the documented detection method, severity, and auto-action.

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/03-scout-detection-killswitch/02-anomaly-detection.md`
- **This already exists in substantial form (227 lines) — gap-closure, not greenfield.** Read `console.labyrinthscout.com/src/security/anomaly-detector.ts` in FULL first. It exports:
  - `interface SessionMetrics` (line 7), `AnomalyResult` (line 17), `BaselineRow` (line 25)
  - `cacheKey`, `_resetBaselineCache`, `computeMeanStd`, `parseSessionMetrics`
  - class `BaselineLearner` (line 73) and class `AnomalyDetector` (line 129)
  - singletons `baselineLearner` and `anomalyDetector` (lines 226-227, the latter wired to `alertDispatcher` — confirms alert integration already exists)
  - `console.labyrinthscout.com/src/api/anomalies.ts` (40 lines) — admin API surface; short, likely minimal — compare against the spec's `GET /api/admin/scout/anomaly/baselines`
- The gap is almost certainly in WHICH of the seven anomaly types are actually implemented. Run `grep -n "token.*spike\|tool.*sequence\|unusual.*hour\|new.*tool\|rapid.*cycl\|sensitive.*tool\|new.*ip\|geolocation\|markov" anomaly-detector.ts` and build a checklist of which of the seven the existing `AnomalyDetector` class covers versus which are missing.
- Conventions: TypeScript strict, no emojis/em-dashes, extend the existing `*.test.ts` if present (`find . -iname "anomaly-detector.test.ts"`).

## Files to create (ONLY for anomaly types your audit shows are genuinely missing)
```
console.labyrinthscout.com/src/security/
  anomaly-types.ts             — Formal AnomalyType enum/union + per-type severity & auto-action table from the spec's response matrix (lines 110-118)
  __tests__/
    anomaly-types.test.ts
```
Do not create new files for anomaly types that the audit shows already exist inside `AnomalyDetector` — extend the class instead (see Files to modify).

## Files to modify
- `console.labyrinthscout.com/src/security/anomaly-detector.ts` — add detection methods for whichever of the seven types Step 1's audit shows are missing, following the existing class's method/return shape (`AnomalyResult`); likely candidates based on the file's modest size relative to seven distinct detectors: "unusual tool sequence" (needs a Markov-chain transition model — `tool_transition_probs` appears in the spec's `BehaviorBaseline` at line 83 but may not be in the current `BaselineRow`/cache), "new IP / location" (needs geolocation — check for an existing geo lookup with `grep -rn "geoip\|geolocation\|ip-api\|maxmind"`), and "sensitive tool access" (needs a predefined sensitive-tool/parameter table, which may overlap with `tool-policy.ts` from spec 03-allowlisting-ratelimiting — read that file first to avoid building a second list)
- `console.labyrinthscout.com/src/api/anomalies.ts` — add `GET /api/admin/scout/anomaly/baselines` if it returns something different from the spec's expected `{ baselines: [...] }` shape (read its current 40 lines fully; it is short)
- `console.labyrinthscout.com/src/security/anomaly-config.ts` — confirm the `AnomalyConfig` shape (`sensitivity`, `token_spike_multiplier`, `tool_rate_threshold`, `unusual_hour_threshold`, `min_baseline_days`) exists with the spec's defaults (`'medium'`, `3.0`, `10`, `2-6 AM UTC`, `7`); create this file ONLY if it does not already exist somewhere (search `find . -iname "anomaly-config*"` first — it may be inlined in `anomaly-detector.ts`)

## Step-by-step
1. Read `anomaly-detector.ts` in full (227 lines). For each of the spec's seven anomaly types (lines 18-75), determine: does a corresponding check exist in `AnomalyDetector`, and does its severity/detection-method match the spec? Build an explicit checklist as your first output before writing any code — this determines everything else in this prompt.
2. Read `BaselineLearner` (line 73 onward) and compare its tracked fields against the spec's `BehaviorBaseline` interface (lines 78-91): `token_usage_daily_avg/stddev`, `active_hours[24]`, `tool_transition_probs`, `known_ips`, `known_locations`, `typical_tool_rate_per_minute`, `confidence`. List any fields the current implementation does not track — these block the corresponding anomaly checks.
3. Read `tool-policy.ts` (`console.labyrinthscout.com/src/security/tool-policy.ts`, exports `ToolPolicy`, `DEFAULT_POLICY` at line 76) to see whether a "sensitive tools" concept already exists there — if so, the "sensitive tool access" anomaly check should READ from `tool-policy.ts`'s definitions, not maintain a second list.
4. For each missing anomaly type identified in Step 1, implement it as a new method on `AnomalyDetector` returning `AnomalyResult`, following the file's existing patterns (e.g. if token-spike detection already uses `computeMeanStd` for a 3-sigma check, model "unusual access hours" similarly using the `active_hours` histogram).
5. If `tool_transition_probs` (Markov chain) is missing from `BaselineLearner`, add it: track `Map<fromTool, Map<toTool, count>>`, normalize to probabilities on baseline update, and flag transitions below a low-probability threshold.
6. If geolocation is missing, check whether any existing dependency provides it (`grep -n "geoip\|maxmind\|ip-api" package.json`); if none exists, use a lightweight approach consistent with the codebase's style (do not add a paid geolocation API without flagging it — note in a comment that this requires a `GEOLOCATION_API_KEY` env var the user must supply).
7. Create `anomaly-types.ts` with the formal type union and the response-matrix table (severity + auto-action) from spec lines 110-118, and have `AnomalyDetector` reference it instead of any inline severity strings (refactor minimally — read how severities are currently assigned first).
8. Wire each new check into whatever loop/dispatch already calls the existing checks (read how `anomalyDetector` is invoked from the request pipeline — likely via `prompt-guard-middleware.ts` or `tool-policy-middleware.ts`).

## Expected behavior
- 10x normal token usage in an hour produces a HIGH alert with auto-action "alert dashboard + Telegram, temporary rate limit" within 15 minutes
- A rapid `terminal → terminal → terminal → delete → terminal` sequence in 30 seconds produces a MEDIUM "unusual tool sequence" alert
- First-ever use of `write_file` or `delete` by a tenant produces a MEDIUM "first-time tool usage" alert
- 15+ tool calls in 60 seconds produces a HIGH "rapid tool cycling" alert and a temporary rate limit
- `terminal` with `sudo`, or a write to `/etc/`, produces a CRITICAL alert and requires admin approval before proceeding
- A login from a new country/city produces a LOW "new access location" alert
- `GET /api/admin/scout/anomaly/baselines` returns per-tenant baseline data including confidence scores

## Test
- Extend the existing test file (or create one in the established `__tests__/` convention) with one case per anomaly type from the spec's verification block (lines 121-138), each asserting the correct `severity` and that the right alert/auto-action fires
- Use Vitest fake timers for the "15 minutes" / "1 hour" / "7 day baseline" windows — do not write real-time-sleeping tests
- Run `pnpm test -- anomaly` and confirm all pass

## Dependencies
- Step 1's checklist is the prerequisite for everything else — do not write detection code for types that already exist
- Read `tool-policy.ts` before building "sensitive tool access" detection (avoid a duplicate sensitive-tools list)
- Geolocation requires either an existing dependency or a new env-var-configured API key the user supplies — flag this explicitly rather than hardcoding a service or key
