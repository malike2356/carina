# Action: Domain Knowledge Layer + Tool Caching (Build); Event Alerting + Marketplace (Scope Down Hard) (Standalone Carina)

## Goal
This spec bundles four distinct features of wildly different feasibility. Build the two that are genuinely valuable and buildable now (a queryable domain-knowledge lookup tool, and tool-result caching with sensible TTLs). Scope the third (event-driven alerting) down to what Carina's actual data sources support. Decline the fourth (a public tool marketplace with ratings, publishing workflows, and a registry API) as infrastructure far beyond what a property-AI SaaS product needs to ship - and explain why, the same way `06-domain-pack-system.md` declined PHP-style hot-reload/marketplace machinery.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest. Storage: PostgreSQL 16 + pgvector, Redis 7 (`ioredis`, confirmed pub/sub usage in `src/api/subscribe.ts`/`src/security/kill-switch-listener.ts`).
- This spec is four mini-specs glued together; treat each on its own merits rather than as one unit:

### 1. Domain Knowledge Injection - BUILD (genuinely valuable, modest scope)
- The spec's instinct is sound: "queryable data layer the agent accesses directly" beats "knowledge crammed into a prompt that degrades with context." Carina already has the substrate for this - `searchRag`/`insertRagChunk` (`src/memory/store.ts`) and the `property-uk` pack's static reference data (`brain/`, per the directory map in `Carina-ai/CLAUDE.md`: "Property knowledge corpus"). Read `src/skills/packs/property-uk/tools/land-registry.ts` and `property-data.ts` (already-built stub-pattern tools the summary identified) - these are exactly the kind of "structured domain data behind a tool interface" the spec asks for, just not generalised into a single `domain_lookup`-style entry point yet.
- Reframe the spec's "SQLite + JSON index + live API feeds" architecture onto what exists: structured reference data as versioned JSON/data files shipped with the `property-uk` pack (mirror `data/uk-property-law.json`-style static files the spec itself describes - these need no database, just files + a lookup function), live data via the existing RAG/tool pattern, NOT a new SQLite database (Carina has no SQLite anywhere - same finding as `08-memory-session.md`).
- The "by postcode" indexing the spec wants (`hmo_minimum_room_size` for `PO1`) is a real, scoped, buildable feature for the `property-uk` pack specifically - this is exactly the kind of domain-specific data the pack system exists to carry.

### 2. Tool Result Caching - BUILD (genuine gap, clean fit)
- Confirmed real gap: `grep -rln 'cache\|Cache\|TTL' src/tools/*.ts` returns nothing - no caching exists anywhere in the tool layer.
- Redis is already present and already used for session/control-plane state (`redis.ts`, `kill-switch-listener.ts`) - it is the obvious, idiomatic cache layer; no new infrastructure needed.
- The spec's TTL table is sensible and directly portable (web search 1h, property/compliance lookups 24h-or-until-change, market data per-source, AI classifications 1h) - keep it, possibly trim categories that don't exist in standalone Carina (no "Rightmove every 30min" feed exists - generalise to "market-data tools, configurable per tool").

### 3. Event-Driven Alerting - SCOPE DOWN HARD (most events need integrations that don't exist)
- Run the spec's 7-event table through the same filter `02-heartbeat.md` applied: of "rent overdue / HMO licence expiring / new Rightmove listing / urgent email / compliance doc expired / maintenance emergency / portfolio value change," **only "urgent email" maps onto something Carina can actually observe today** (`inbound_emails` table + `email-webhook.ts`). The rest assume a property-management database (rent ledgers, licence-expiry tracking, maintenance-ticket severity, portfolio valuations) and external feeds (Rightmove matching) that simply do not exist in standalone Carina - building "alert when rent is 3 days overdue" requires first building the rent-tracking system that would generate that event, which is an entirely different, much larger product (this sounds like Propreneur's domain, not Carina's - see `[[project_propreneur_v2]]`-style memory context: rent/tenancy tracking belongs to the property-management-MIS side of the VERLOX product family, not the AI-agent side).
- Build the event-bus PLUMBING generically (it's good infrastructure regardless of how many real event sources feed it today), wire up the ONE real source (urgent email), and document the rest as "the event types exist in the design; the data sources that would trigger them don't exist in this product yet, and building them is a different, much larger project."
- Use Redis pub/sub for the event bus (already present, already used for not-dissimilar purposes in `kill-switch-listener.ts`/`subscribe.ts`) - not Postgres `NOTIFY` (would be a second pub/sub mechanism for no real benefit) and not a new file-based queue (the spec offers it as a fallback "for simplicity," but Redis is already simpler than that here, since it's already running).

### 4. Tool Marketplace - DECLINE (large speculative infrastructure, no audience)
- This describes: a public registry with automated testing and community ratings, a private enterprise registry with approval workflows, one-click install with dependency resolution and rollback, and a full publishing CLI workflow (`carina tool validate`/`carina tool publish`). This is "build a small app store," for a product that currently ships ONE skill pack (`property-uk`) to its own customers.
- `06-domain-pack-system.md` already answered the closest real version of this question - "how do operators get new packs?" - with the honest answer: "it's a directory in a TypeScript monorepo; sharing means submitting a PR (for now)." That answer scales fine for a product with a handful of packs and no third-party developer ecosystem yet. A marketplace is the kind of thing to build once there's an ecosystem that needs one - building the registry-and-ratings infrastructure speculatively, before anyone is publishing anything, is the textbook definition of premature infrastructure.
- Decline this section in full. If/when Carina has external pack developers asking "how do I share this," that's the trigger to revisit - not a porting exercise today.

## Files to create
- `src/tools/domain-lookup.ts` - generic `domain_lookup(key, context)` tool that packs can register data sources against
- `src/skills/packs/property-uk/data/` - static JSON reference files (HMO room sizes by postcode area, etc - whatever data the pack maintainers actually have or can source)
- `src/tools/domain-lookup.test.ts`
- `src/tools/cache.ts` - `withCache(toolName, params, ttlSeconds, fn)` wrapper + Redis-backed get/set/invalidate
- `src/tools/cache.test.ts`
- `src/events/event-bus.ts` - Redis pub/sub wrapper: `publishEvent(type, payload)`, `subscribeToEvents(types[], handler)`
- `src/events/email-urgency-watcher.ts` - the ONE real event source: watches `inbound_emails` for urgent-marked messages, publishes an `email.urgent` event
- `src/events/event-bus.test.ts`

## Files to modify
- `src/tools/index.ts` - register `domain-lookup` tool; wrap cacheable tools (`web-search`, property-data lookups, AI-classification calls) with `withCache` at registration time
- `src/skills/packs/property-uk/pack.json` - note the new `data/` directory if the manifest tracks data files (check `06-domain-pack-system.md`'s manifest shape)

## Step-by-step

1. **Domain knowledge**: design `domain_lookup(key: string, context: Record<string, unknown>)` as a thin dispatcher - packs register `(keyPattern, lookupFn)` pairs (mirror how `tools/index.ts` conditionally registers pack-specific tools), the generic tool resolves `key` to the right pack's data and returns structured results. Seed it with whatever real UK HMO/property regulation data the `property-uk` pack maintainers actually have - **do not fabricate regulatory figures** (the spec's example, "Portsmouth minimum room size 6.51 sqm," must be sourced from a real reference, e.g. actual council HMO licensing pages, not invented to make the demo look complete - a wrong compliance figure in a property-compliance tool is a genuine harm, not a cosmetic bug).

2. **Caching**: implement `withCache` as a generic wrapper any tool's `execute` can be composed with: `cache key = toolName + stableHash(params)`, Redis `GET`/`SETEX`, configurable TTL per tool (a small config map, mirroring the spec's table - trim to categories that exist). Add a manual-flush path (a `/clear-cache` gateway command or similar - check `gateway/commands.ts` for the established pattern). Log hits/misses (Scout already has the audit pipeline `06-scout-integration.md` verified - route cache events through the same `reportToolCall`-style mechanism if that makes sense, or keep it local; don't build a second logging system).

3. **Event bus**: implement `publishEvent`/`subscribeToEvents` over Redis pub/sub (`ioredis`'s `publish`/`subscribe` - check `kill-switch-listener.ts` for the established subscriber-connection pattern, since `ioredis` requires a dedicated connection for subscriptions). Keep the event-type vocabulary from the spec (so future real sources slot in cleanly) but implement and wire up only `email.urgent`. Route it to alert delivery via whatever channel the user has configured (Telegram, per the existing gateway) - this is genuinely similar to, and should probably compose with, `02-heartbeat.md`'s "urgent email" check; **coordinate with that prompt rather than building two paths to the same outcome** (the heartbeat's poll-based check and this event-driven push could plausibly be the SAME underlying watcher with two delivery triggers - investigate before building both as separate systems).

4. **Marketplace**: write nothing. Document the decline in your completion summary with the one-line reason ("no ecosystem to serve yet; `06-domain-pack-system.md` already gives operators a working share-via-PR path that scales to the product's actual current size").

5. Write all four test files (Vitest):
   - `domain-lookup.test.ts`: correct dispatch to the right pack's data, graceful "no data for this key" responses, no fabricated fallback values
   - `cache.test.ts`: hit/miss behaviour, TTL expiry, manual flush, cache key collisions don't occur across different tools/params
   - `event-bus.test.ts`: publish/subscribe round-trips, multiple subscribers receive the same event, a failing handler doesn't break the bus for other subscribers

## Expected behavior
- `domain_lookup("hmo_minimum_room_size", { postcode: "PO1" })` returns real, sourced figures - or a clear "no data for this area" response, never an invented number.
- A repeated identical web search within the cache window returns instantly from Redis, logged as a cache hit; Scout's stats reflect the hit/miss ratio.
- An urgent email triggers a real, immediate alert through Carina's existing delivery channels - the one event type that's actually wired to a real data source works end to end.
- No marketplace UI, registry API, publishing CLI, or rating system exists anywhere in the diff - and the reason is documented plainly enough that nobody wonders if it was forgotten.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/tools/domain-lookup.test.ts src/tools/cache.test.ts src/events/
pnpm test
pnpm build
```
Manual check:
```
In a Carina session: "What's the minimum room size for an HMO in Portsmouth?" -> confirm a real, sourced figure
Run the same web-search query twice in quick succession -> confirm the second is visibly faster (cache hit)
```

## Dependencies
- `06-domain-pack-system.md` (the `domain_lookup` tool composes with whatever generic pack-data mechanism that prompt builds - sequence-check before assuming a parallel data-loading path)
- `02-heartbeat.md` (coordinate the urgent-email watcher - one underlying mechanism, not two competing ones)
- Real, sourced UK HMO/property regulation reference data (a content/research task, not a code task - flag if the pack maintainers don't have this on hand yet)
- `ioredis` (already present)
