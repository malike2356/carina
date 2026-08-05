# 02: Phase B: daily cadence and render queue

**Status: COMPLETED 2026-08-04**

**What was built:**
- Background render worker `src/content/media-pipeline/render-queue.ts`
- Cadence scheduler `src/workflows/templates/property-channel/cadence-scheduler.ts`
- Stock/B-roll visuals + retention + enqueue-only media pipeline
- Videos/queue API + Cloud UI queue status
- Docs Phase B section in property-channel-youtube-setup.md

**Depends on:** Phase A complete (`01-phase-a-first-publishable-mp4.md` acceptance green on Contabo)
**Unlocks:** Phase C (`03-...`)
**Effort guide:** 1-2 weeks after Phase A
**Goal:** Sustain ~1 publishable video per day without blocking the API, with stock/B-roll visuals and quota-aware scheduling.

---

## Prompt (execute this block)

You are implementing Phase B of Property Channel media completion for Carina / Aiva.

Read first:
- `00-overview-and-guardrails.md`
- Completed Phase A code and docs
- `src/workflows/templates/property-channel/steps/media-pipeline.ts`
- Existing Carina job/queue patterns (Redis / worker activity / automation run queue; reuse rather than invent a second system if one fits)
- YouTube quota helpers in `src/connectors/youtube/quota.ts`

### Problem

Phase A proves MP4 + upload. Inline `runRenderJob` cannot scale to daily production (5-15 minutes per video). Visuals are still too thin for a credible channel.

### Requirements

#### 1. Background render queue

- Move heavy work out of HTTP `advance` path.
- `advance` / media-pipeline step should enqueue jobs (or ensure jobs are queued) and return quickly with status.
- Worker process (same `carina-web` sidecar, dedicated worker container, or existing queue consumer) runs `runRenderJob`.
- Persist job state transitions: `queued` → `rendering` → `ready` | `failed`.
- Idempotent: never double-render the same workspace/channel/dayIndex when ready.
- Concurrency limit (config): default 1 render at a time per host to protect CPU.
- Failure retries: bounded (e.g. 2) with error stored on the job.

Document how to run the worker in Docker Compose / Contabo.

#### 2. Daily cadence controls

- Config: max videos rendered per day per channel, max uploads per day (align with quota).
- Scheduler tick (cron or existing automation): advance Property Channel runs that are `running`.
- Prefer render tomorrow's video ahead of publish time so upload can schedule with `publishAt`.
- Surface next-render / next-upload times in API responses used by the Cloud UI (extend existing endpoints if needed).

#### 3. Visuals upgrade (still faceless)

Replace minimal still-only path with:
- Licensed-or-free stock image/video sources **or** workspace Drive folder of property assets (prefer one path and document it).
- Segmented timeline: hook / body / cta with different stills or short clips.
- Captions remain burned-in or soft-sub (burned-in is fine).
- Fallback to Phase A stills if stock fetch fails (must still produce MP4).

Do not require paid stock accounts in CI; mock the provider.

#### 4. Storage and cleanup

- Store MP4s under property-channel media store with clear retention policy (e.g. keep N days after successful YouTube upload, or until explicit purge).
- Avoid filling the Contabo disk; log size estimates.

#### 5. Cloud UI (minimal)

- Videos page: show `queued` / `rendering` / `ready` / `uploaded` clearly.
- Settings or overview: show queue depth and last render error.
- Copy: remove "stub" language; say "Rendering usually takes several minutes."

#### 6. Observability

- Structured logs per jobId / channelId / dayIndex.
- Ops-friendly metric or log line: renders succeeded/failed last 24h (can be log-based initially).

### Acceptance tests

Automated:
- Enqueue + worker processes a fixture job to `ready` with mp4 (ffmpeg required in test env or integration tag).
- Idempotent re-enqueue does not duplicate ready jobs.
- Quota helper still defers uploads when remaining units < 1600.

Manual:
1. Start a channel with a short calendar (or config max batch small).
2. Leave the worker running; confirm jobs drain without calling Advance for each render.
3. Over 2-3 simulated days (or clock injection), confirm scheduled YouTube entries appear without corrupting files.
4. Kill worker mid-render; restart; job recovers or fails cleanly without zombie `rendering` forever (timeout policy).

### Deliverables

- Queue worker + Docker/compose wiring.
- Visuals provider with fallback.
- Docs section "Media rendering (Phase B)" in property-channel-youtube-setup.md.
- Update prompt set README checkbox for 02.

### Non-goals for Phase B

- LLM script rewrite (Phase C).
- Multi-region render farm.
- Customer-facing SLA dashboards beyond basic status.
