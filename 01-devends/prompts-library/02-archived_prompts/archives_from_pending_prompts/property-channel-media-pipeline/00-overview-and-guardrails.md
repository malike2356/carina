# 00: Overview and guardrails (Property Channel media)

**Status: COMPLETED 2026-08-04** (reference; do not "implement" this file alone)
**Depends on:** none
**Unlocks:** 01, 02, 03, 04

## Context for the agent

Property Channel is an Aiva workflow that should produce a faceless UK property YouTube channel: research, scripts, render, schedule upload, comment leads, weekly analytics.

What already works:
- Workflow template and step graph under `src/workflows/templates/property-channel/`
- YouTube connector (OAuth, quota, resumable upload, thumbnails API)
- Cloud UI under `/aiva/property-channel/*`
- Script calendar generation (template-based)
- Engine interfaces: `VoiceoverEngine`, `VisualsEngine`, `ThumbnailEngine`, `composeVideo`, `runRenderJob`

What does not work yet (documented gaps in code comments):
- Real TTS audio files
- Real visual frames / B-roll
- ffmpeg mux to H.264+AAC MP4
- Background job queue for heavy renders
- LLM-quality scripts (templates only)
- Upload safety: must not call YouTube with non-video bytes

## Product definition of done (whole programme)

A workspace user can:
1. Connect YouTube once via platform OAuth.
2. Start a Property Channel run for a niche + UK location.
3. See render jobs progress to `ready` with a real `.mp4` on disk.
4. Have videos scheduled on YouTube (`private` + `publishAt`) and go public at the chosen daily time.
5. View content calendar and analytics without manual ffmpeg.

Faceless only: never generate presenter face video. Visuals = property stills, B-roll, text overlays, graphics.

## Technical guardrails

1. Canonical Carina only under `carina/02-backends/`, `carina/03-frontends/`, `carina/scripts/`. Never create `carina/verlox/`.
2. Writing style: no em dashes, no en dashes, no emojis in first-party copy.
3. Prefer swapping implementations behind existing interfaces in `src/content/media-pipeline/` rather than rewriting the workflow graph.
4. Reuse `src/utils/tts.ts` for Phase A voice unless a better UK voice is explicitly required later.
5. YouTube uploads: `privacyStatus` private with `publishAt` for schedule; respect quota (`videos.insert` = 1600 units).
6. Thumbnails for YouTube must be JPEG/PNG under 2MB (SVG is not enough for production `thumbnails.set`).
7. Secrets stay in `.access/` and VPS env. Never commit `.env` or paste client secrets.
8. Tests: Vitest for engines and upload gating; one Contabo smoke test with a private scheduled video.
9. Deploy: core Docker `carina-web` after media changes; ensure ffmpeg exists in the runtime image if used.

## Suggested architecture (target)

```
script calendar item
  -> VoiceoverEngine  => audio.mp3 / .wav
  -> VisualsEngine    => image sequence or clip list + caption cues
  -> ThumbnailEngine  => thumb.jpg
  -> composeVideo     => ffmpeg => video.mp4 (+ update RenderJob.assets.videoPath)
  -> youtube-upload   => only if videoPath ends with .mp4 and ffprobe ok
```

Render execution:
- Phase A may still run inline for a tiny batch (1 video) to prove the path.
- Phase B must move `runRenderJob` to a background worker.

## Out of scope for this programme

- Customer BYOK YouTube Google Cloud projects (documented separately).
- Live presenter / avatar talking-head video.
- Replacing the Property Channel UI IA.
- Raising Google YouTube quota (operator action; document only).

## When finished with any prompt

1. Run relevant Vitest.
2. Run `python3 /opt/lampp/htdocs/verlox/scripts/fix-writing-style.py` on touched first-party files if copy changed.
3. Deploy core (and cloud if UI gated).
4. Update this folder README checkboxes.
5. Archive completed prompt files under `02-archived_prompts/.../property-channel-media-pipeline/` when the whole set ships or per-phase if preferred.
