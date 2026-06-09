# Action: Complete the Real-Time Security Dashboard

## Goal
Bring the EXISTING Scout dashboard up to the spec: live WebSocket/SSE feed, threat metrics, agent status, kill-switch widget, searchable audit log, and usage analytics, in the exact layout promised on carinaai.uk and labyrinthscout.com.

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/02-scout-injection-dashboard/03-security-dashboard.md`
- **A dashboard already exists; this is gap-closure, not greenfield.** Read these before writing anything:
  - `console.labyrinthscout.com/public/dashboard.html` and `public/account/dashboard.html`; the existing dashboard UI shells
  - `console.labyrinthscout.com/src/api/sse.ts` (93 lines); Server-Sent Events endpoint; the spec describes a WebSocket protocol (`{ type: "subscribe", channels: [...] }` etc); confirm whether SSE is the chosen real-time transport for this codebase (likely yes, given it already exists and WebSocket does not) and ADAPT the spec's WebSocket message shapes to SSE event names rather than introducing a second real-time transport
  - `console.labyrinthscout.com/src/api/status.ts` (119 lines), `src/api/stats.ts` (20 lines), `src/api/instances.ts` (42 lines), `src/api/events.ts` (280 lines), `src/api/anomalies.ts` (40 lines), `src/api/honeypots.ts` (208 lines), `src/api/export.ts` (157 lines), `src/api/kill.ts` (33 lines); these are the data sources for the dashboard widgets (agent status, threat metrics, live feed, audit log, kill switch). Map each spec widget to its existing API before writing new endpoints.
  - `console.labyrinthscout.com/src/middleware/auth.ts` and `src/middleware/account-session.ts`; existing dashboard authentication; the spec wants 2FA + 30-minute session timeout + IP whitelist; confirm what exists today with `grep -n "2fa\|totp\|session.*timeout\|ip.*whitelist" src/middleware/*.ts`
- The gap is most likely: (a) the live-feed/widget wiring between the existing SSE endpoint and the dashboard HTML, (b) the exact widget layout from the spec's ASCII mockup, (c) 2FA / session-timeout / IP-whitelist on dashboard auth if not already present, (d) the kill-switch confirmation UX described in the spec.
- Conventions: TypeScript/HTML/CSS/JS, no emojis/em-dashes, every new backend module gets a `*.test.ts`.

## Files to create (only what does not already exist; confirm each path first)
```
console.labyrinthscout.com/src/dashboard/
  widgets/
    agent-status.ts; aggregates src/api/instances.ts data for the AGENTS widget
    threat-metrics.ts; aggregates src/api/anomalies.ts + events.ts for THREATS/BLOCKED widgets
    usage-analytics.ts; token usage % for the TOKEN USAGE widget (check src/api/stats.ts first; may already cover this)
  __tests__/
    agent-status.test.ts
    threat-metrics.test.ts
    usage-analytics.test.ts
console.labyrinthscout.com/public/dashboard/js/widgets/
  agent-status.js
  threat-metrics.js
  live-feed.js
  kill-switch.js
  audit-log.js
  usage-analytics.js
```

## Files to modify
- `console.labyrinthscout.com/public/dashboard.html`; restructure to match the spec's layout (lines 38-71): header with KILL SWITCH button + admin/last-updated, four summary tiles (AGENTS/THREATS/BLOCKED/TOKEN USAGE), LIVE FEED panel, ATTACKS (24H) panel with top-attack-sources bar, AUDIT LOG panel with search/export. Read the current HTML structure first and adapt it rather than discarding it wholesale if it is close.
- `console.labyrinthscout.com/src/api/sse.ts`; extend the event channel set to cover everything the spec's WebSocket protocol lists (`live_event`, `threat_update`, `agent_update`, `kill_switch_status`, `audit_results`, `token_update`); translate each into an SSE named-event rather than a generic message, since SSE (unlike WebSocket) supports named event types natively
- `console.labyrinthscout.com/src/middleware/auth.ts`; add 2FA (TOTP) if not present, 30-minute inactivity session timeout, and an optional IP-whitelist check (read existing session/auth code first; extend, do not replace)
- `console.labyrinthscout.com/src/api/kill.ts`; confirm the response shape matches the dashboard's confirmation flow (`"This will immediately stop all N active agents. Are you sure?"` then `"KILL SWITCH ACTIVATED; <timestamp> by <admin>"`); this 33-line file is short and may need the confirmation-prompt logic added (the actual stop logic already lives in `lib/instance-control.ts` per `suspendInstance`)

## Step-by-step
1. Open `public/dashboard.html` and `public/account/dashboard.html` in full and compare their current layout against the spec's ASCII mockup (lines 39-71). List exactly which sections exist, which are missing, and which need restructuring.
2. Read `src/api/sse.ts` fully; note its current event/channel naming so the new widget JS subscribes to real event names, not invented ones.
3. Read `src/api/status.ts`, `stats.ts`, `instances.ts`, `events.ts`, `anomalies.ts`, `honeypots.ts`, `export.ts` to map each to a spec widget:
   - AGENTS tile → `instances.ts` (active count)
   - THREATS / BLOCKED tiles → `anomalies.ts` + `events.ts` (counts by severity/result)
   - TOKEN USAGE tile → `stats.ts` (confirm it already returns token usage; if not, this is the one new aggregation needed)
   - LIVE FEED → `sse.ts` real-time stream of `events.ts` rows
   - ATTACKS (24H) + Top Attack Sources → `events.ts` filtered/grouped by `ip_address` and `pattern_id`
   - AUDIT LOG search/export → `export.ts` (CSV); confirm whether a JSON search endpoint exists alongside the CSV exporter; if not, add one
4. Build only the widgets that genuinely have no backing aggregation yet (likely `threat-metrics.ts` for the top-attack-sources grouping, and possibly `usage-analytics.ts` if `stats.ts` does not already compute the percentage).
5. Restructure `dashboard.html` to the spec layout, wiring each section to its real API/SSE source (use the existing dashboard JS as a base; read `public/dashboard.html`'s `<script>` includes to find it).
6. Write the widget JS files under `public/dashboard/js/widgets/`; each subscribes to the relevant SSE event name and renders its section. Use Chart.js if it is already a dependency (`grep -n "chart.js\|Chart.js" public/dashboard.html package.json`); do not add a new charting library if one exists.
7. Implement the kill-switch confirmation flow in the dashboard JS: click → confirm modal showing live agent count from the `agent_update` stream → POST to `/api/admin/scout/killswitch/trigger` (read `kill.ts` to confirm the actual route path; the spec's path may differ from the real one) → on success, render the "ACTIVATED" state with timestamp/admin/reason.
8. Add 2FA/session-timeout/IP-whitelist to `auth.ts` only for whatever is genuinely missing (Step in Context already told you to grep first).

## Expected behavior
- Sending a chat message from any tenant makes it appear in the LIVE FEED within 1 second
- Clicking "KILL SWITCH" shows a confirmation dialog with the live agent count, and confirming stops all agents and shows the activated state with timestamp and admin email
- Searching the audit log for `"INJ-001"` returns matching events from `export.ts`'s underlying query
- The TOKEN USAGE tile shows `used / limit (percentage)` and updates live via SSE

## Test
- `agent-status.test.ts` / `threat-metrics.test.ts` / `usage-analytics.test.ts`: each aggregation function returns the documented shape from representative DB rows (use the existing test-fixture style seen in `src/security/__tests__/`)
- Run `pnpm test -- dashboard` and confirm all pass
- Manual: open the dashboard, trigger a chat message and confirm it appears in the live feed within 1 second; trigger the kill switch in a test environment and confirm the full activation flow

## Dependencies
- Steps 1-3 (reading the existing dashboard HTML and all relevant API files) MUST happen before any widget is written; duplicating an existing aggregation wastes the build and creates two sources of truth
- Confirm SSE vs WebSocket as the real-time transport before writing any client-side subscription code (the spec assumes WebSocket; the codebase already has SSE; adapt the spec to reality, do not introduce a second transport)
