# 03: Phase C: quality (LLM scripts, voice, polish)

**Status: COMPLETED 2026-08-04**

**What was built:**
- LLM/template script modes `src/content/script-generator/llm-scripts.ts`
- Niche research theme map + live/heuristic modes
- Loudnorm + UK TTS voice config, stronger thumbnails
- Upload status uploaded + weekly reports endpoint
- Docs Phase C section

**Depends on:** Phase B complete (`02-phase-b-daily-cadence-and-queue.md`)
**Effort guide:** 2-4 weeks after Phase B
**Goal:** Raise content quality to a sellable faceless UK property channel: better scripts, voice, thumbnails, and light growth loops already scaffolded (comments / weekly report).

---

## Prompt (execute this block)

You are implementing Phase C of Property Channel media completion for Carina / Aiva.

Read first:
- `00-overview-and-guardrails.md`
- Phase A/B implementations
- `src/content/script-generator/**`
- `src/workflows/templates/property-channel/steps/niche-research.ts`
- `src/workflows/templates/property-channel/steps/comment-monitor.ts`
- `src/workflows/templates/property-channel/steps/analytics-report.ts`
- Archived intent: `02-archived_prompts/archives_from_pending_prompts/aiva-workspace/carina-aiva-youtube-property-channel-automation.md` (sections on scripts, leads, analytics)

### Problem

Even with real MP4s, template scripts and generic visuals will underperform. Niche research and keyword helpers are shallow. Comment/analytics steps may be thin relative to the product promise.

### Requirements

#### 1. LLM script generation (with guardrails)

- Replace or augment `buildScriptStructure` / calendar generation with model calls via existing Carina LLM routing (respect workspace model settings / cost controls).
- Each video: hook, body, CTA; UK property terminology; 3-5 minutes spoken length.
- Enforce uniqueness across the calendar (no near-duplicate titles/scripts); keep dayIndex uniqueness checks.
- Store model + prompt version on calendar items for audit.
- Offline/test mode: deterministic fixture scripts when `PROPERTY_CHANNEL_SCRIPT_MODE=template` or similar.
- Cost: batch generation with rate limits; do not regenerate full 365 on every advance (idempotent calendar).

#### 2. Niche research upgrade

- When APIs/keys allow, pull lightweight trend signals (YouTube search or documented public data). If unavailable, improve structured heuristics and label output as `heuristic` vs `live`.
- Produce a real 12-month theme map consumed by script generation.
- Never invent competitor metrics as facts without a source tag.

#### 3. Voice quality

- Prefer higher-quality UK TTS voice (configure via env; document voices).
- Optional: workspace voice profile later; stub the setting in UI only if backend can no-op safely.
- Normalize loudness (ffmpeg loudnorm) before mux.

#### 4. Thumbnails

- Generate stronger thumbnails (image model or composited property still + large hook text + brand color).
- Enforce YouTube constraints (1280x720, <2MB, jpeg/png).
- Consistent channel template (logo space optional).

#### 5. Metadata SEO

- Titles under 100 chars with primary keyword.
- Descriptions 200-500 words with timestamps placeholders matching sections.
- 10-20 tags; avoid keyword stuffing bans.

#### 6. Comment leads and weekly report (bring to "useful")

- Ensure comment monitor classifies and stores leads with clear statuses.
- Weekly analytics report writes something the user can open in Cloud (and/or email if infra exists; do not invent Postmark wiring if absent: in-app report is enough).
- Document gaps explicitly if CRM routing is incomplete.

#### 7. Product packaging

- Feature can be marketed as working daily publish **only if** Phase A+B+C acceptance pass.
- Pricing/feature flag: confirm `property_channel` gate and any plan tier rules in Cloud.
- Help copy / Guide me: accurate setup steps; no oversell.

### Acceptance tests

Automated:
- Script generator in template mode is deterministic.
- Script generator in LLM mode mocked: validates schema (sections, duration estimate, unique titles).
- Thumbnail output bytes are jpeg/png and under size cap.
- Comment classifier unit tests for hot/warm/spam fixtures.

Manual:
1. Generate 7 days of content for one niche/location.
2. Spot-check scripts for UK property sense and uniqueness.
3. Watch 2 rendered videos end-to-end; captions readable; audio clear.
4. Confirm one weekly report artifact after forcing analytics step.
5. Confirm a test comment classification path (fixture or real comment on private video).

### Deliverables

- LLM + template script modes.
- Improved research/metadata/thumb/voice.
- Docs "Media rendering (Phase C)" + operator checklist.
- Update prompt set README; archive the whole folder when programme complete.

### Non-goals for Phase C

- Full multi-channel network manager.
- On-camera AI avatars.
- Guaranteed YouTube growth (algorithm not controllable).
