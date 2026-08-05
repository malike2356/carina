# 04: Product honesty beta gate (can ship before Phase A)

**Status: COMPLETED 2026-08-02**

**What was built:**
- Cloud Beta copy: `aiva-nav.ts`, `workspace-features.ts`, property-channel `layout.tsx` / overview checklist / videos MP4 hint
- Backend MP4 gate: `src/content/media-pipeline/mp4-gate.ts` + `youtube-upload.ts` refuses non-MP4 (no script/JSON upload)
- Vitest: `mp4-gate.test.ts`

**Depends on:** none (recommended immediately)
**Effort guide:** half day
**Goal:** Stop marketing Property Channel as if daily YouTube publish already works, until Phase A acceptance is green.

---

## Prompt (execute this block)

You are applying a product honesty gate for Aiva Property Channel in Carina Cloud + any user-facing copy.

Read first:
- `00-overview-and-guardrails.md`
- `03-frontends/client-apps/app.carinaai.uk/src/lib/aiva-nav.ts` (Property Channel description)
- `03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/aiva/property-channel/**`
- `02-backends/core.carinaai.uk/src/workflows/templates/property-channel/steps/youtube-upload.ts`

### Problem

Nav and empty states say Aiva "writes, renders, and publishes" daily. Media stubs cannot deliver that. Users will try Connect YouTube and hit failures or corrupt uploads.

### Requirements

1. **Copy**
   - Nav description and page intros: mark as Beta / Preview.
   - Accurate line: scripts and scheduling pipeline exist; full video render is in progress; publishing requires a completed MP4 render.
   - No emojis; no em/en dashes (repo writing style).

2. **Upload hard gate (backend)**
   - If Phase A not merged yet: `runYouTubeUpload` must no-op with a clear structured error when artifact is not a valid MP4 (do not upload script text / JSON).
   - Surface that error to the Cloud overview / videos UI.

3. **Optional feature flag**
   - If `property_channel` should be hidden for most workspaces until Phase A: wire via existing workspace features / depth-features pattern. Prefer soft Beta visible to founder workspaces over silent hide, unless product owner prefers hide.

4. **Setup checklist UI**
   - On overview, show checklist: YouTube connected → calendar generated → at least one MP4 ready → uploads enabled.
   - Disable or explain "Advance" upload expectations when no MP4 exists.

### Acceptance tests

- Grep user-facing strings: no claim of reliable daily publish without Beta qualifier.
- Unit or integration: youtube-upload refuses non-mp4.
- Manual: open `/aiva/property-channel` and confirm Beta messaging.

### Deliverables

- Cloud copy + backend upload gate.
- Update prompt set README checkbox for 04.
- Can merge independently of Phase A; keep gate until A is accepted, then relax copy carefully.

### Non-goals

- Implementing ffmpeg/TTS (that is prompt 01).
- Removing the feature entirely.
