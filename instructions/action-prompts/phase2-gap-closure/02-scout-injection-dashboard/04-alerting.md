# Action: Complete Multi-Channel Alerting (SMS, Discord, Throttle, Escalation)

## Goal
Extend the EXISTING alert dispatcher with the missing channels (SMS, Discord), severity-based routing, alert throttling, and escalation, so every security event reaches the right people through the right channel without causing alert storms.

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/02-scout-injection-dashboard/04-alerting.md`
- **This is a gap-closure task — substantial alerting infrastructure already exists.** Read these first:
  - `console.labyrinthscout.com/src/alerts/dispatcher.ts` (114 lines) — exports `alertDispatcher`, `toSecurityEvent`, `dispatchToChannel`; this is the routing engine the spec calls `alert-service.ts`. Read it fully to learn its current routing logic before adding to it.
  - `console.labyrinthscout.com/src/alerts/types.ts` (30 lines) — existing `AlertChannel`/`SecurityEvent` shapes; compare against the spec's `Alert` interface (lines 62-75) and reconcile differences (the spec wants `acknowledged`/`acknowledged_by`/`acknowledged_at` fields — confirm whether `types.ts` already has them)
  - `console.labyrinthscout.com/src/alerts/email.ts` (84 lines), `telegram.ts` (68 lines), `slack.ts` (74 lines) — existing channel senders; the new `sms.ts` and `discord.ts` must match this file's shape and export convention exactly
- The gap: `grep -ril "twilio\|sms\|discord" src/alerts/*.ts` confirms NO sms or discord alert channel exists yet. Severity-based routing tables, throttling, and escalation also do not appear to exist — confirm with `grep -n "throttle\|escalat\|severity.*routing\|SEVERITY_ROUTING" src/alerts/dispatcher.ts src/alerts/types.ts`.
- If `core.carinaai.uk/src/gateway/channels/` (from spec 01-carina-core-gaps/03-multi-channel.md) lands first, REUSE its `discord-adapter.ts`/`sms-adapter.ts` send functions for actual delivery rather than writing a second Discord/Twilio client here — this file should be the ALERT-specific wrapper (templates, severity routing) around that shared transport. If that spec has not landed yet, write a minimal, self-contained sender here and leave a comment noting it should be consolidated later.
- Conventions: TypeScript strict, no emojis/em-dashes, every new sender gets a `*.test.ts` under `src/alerts/__tests__/`.

## Files to create
```
console.labyrinthscout.com/src/alerts/
  sms.ts                       — SMS alert delivery (Twilio), matches the shape of telegram.ts/slack.ts
  discord.ts                   — Discord alert delivery (webhook or bot), matches the shape of slack.ts
  templates.ts                 — Per-channel, per-severity message templates (the spec's exact CRITICAL/HIGH templates)
  throttle.ts                  — Per-tenant, per-severity 5-minute throttle with count-aggregation
  escalation.ts                — 5-minute / 15-minute unacknowledged-alert escalation
  routing.ts                   — SEVERITY_ROUTING table and lookup function
  __tests__/
    sms.test.ts
    discord.test.ts
    throttle.test.ts
    escalation.test.ts
    routing.test.ts
```

## Files to modify
- `console.labyrinthscout.com/src/alerts/dispatcher.ts` — wire in `routing.ts` (replace any ad-hoc channel selection with the `SEVERITY_ROUTING` lookup), `throttle.ts` (check-and-increment before calling `dispatchToChannel`), and `escalation.ts` (schedule a re-check for CRITICAL alerts); read the current `dispatchToChannel` function (line 91) before changing its call sites
- `console.labyrinthscout.com/src/alerts/types.ts` — add `acknowledged`/`acknowledged_by`/`acknowledged_at` to the `SecurityEvent`/`Alert` shape if genuinely absent (confirm first)
- `console.labyrinthscout.com/src/migrations.ts` — add `acknowledged_*` columns to the alert/event table and a `throttle_state` table (tenant_id, severity, type, count, window_started_at) if they do not already exist; follow the file's existing migration style

## Step-by-step
1. Read `dispatcher.ts` end to end (114 lines is short — read all of it). Note exactly how `dispatchToChannel` is invoked and what determines which channels an event goes to today.
2. Read `types.ts`, `email.ts`, `telegram.ts`, `slack.ts` to learn the exact function-export shape every channel sender follows (e.g. `async function send(event: SecurityEvent, target: string): Promise<void>`).
3. Create `routing.ts` with the `SEVERITY_ROUTING` table exactly as specified (CRITICAL → telegram/email/sms/dashboard; HIGH → telegram/email/dashboard; MEDIUM → telegram/dashboard; LOW → dashboard) and a `getChannelsForSeverity(severity)` lookup.
4. Create `templates.ts` with the exact message templates from the spec (lines 79-93) for Telegram CRITICAL, Email HIGH, SMS CRITICAL — and fill in the missing MEDIUM/LOW templates by following the same structure (title, tenant, time, detail, action, ref).
5. Create `sms.ts` matching `telegram.ts`'s export shape, using Twilio (or, if spec 03-multi-channel's `sms-adapter.ts` already exists, import and call its `sendMessage` rather than instantiating a second Twilio client — check `find . -path "*gateway/channels/adapters/sms-adapter.ts"` first).
6. Create `discord.ts` the same way, matching `slack.ts`'s shape (or reusing `discord-adapter.ts` if it exists).
7. Create `throttle.ts`: `shouldSuppress(tenantId, severity, type): Promise<{ suppress: boolean; aggregatedCount?: number }>` implementing the spec's rule (max 1 per severity per tenant per 5 minutes; duplicates increment a counter and produce a single aggregated notification; 10 suppressions in an hour escalate severity).
8. Create `escalation.ts`: schedules a check 5 minutes after a CRITICAL alert is sent; if `acknowledged` is still false, resends with an `"UNACKNOWLEDGED — ESCALATING"` prefix; checks again at 15 minutes and, if still unacknowledged, sends to the emergency SMS contact and temporarily raises shield sensitivity (call into `prompt-guard.ts`'s config — read how `PromptGuardConfig` is mutated elsewhere first, e.g. by `moving-target.ts` if that spec landed, and follow the same pattern).
9. Modify `dispatcher.ts`: before calling `dispatchToChannel` for each routed channel, call `throttle.shouldSuppress`; if suppressed, aggregate instead of sending; for CRITICAL alerts, register the escalation timer via `escalation.ts`.
10. Add the migration changes to `migrations.ts`.

## Expected behavior
- A CRITICAL alert (e.g. kill switch triggered) is sent to Telegram, email, SMS, and the dashboard within 30 seconds
- Sending 5 identical injection-blocked alerts for the same tenant within 1 minute produces exactly ONE notification reading `"5 injection attacks blocked for tenant-07 in last 5 minutes"`
- An unacknowledged CRITICAL alert is resent with an `"UNACKNOWLEDGED — ESCALATING"` prefix after 5 minutes, and triggers an SMS to the emergency contact after 15 minutes
- A tenant configured for email-only alerts receives ONLY email when an alert fires (per-tenant channel preferences are respected)

## Test
- `routing.test.ts`: each severity maps to exactly the documented channel set
- `throttle.test.ts`: first alert passes through; identical alerts within 5 minutes are suppressed and aggregated; the 11th suppression in an hour triggers escalation (use Vitest fake timers, do not sleep in tests)
- `escalation.test.ts`: unacknowledged CRITICAL alert schedules a 5-minute and 15-minute recheck (fake timers); acknowledging it cancels the schedule
- `sms.test.ts` / `discord.test.ts`: message formatting matches the templates; sending failures are caught and logged, not thrown
- Run `pnpm test -- alerts` and confirm all pass

## Dependencies
- Read `dispatcher.ts`, `types.ts`, and the three existing channel senders FIRST (Steps 1-2) — the new code must slot into the existing routing call site, not run alongside it as a second system
- If spec 01-carina-core-gaps/03-multi-channel.md has landed, reuse its Discord/SMS adapters for actual message delivery; otherwise write minimal self-contained senders and flag for later consolidation
- Twilio and Discord webhook/bot credentials supplied via env vars by the user — never hardcoded
