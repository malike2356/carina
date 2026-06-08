# Action: Complete Tool Allowlisting & Tier-Based Rate Limiting

## Goal
Bring the EXISTING `ToolPolicy`/rate-limiting code up to the spec's tier-based allowlist model (FREE/PRO/ENTERPRISE), token-bucket rate limiting with the documented per-tool/per-tenant/per-IP limits, and progressive escalating rate-limit responses.

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/03-scout-detection-killswitch/03-allowlisting-ratelimiting.md`
- **This already exists in substantial form — gap-closure, not greenfield.** Read these first:
  - `console.labyrinthscout.com/src/security/tool-policy.ts` (218 lines) — exports `ToolPolicy`, `EnforceParams`, `SecurityEvent`, error classes `ToolBlockedError`/`DangerousCommandError`/`RateLimitError`/`ConfirmationRequiredError`, `DEFAULT_POLICY` (line 76), `loadPolicyFromEnv` (line 87), `getLoadedPolicy` (line 112), class `ToolPolicyEnforcer` (line 122)
  - `console.labyrinthscout.com/src/api/rate-control.ts` (145 lines) and `src/api/policy.ts` (15 lines — very short, likely a thin route registration) — admin API surfaces
  - `core.carinaai.uk/src/security/tool-policy.ts` (218 lines, same size as the Scout copy — likely a duplicate; `diff` them as the first step, exactly as recommended in spec 02-injection-shield's prompt for `prompt-guard.ts`, since this codebase appears to maintain parallel core/scout copies of security modules)
- The gap is most likely:
  1. Tier-based allowlists (FREE/PRO/ENTERPRISE with the specific tool lists from spec lines 30-40) — confirm with `grep -n "FREE\|PRO\|ENTERPRISE\|tier" tool-policy.ts rate-control.ts`
  2. The token-bucket algorithm with the exact `capacity`/`refillRate`/`consume` shape (spec lines 99-115) — confirm with `grep -n "TokenBucket\|bucket\|refill" tool-policy.ts rate-control.ts`
  3. Progressive rate-limit escalation (1st/5th/10th/20th violation thresholds, spec lines 130-136) — confirm with `grep -n "violation\|cooldown\|progressive" tool-policy.ts rate-control.ts`
  4. The exact admin API shape: `GET/PUT /api/admin/scout/allowlist/{tenantId}`, `PUT .../allowlist/bulk` — confirm `policy.ts`'s 15 lines actually register these routes
- Conventions: TypeScript strict, no emojis/em-dashes, extend existing `*.test.ts` files (`tool-policy.test.ts` already exists per the file listing — read it before adding cases).

## Files to create (only for genuinely missing pieces — confirm via Step 1's diff and audit)
```
console.labyrinthscout.com/src/security/
  tool-tiers.ts                — FREE/PRO/ENTERPRISE allowlist definitions exactly as spec lines 30-40 (ONLY if tier-based allowlisting does not already exist in some form)
  token-bucket.ts              — TokenBucket class exactly per spec lines 101-115 (ONLY if tool-policy.ts's current rate limiting uses a different algorithm that cannot be trivially extended)
  __tests__/
    tool-tiers.test.ts
    token-bucket.test.ts
```

## Files to modify
- `console.labyrinthscout.com/src/security/tool-policy.ts` — add tier-based allowlist resolution to `ToolPolicyEnforcer.isAllowed` (or whatever its current allow-check method is called — read line 122 onward); wire in `tool-tiers.ts` if created
- `console.labyrinthscout.com/src/api/rate-control.ts` — add the progressive-escalation thresholds (1st = retry-after, 5th in 1h = 1min cooldown, 10th = 5min cooldown + LOW alert, 20th = 30min block + MEDIUM alert + Telegram) if not present; wire alerts through `alertDispatcher` (read `alerts/dispatcher.ts` first, do not build a parallel alert path)
- `console.labyrinthscout.com/src/api/policy.ts` — confirm/add the exact routes `GET/PUT /api/admin/scout/allowlist/{tenantId}` and `PUT /api/admin/scout/allowlist/bulk`; this file is only 15 lines so it is likely a stub that needs the actual route handlers
- `core.carinaai.uk/src/security/tool-policy.ts` — apply changes in parallel ONLY if Step 1's diff shows it is a genuinely independent copy serving a different runtime context (the local agent vs. the hosted Scout service); otherwise convert it to a re-export and document the decision

## Step-by-step
1. Run `diff console.labyrinthscout.com/src/security/tool-policy.ts core.carinaai.uk/src/security/tool-policy.ts`. Both are 218 lines — if identical, pick one as canonical (the Scout copy is the natural home for tenant/tier/billing concepts since it is the multi-tenant service) and make the other re-export from it, OR confirm they intentionally diverge (the core copy may enforce LOCAL policy for a single self-hosted user with no tiers) — read both fully before deciding, and document your decision in a comment.
2. Read `tool-policy.ts` lines 1-130 (interfaces, error classes, `DEFAULT_POLICY`, `loadPolicyFromEnv`) and lines 122 onward (`ToolPolicyEnforcer`). Identify the exact method that decides whether a tool call is allowed, and whether it currently consults any tier/plan concept.
3. Read `rate-control.ts` (145 lines) in full. Identify the current rate-limiting algorithm (token bucket? fixed window? sliding window?) and whether progressive escalation thresholds exist.
4. Read `policy.ts` (15 lines — quick) to see what it currently registers.
5. If tier-based allowlists are missing: create `tool-tiers.ts` with `FREE_TOOLS`, `PRO_TOOLS`, `ENTERPRISE_WILDCARD` constants exactly matching spec lines 30-40 (FREE: chat/search/read_file/get_property/get_portfolio_summary; PRO: + terminal/write_file/email_ingestion/floor_plan_analysis/property tools/CRM tools/browser_navigate; ENTERPRISE: all + custom). Add a `resolveAllowlistForTier(tier, customAllowed?, customDenied?)` function and wire it into `ToolPolicyEnforcer`'s allow-check, preserving the existing explicit-deny > explicit-allow > wildcard > default-deny precedence the spec describes (lines 44-62) — confirm this precedence order matches what the enforcer already does before changing it.
6. If the rate-limiting algorithm in `rate-control.ts` is not already a token bucket matching spec lines 101-115, either adapt it minimally (preferred — avoid a rewrite) or create `token-bucket.ts` and migrate the call sites; document which path you took and why.
7. Add progressive escalation to `rate-control.ts`: track violation counts per tenant per rolling hour; at the 5th, 10th, and 20th violation apply the documented cooldowns/blocks and fire the documented alerts via `alertDispatcher`.
8. Complete `policy.ts`'s route registrations: `GET /api/admin/scout/allowlist/{tenantId}` returns `{ allowed, denied, wildcards }`; `PUT .../allowlist/{tenantId}` updates it; `PUT .../allowlist/bulk` applies a tier-wide change.
9. Confirm the rate-limit error response matches the spec's exact JSON shape (lines 119-127): `{ error: "rate_limited", message, retry_after, limit, remaining, reset_at }` — read `RateLimitError` (line 45) and adjust its serialization if it diverges.

## Expected behavior
- A FREE-tier tenant attempting to use `terminal` gets `"Tool 'terminal' is not available on your plan. Upgrade to PRO."`
- Sending 61 chat requests in a minute: the first 60 succeed, the 61st returns HTTP 429 with `retry_after`, `limit: 60`, `remaining: 0`
- The 5th rate-limit violation in an hour produces a 1-minute cooldown; the 10th produces a 5-minute cooldown plus a LOW dashboard alert; the 20th blocks the tenant for 30 minutes plus a MEDIUM alert sent to the dashboard and Telegram
- Upgrading a tenant from FREE to PRO immediately makes `terminal` available without a restart

## Test
- Read and extend the existing `tool-policy.test.ts` (do not create a parallel test file for the same module)
- `tool-tiers.test.ts`: each tier resolves to exactly the documented tool set; precedence order (deny > allow > wildcard > default-deny) holds
- `token-bucket.test.ts` (if created): capacity, refill rate, and `consume` behave per the spec's pseudocode, using fake timers for refill timing
- `rate-control` tests: progressive escalation fires at exactly the 5th/10th/20th violation, not before — use fake timers for the 1-hour rolling window
- Run `pnpm test -- tool-policy tool-tiers token-bucket rate-control` and confirm all pass

## Dependencies
- Step 1 (the diff between core and scout copies) must happen first
- Read `alerts/dispatcher.ts` before wiring escalation alerts — reuse it, do not build a parallel path
- Confirm the existing rate-limiting algorithm before deciding whether `token-bucket.ts` is a new file or an adaptation of existing code
