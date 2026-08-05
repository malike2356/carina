# 01: Phase A: first publishable MP4

**Status: COMPLETED 2026-08-02**

**What was built:**
- TTS voiceover (`voiceover.ts` via `utils/tts.ts`), visuals captions/still, PNG thumbnail, ffmpeg compositor → `assets.videoPath` MP4
- `video-builder.ts` / `media-pipeline.ts` batch size default 1; Docker `fonts-dejavu-core` for drawtext
- Docs: `docs/features/property-channel-youtube-setup.md` Phase A section; `.env.example` knobs
- Deployed Contabo `carina-web` + Cloud; Vitest media-pipeline green. Manual YouTube Studio smoke still operator-owned.

**Depends on:** `00-overview-and-guardrails.md`
**Unlocks:** Phase B (`02-...`)
**Effort guide:** 1-2 weeks focused engineering
**Goal:** Produce one real faceless property video (3-5 min, 1080p MP4) and successfully schedule it on YouTube as private + `publishAt`. Refuse uploads that are not valid MP4.

---

## Prompt (execute this block)

You are implementing Phase A of Property Channel media completion for Carina / Aiva.

Read first:
- `01-devends/prompts-library/01-pending_prompts/property-channel-media-pipeline/00-overview-and-guardrails.md`
- `02-backends/core.carinaai.uk/src/content/media-pipeline/*.ts`
- `02-backends/core.carinaai.uk/src/workflows/templates/property-channel/steps/youtube-upload.ts`
- `02-backends/core.carinaai.uk/src/utils/tts.ts`
- `02-backends/core.carinaai.uk/docs/features/property-channel-youtube-setup.md`

### Problem

Media pipeline stubs write JSON/SVG artifacts. YouTube upload reads those bytes (or script text) and labels them `video/mp4`. That cannot ship.

### Requirements

#### 1. VoiceoverEngine: real audio

Replace the default stub in `voiceover.ts` (keep interface) so `synthesize` writes a real audio file (mp3 or wav) under the property-channel media store.

- Prefer reusing `src/utils/tts.ts` (Edge TTS with OpenAI fallback).
- Default voice: UK English suitable for property narration (`en-GB`).
- Scrub secrets before TTS (reuse existing scrub helpers if applicable).
- Persist durationSeconds from actual audio length when possible (ffprobe), else keep estimate but store both.
- Unit-test with a mocked TTS backend; do not call paid APIs in CI.

#### 2. VisualsEngine: stills + caption plan

Keep the manifest shape, but make it actionable for ffmpeg:
- Resolve a small set of background stills (bundled stock under `packages/` or `brain/` assets, or solid gradient + property-themed overlays if no stock licensed yet).
- Emit timed caption cues from script sections (hook / body / cta).
- Document which directories are placeholders vs production assets.
- Faceless only: no face generation.

#### 3. ThumbnailEngine: YouTube-ready image

- Output PNG or JPEG 1280x720, under 2MB.
- Bold hook text overlay on a dark/property-styled background is acceptable for Phase A.
- Stop relying on SVG for `thumbnails.set` in the upload path (convert or render raster).

#### 4. Compositor: ffmpeg mux to MP4

In `compositor.ts` (or a sibling `ffmpeg-compose.ts` used by it):
- Require `ffmpeg` / `ffprobe` on PATH in the runtime used by `carina-web` (update Docker image if needed).
- Produce `assets.videoPath` ending in `.mp4` (H.264 + AAC, 1920x1080, 30fps target; shorter 720p allowed only if documented for smoke tests).
- Minimal acceptable visual: Ken Burns (or static still with slow zoom) over voiceover + burned-in captions.
- Write a small sidecar JSON ok, but the uploadable artifact must be the MP4.
- On ffmpeg failure, mark render job `failed` with a clear error; never leave status `ready` without MP4.

Update `RenderJob` / types so `videoPath` is first-class (not only `videoManifestPath`).

#### 5. Upload gating

In `youtube-upload.ts`:
- Upload only when `videoPath` exists, is `.mp4`, and optionally passes a cheap ffprobe sanity check (has video stream).
- Remove script-text-as-video fallback for production path.
- Keep quota awareness and `private` + `publishAt`.
- Thumbnail: raster only; best-effort if thumb fails after video succeeds.

#### 6. Phase A batch discipline

- Allow `runMediaPipeline` batch size of 1 for smoke (config or option).
- Inline render is allowed for Phase A only; add a code comment that Phase B must queue it.
- Do not generate 365 MP4s in one advance.

#### 7. Product honesty (minimum)

If `04-product-honesty-beta-gate.md` is not yet executed, at least:
- Change upload step / UI error to say rendering is required before publish when MP4 missing.
- Do not claim success in API responses when upload was skipped.

#### 8. Docker / deploy

- Ensure Contabo `carina-web` image includes ffmpeg (and ffprobe).
- Document env knobs (TTS provider already exists; add any Phase A flags to `.env.example` only as names, no secrets).
- Deploy core after merge; smoke on VPS.

### Acceptance tests

Automated:
- Vitest: VoiceoverEngine with mock TTS writes audio path.
- Vitest: compositor with fixture wav + still produces mp4 when ffmpeg available; skip or soft-skip in environments without ffmpeg with clear message.
- Vitest: `runYouTubeUpload` does not call upload API when videoPath missing / not mp4 (mock client).

Manual (Contabo + test Google account):
1. Property Channel setup + Connect YouTube.
2. Advance until one render job is `ready` with `.mp4` on disk.
3. Advance upload: video appears in YouTube Studio as private/scheduled.
4. Confirm it is a playable video, not a corrupt file.

### Deliverables

- Code changes under core media-pipeline + youtube-upload + Docker if needed.
- Short note in `docs/features/property-channel-youtube-setup.md` section "Media rendering (Phase A)".
- Update this prompt set README checkbox for 01.
- Do not start Phase B in the same session unless A acceptance is green.

### Non-goals for Phase A

- Stock footage APIs, LLM scripts, comment CRM polish, full background queue.
- Raising YouTube API quota.
- Perfect motion graphics.
