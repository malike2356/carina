# Action: Complete Egress Filtering & DLP (Pattern Library, Redaction, Per-Tenant Modes)

## Goal
Bring the EXISTING egress-filter implementation up to the spec's full pattern library (API keys, PII, internal infrastructure), the three detection modes (block/redact/log), per-tenant `EgressConfig`, and the documented redaction format and audit trail.

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/04-scout-audit-deploy/02-egress-filtering.md`
- **This already exists in TWO copies; gap-closure plus a duplicate-reconciliation task, the same pattern as `prompt-guard.ts`/`tool-policy.ts`.** Read these first:
  - `console.labyrinthscout.com/src/security/egress-filter.ts` (191 lines)
  - `core.carinaai.uk/src/security/egress-filter.ts` (191 lines; IDENTICAL line count to the Scout copy; this is the THIRD security module found duplicated at identical size between core and scout, after `prompt-guard.ts` and `tool-policy.ts`)
  - `console.labyrinthscout.com/src/api/egress-control.ts` (175 lines); the admin API surface; compare against the spec's verification curls and the `EgressConfig` shape (lines 69-86)
- The gap is most likely in:
  1. Pattern library completeness; does the existing filter cover ALL the spec's patterns (API keys: OpenAI/Anthropic/AWS/GitHub/generic/JWT; PII: email/UK phone/NI number/postcode/credit card/IP; internal: internal IPs/hosts/connection strings)? Confirm with `grep -n "sk-\|AKIA\|ghp_\|eyJ\|NI.*number\|postcode\|10\\\\.\\\\d\|192\\\\.168" egress-filter.ts`
  2. Whether patterns live inline or in an externalized `sensitive-patterns.json` (the spec wants the latter, for easy tenant customization without redeploys); `grep -n "sensitive-patterns\|patterns.json" egress-filter.ts egress-control.ts`
  3. The three-mode system (block/redact/log) and per-pattern-type default modes; `grep -n "'block'\|'redact'\|'log'\|mode:" egress-filter.ts`
  4. Per-tenant `EgressConfig` with `custom_patterns`/`whitelist`; `grep -n "EgressConfig\|custom_patterns\|whitelist" egress-filter.ts egress-control.ts`
- Conventions: TypeScript strict, no emojis/em-dashes, externalize patterns to JSON for tenant-customizability, every new/changed module gets/keeps a `*.test.ts`.

## Files to create (only for confirmed-missing pieces; the existing 191-line filter likely covers the pipeline shell)
```
console.labyrinthscout.com/src/egress/
  sensitive-patterns.json; Externalized pattern library exactly per spec lines 21-48 (ONLY if patterns are currently inline and not tenant-customizable)
  pattern-detector.ts; ONLY if the existing filter does inline regex matching that cannot trivially be pointed at the externalized JSON
  redactor.ts; ONLY if redaction logic does not already exist as a separable unit
  __tests__/
    sensitive-patterns.test.ts
    redactor.test.ts
```
Prefer extending `egress-filter.ts` in place over creating a parallel pipeline; its 191 lines suggest the scanning shell already exists; the likely gaps are pattern coverage and mode granularity, not architecture.

## Files to modify
- `console.labyrinthscout.com/src/security/egress-filter.ts`; add any missing patterns from the spec's three categories (lines 21-48); externalize the pattern list to `sensitive-patterns.json` if currently inline, so per-tenant `custom_patterns` can be merged in without code changes; ensure each pattern carries its documented default mode (`api_keys: 'block'`, `email: 'redact'`, `internal_ip: 'redact'`, etc.; spec lines 74-81)
- `console.labyrinthscout.com/src/api/egress-control.ts`; confirm/complete the per-tenant `EgressConfig` CRUD (enabled, mode overrides, custom_patterns, whitelist) and that the admin routes match the spec's verification block
- `core.carinaai.uk/src/security/egress-filter.ts`; apply the SAME pattern-library and mode changes here ONLY after Step 1's diff determines whether this is a genuine fork (the local single-tenant agent likely has no concept of per-tenant `EgressConfig`; it may need a simplified, config-free version) or a stale duplicate that should re-export from the Scout copy; document the decision
- `console.labyrinthscout.com/src/migrations.ts`; add an `egress_config` table (tenant_id, enabled, mode_overrides JSONB, custom_patterns JSONB, whitelist JSONB) if per-tenant config is not already persisted somewhere

## Step-by-step
1. Run `diff console.labyrinthscout.com/src/security/egress-filter.ts core.carinaai.uk/src/security/egress-filter.ts`. Both are 191 lines. If identical, the Scout copy (multi-tenant, has `EgressConfig`/admin API around it) is the natural canonical version; decide whether the core copy should re-export it or remain an intentionally-simpler single-tenant variant (it cannot have per-tenant config since the local agent has one user); read both fully, then document your decision in a comment at the top of whichever file you leave as the "thinner" one.
2. Read the canonical `egress-filter.ts` in full. Build a checklist: for each of the ~17 named patterns across the spec's three categories (lines 21-48), does a matching regex exist with a comparable name/tag? List exactly which are present and which are missing.
3. Read `egress-control.ts` (175 lines) in full. Map its routes/shapes against the spec's `EgressConfig` interface (lines 69-86) and the verification curls (lines 102-124). Note any gap in `mode` granularity (per-pattern-type override), `custom_patterns`, or `whitelist`.
4. If patterns are inline, externalize them: create `sensitive-patterns.json` with each pattern's `id`, `category`, `regex` (as a string), `default_mode`, and a human label (e.g. `"EMAIL_REDACTED"` for the redaction placeholder token used in the format `[EMAIL_REDACTED]`). Update `egress-filter.ts` to load from this file and merge in any `custom_patterns` from the tenant's `EgressConfig`.
5. Add any genuinely-missing patterns identified in Step 2 to the JSON (or inline list, if you decided not to externalize); match the EXACT regexes given in spec lines 23-47 character for character; these are security-critical and must not be approximated.
6. Implement/verify the three-mode dispatch: `block` → reject the message with `"Message blocked by DLP: sensitive data detected ({pattern_type})."`; `redact` → replace matched spans with `[{TYPE}_REDACTED]` per the exact format in spec lines 89-92; `log` → record without altering the message. Confirm the existing filter's return shape can carry "blocked" vs "redacted" vs "passed-through-logged" distinctly to its caller.
7. Confirm/complete per-tenant `EgressConfig`: `enabled`, per-pattern `mode` overrides, `custom_patterns` (tenant-supplied regex strings; validate they compile before storing, to avoid ReDoS and runtime crashes), `whitelist` (exact-match or pattern strings that suppress a detection entirely, e.g. a tenant's own support email).
8. Wire egress scanning into EVERY outbound channel the spec lists (chat responses across web/Telegram/Discord/Slack/SMS, tool results shown to the user, file deliveries, email notifications, push notifications); `grep -rn "egressFilter\|egress-filter" console.labyrinthscout.com/src core.carinaai.uk/src` to find current call sites and confirm coverage; add calls at any missing egress point, following the existing call pattern exactly (do not introduce a second invocation style).
9. Confirm `egress-audit.ts`-equivalent logging exists (or add it) writing `event_type: "egress"` records into the audit log from spec 04-01 (`detail: { pattern_type, action_taken, channel }`).

## Expected behavior
- `"my key is sk-abc123def456ghi789jkl012mno345pqr678stu"` is BLOCKED with `"Message blocked by DLP: sensitive data detected (api_key)."`
- `"contact me at laud@example.com"` becomes `"contact me at [EMAIL_REDACTED]"`
- `"server is at 10.0.0.15"` is redacted or blocked per the tenant's configured mode for `internal_ip`
- Whitelisting `laud@example.com` for a tenant means that exact address passes through unredacted in future messages from that tenant
- `GET /api/admin/scout/audit/search?event_type=egress` shows every egress decision with pattern type and action taken

## Test
- `sensitive-patterns.test.ts` (or extend the existing `egress-filter.test.ts`): each of the ~17 documented patterns matches its example input and does not false-positive on adjacent benign text
- `redactor.test.ts`: redaction output matches the exact `[TYPE_REDACTED]` format; multiple distinct matches in one message each get redacted independently
- Mode-dispatch tests: block/redact/log produce the documented user-facing strings and audit entries
- Whitelist tests: a whitelisted exact value is never flagged, even though its pattern would otherwise match
- Run `pnpm test -- egress` and confirm all pass

## Dependencies
- Step 1 (diff core vs scout copies) must happen first and follows the same reconciliation approach used in spec 02-01-injection-shield and 03-03-allowlisting-ratelimiting; be consistent across all three duplicate-resolution decisions in this codebase
- `audit-logger.ts` from spec 04-01 for `event_type: "egress"` recording; reuse, do not write a second audit path
- Multi-channel reuse: scanning chat responses to Discord/Slack/SMS depends on those channels existing (spec 01-03-multi-channel); if they have not landed yet, wire egress scanning into the existing channels (web, Telegram, WhatsApp) now and leave a clear call-site pattern for the new channels to slot into later
