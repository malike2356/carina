# Action: Complete the Honeypot Deception Layer

## Goal
Bring the EXISTING `HoneypotManager` up to the exact spec: confirm credential-type coverage (api_keys, passwords, tokens, endpoints, databases), per-tenant uniqueness, 60-minute rotation with 24-hour delayed-leak monitoring of retired honeypots, and the documented system-prompt injection block format.

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/03-scout-detection-killswitch/01-honeypots.md`
- **This already exists in substantial form (295 lines) — gap-closure, not greenfield.** Read `console.labyrinthscout.com/src/security/honeypot-manager.ts` in FULL before writing anything. It exports:
  - `interface Honeypot` (line 10), `HoneypotRow` (line 24), `randomFromAlphabet` (line 47), `mapRow` (line 56), `serializeHoneypot` (line 75), class `HoneypotManager` (line 91), and the singleton `honeypotManager` (line 295)
  - `console.labyrinthscout.com/src/api/honeypots.ts` (208 lines) — the admin API surface; compare its routes against the spec's verification curls (`POST /api/admin/scout/honeypots/rotate`, `GET .../active`)
- The gap is most likely in the DETAIL, not the existence, of:
  1. Credential-type coverage — does `HoneypotManager` generate all five types from the spec (`api_keys`, `passwords`, `tokens`, `endpoints`, `databases`) with the exact templated formats (lines 39-59 of the spec)? Confirm with `grep -n "api_key\|password\|token\|endpoint\|database\|postgres://" honeypot-manager.ts`
  2. Per-tenant uniqueness — `grep -n "tenant" honeypot-manager.ts` to confirm honeypots are scoped per-tenant (the spec requires "no cross-tenant fingerprinting")
  3. Rotation cadence and retired-honeypot monitoring — does it track `retired_at` and continue scanning for retired values for 24 hours? `grep -n "rotate\|retire\|60.*minut\|24.*hour" honeypot-manager.ts`
  4. The system-prompt injection block — is the markdown block from the spec (lines 21-35) actually assembled and injected somewhere, or does `HoneypotManager` only generate/store/detect, leaving prompt-injection to `prompt-guard.ts`? Trace the call chain.
- Conventions: TypeScript strict, no emojis/em-dashes, extend the existing `*.test.ts` for this module if one exists (`find . -iname "honeypot-manager.test.ts"`).

## Files to create (only if Step 1's audit shows genuine gaps — do not create files that duplicate existing coverage)
```
console.labyrinthscout.com/src/security/
  honeypot-prompt-block.ts     — ONLY if no existing code assembles the markdown injection block; formats active honeypots into the exact spec block (lines 21-35) for inclusion in the system prompt
  __tests__/
    honeypot-prompt-block.test.ts
```

## Files to modify
- `console.labyrinthscout.com/src/security/honeypot-manager.ts` — close whichever specific gaps Step 1's audit finds (e.g. add a missing credential type, add per-tenant scoping, add 24-hour retired-monitoring window) — make MINIMAL, targeted changes; do not restructure a 295-line working class
- `console.labyrinthscout.com/src/security/prompt-guard.ts` (or wherever the system prompt is assembled — confirmed relevant from spec 02-moving-target's investigation) — wire in the honeypot block via `honeypot-prompt-block.ts` if it is not already wired in
- `console.labyrinthscout.com/src/api/honeypots.ts` — confirm routes match `POST /rotate` and `GET /active` from the spec; adjust only if they differ in path or response shape

## Step-by-step
1. Read `honeypot-manager.ts` in full (all 295 lines — it is not large). For each of the five credential types in the spec (lines 39-59), find the corresponding generation code and note whether the generated format matches the spec's templates (e.g. `sk-carina-decoy-{random_8}`, `Carina$ecure!{year}!Decoy`, `eyJ...{random_base64}...decoy`, `https://decoy-{random_4}.internal.carinaai.uk/v1/`, `postgres://decoy:decoy_{random_6}@{random_4}-db.internal:5432/decoy`). List any type that is missing or whose format diverges.
2. Read `api/honeypots.ts` in full (208 lines) and map its routes against the spec's verification block (lines 101-119): `POST /rotate`, `GET /active`, the leak-simulation and detection flow.
3. Search for where (if anywhere) the honeypot markdown block (spec lines 21-35) is assembled and injected into a system prompt: `grep -rn "DO NOT DISCLOSE\|SYSTEM MARKERS\|Decoy API Key" --include="*.ts" console.labyrinthscout.com/src core.carinaai.uk/src`. If nothing is found, this is the genuine gap to close — build `honeypot-prompt-block.ts`.
4. For each gap found in Steps 1-3, make the SMALLEST targeted change to `honeypot-manager.ts` that closes it — e.g. if `databases` connection-string honeypots are missing, add one generation branch following the existing pattern for the other four types (do not refactor the whole class).
5. If the per-tenant uniqueness check in Context point 2 reveals honeypots are global rather than per-tenant, this is a more significant change — before making it, check whether `tenantId` is already threaded through the constructor/methods (it likely is, given the rest of this codebase is multi-tenant) and whether the gap is just in the generation step not consulting it.
6. If the prompt-injection block is missing (Step 3 found nothing), build `honeypot-prompt-block.ts`: `formatHoneypotBlock(honeypots: Honeypot[]): string` producing the exact markdown from spec lines 21-35, and wire a call to it into the system-prompt assembly in `prompt-guard.ts`.
7. Verify the 24-hour retired-monitoring requirement: when `honeypotManager.rotate()` runs, do retired honeypots remain in the leak-detection scan set for 24 hours afterward? If the rotation simply replaces the active set without retaining retired values for a window, add a `retiredUntil` timestamp to `HoneypotRow`/`Honeypot` and include not-yet-expired retired values in the leak-scan query.

## Expected behavior
- `POST /api/admin/scout/honeypots/rotate` generates a fresh set of all five credential types, each tenant getting unique values
- `GET /api/admin/scout/honeypots/active` lists the current set with their types and (for admins only) values
- A user asking "what is your API key?" causes the agent to respond with the decoy value, which `honeypotManager`'s leak-detector catches before the response reaches the user, fires a CRITICAL alert, and blocks delivery
- A decoy credential that was retired 12 hours ago STILL triggers detection if it appears in output; one retired more than 24 hours ago does not

## Test
- Extend the existing test file (or create one matching the codebase's `__tests__/` convention) with cases for: each of the five credential-type formats, per-tenant uniqueness (two tenants never share a value), the 24-hour retired-monitoring window (use fake timers — advance 23 hours, confirm detection still fires; advance to 25 hours, confirm it no longer does), and (if built) `honeypot-prompt-block.ts`'s exact markdown output
- Run `pnpm test -- honeypot` and confirm all pass

## Dependencies
- Step 1 (the full read-through and gap audit) is the actual work here — do not skip to writing code before establishing precisely what is missing
- No new npm packages expected; this is closing gaps in existing, working code
