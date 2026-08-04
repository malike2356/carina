# YouTube Channel: setup (domain packs)

YouTube Channel is the Aiva workflow that provisions and runs a faceless
YouTube channel for a selected domain (Property, Personal finance, Fitness,
Tech explainers): research, script generation, media rendering, upload and
scheduling, comment lead capture, and weekly analytics.

**End users** only click Connect YouTube in the app (company Verlox platform
Google OAuth). They do not create Google Cloud projects.

This document is for **Verlox operators** who maintain the company platform
YouTube / Google client on project `verlox` (`420319…`). Canonical credentials
and the full redirect URI list live in `.access/.verlox-platform-google-oauth.md`
(same client as Hire Aiva Sign-in / Drive / Gmail).

## 1. Company Google Cloud project (operators only)

1. Use project ID `verlox` (not a personal Carina Aiva project, not a customer project).
2. Do not add customer Gmail addresses as Test users on this company consent screen.
3. Prefer Publish to Production on the company OAuth consent screen.

## 2. Enable the required APIs

In APIs & Services > Library on project `verlox`, enable:

- YouTube Data API v3
- YouTube Analytics API
- (Also keep Drive / Gmail / Calendar APIs enabled if this same client is the Hire Aiva platform client.)

## 3. Configure the OAuth consent screen (company)

1. APIs & Services > OAuth consent screen on project `verlox`.
2. External (or Internal only if every channel is on a Workspace you control).
3. Scopes include:
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube`
   - `https://www.googleapis.com/auth/youtube.readonly`
   - `https://www.googleapis.com/auth/yt-analytics.readonly`
4. While Testing: operator Test users only. Publish to Production for customers.

## 4. Web OAuth client redirect URIs

Use the company Web client documented in `.access/.verlox-platform-google-oauth.md`.
Authorized redirect URIs must include at least:

- `https://admin.hireaiva.co.uk/api/aiva/youtube/oauth/callback`
- `https://app.carinaai.uk/api/aiva/youtube/oauth/callback`

plus the other Hire Aiva callbacks listed in that access file (sign-in, Drive, Gmail, Calendar).

## 5. Quota increase request

The default YouTube Data API v3 quota is 10,000 units per day.
`videos.insert` costs 1,600 units, so the default quota allows about 6
uploads per day per Google Cloud project (shared across every workspace
using that project's OAuth client). Request an increase early:

1. APIs & Services > Quotas & System Limits, filter to "YouTube Data API v3".
2. Request an increase; Google's published ceiling for this API is
   1,000,000 units per day, but approval is manual and can take days.
3. Until the increase lands, the Property Channel upload step spreads
   uploads across days automatically (see
   `src/connectors/youtube/quota.ts` `estimateUploadSchedule`); a full
   365-video batch takes about 59 days to fully publish at the 10,000 unit
   default.

## 6. Environment variable mapping

Set these from the company Verlox client (never commit real values):

| Variable | Purpose |
| --- | --- |
| `YOUTUBE_API_ENABLED` | Feature flag; set `false` to disable the connector entirely. |
| `YOUTUBE_CLIENT_ID` | Same as platform `GOOGLE_CLIENT_ID` (company Verlox client). |
| `YOUTUBE_CLIENT_SECRET` | Same as platform `GOOGLE_CLIENT_SECRET`. |
| `YOUTUBE_REDIRECT_URI` | `https://admin.hireaiva.co.uk/api/aiva/youtube/oauth/callback` (must match Console). |
| `YOUTUBE_QUOTA_LIMIT_PER_DAY` | Daily unit budget used by the quota-aware scheduler; match your approved quota. |
| `PROPERTY_CHANNEL_MAX_VIDEOS_PER_BATCH` | How many days of content to generate per calendar batch (default 365). |
| `PROPERTY_CHANNEL_DEFAULT_PUBLISH_TIME` | Default daily publish time (HH:MM, local to the workspace). |
| `PROPERTY_CHANNEL_COMMENT_POLL_INTERVAL_MINUTES` | Minimum minutes between comment polls per channel (default 15). |
| `PROPERTY_CHANNEL_MEDIA_BATCH_SIZE` | How many calendar days to render per media-pipeline advance (Phase A default 1). |
| `TTS_PROVIDER` | Voiceover engine: `edge` (default) or `openai`. |
| `TTS_VOICE` | Edge TTS voice id (default `en-GB-SoniaNeural`). |
| `CHANNEL_CREDENTIAL_KEY` | Existing Aiva channel credential key (32-byte hex); OAuth tokens are encrypted at rest with this key. Required, shared with other channel integrations. |

Also keep `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` on Core/Cloud pointed at the same company client via Ops `/google-oauth`.

## 7. Media rendering (Phase A)

Phase A produces a real faceless MP4 before YouTube upload:

1. Voiceover: `src/utils/tts.ts` (Edge TTS with OpenAI fallback) writes mp3 under the property-channel media store.
2. Visuals: timed caption cues + bundled placeholder still (fallback path).
3. Thumbnail: 1280x720 PNG via ffmpeg (raster only for `thumbnails.set`).
4. Compositor: ffmpeg mux (slow zoom over still + AAC voiceover + burned captions) to 1080p H.264 MP4 at `assets.videoPath`.
5. Upload gate: `runYouTubeUpload` refuses non-MP4 artifacts and never uploads script text or JSON manifests as `video/mp4`.

Runtime: Contabo `carina-web` image already installs `ffmpeg` (see `docker/Dockerfile.carina`). ffprobe is used for duration / gate checks.

## 7b. Media rendering (Phase B)

Heavy renders no longer block HTTP `advance`:

1. `runMediaPipeline` enqueues jobs (`queued`) and returns quickly.
2. In-process worker `startPropertyChannelRenderWorker()` (started with carina-core) drains the queue with concurrency 1 by default.
3. Cadence scheduler `startPropertyChannelCadenceScheduler()` advances running workflows on an interval so you do not need to click Advance for each render.
4. Stock visuals: put jpg/png files in `PROPERTY_CHANNEL_STOCK_DIR` or `$CARINA_HOME/property-channel/media/stock`. If empty, branded PNG stills are generated per hook/body/cta; Phase A SVG remains the last-resort fallback.
5. Retention: local MP4/voiceover work files are purged `PROPERTY_CHANNEL_MEDIA_RETENTION_DAYS` (default 7) after successful upload.
6. Stale `rendering` jobs older than `PROPERTY_CHANNEL_RENDER_STALE_MS` (default 45m) are re-queued or failed (max 2 attempts).

Docker / Contabo: no extra container is required. The worker runs inside `carina-core` / `carina-web` alongside the API. Disable with `PROPERTY_CHANNEL_RENDER_WORKER=false` or `PROPERTY_CHANNEL_CADENCE_SCHEDULER=false`. For emergency inline renders set `PROPERTY_CHANNEL_INLINE_RENDER=true`.

API: `GET /api/aiva/youtube-channel/:channelId/videos` and `/queue` expose queue depth, next render/upload windows, and last render error.

## 7c. Media quality (Phase C)

1. Scripts: `PROPERTY_CHANNEL_SCRIPT_MODE=template` (default, deterministic) or `llm` (uses `llm.chatCheap`). Calendar items store `scriptMode`, `model`, and `promptVersion`.
2. Niche research: returns a 12-month theme map; `researchMode` is `heuristic` or `live` when `PROPERTY_CHANNEL_LIVE_RESEARCH=true` and a YouTube Data API key is set. Competitor notes are always source-tagged.
3. Voice: prefer `PROPERTY_CHANNEL_TTS_VOICE` (falls back to `TTS_VOICE`, default `en-GB-SoniaNeural`). Compositor applies ffmpeg `loudnorm` before mux.
4. Thumbnails: stronger brand/location layout; still 1280x720 PNG under 2MB.
5. Weekly reports stay available in-app via analytics endpoints / report store; CRM email routing remains optional.

Additional env knobs:

| Variable | Purpose |
| --- | --- |
| `PROPERTY_CHANNEL_MAX_RENDERS_PER_DAY` | Cap renders per channel/day (default 2). |
| `PROPERTY_CHANNEL_MAX_UPLOADS_PER_DAY` | Cap uploads per channel/day (default 6, also limited by quota). |
| `PROPERTY_CHANNEL_RENDER_AHEAD_DAYS` | Prefetch calendar days before publish date (default 1). |
| `PROPERTY_CHANNEL_RENDER_CONCURRENCY` | Simultaneous renders per host (default 1). |
| `PROPERTY_CHANNEL_RENDER_POLL_MS` | Worker poll interval (default 15000). |
| `PROPERTY_CHANNEL_CADENCE_TICK_MS` | Workflow advance interval (default 300000). |
| `PROPERTY_CHANNEL_MEDIA_RETENTION_DAYS` | Days to keep local MP4 after upload (default 7). |
| `PROPERTY_CHANNEL_STOCK_DIR` | Folder of free/licensed stills. |
| `PROPERTY_CHANNEL_SCRIPT_MODE` | `template` or `llm`. |
| `PROPERTY_CHANNEL_TTS_VOICE` | UK Edge voice id. |
| `PROPERTY_CHANNEL_LIVE_RESEARCH` | `true` to call YouTube search for research notes. |

## 8. Test channel setup

1. In Hire Aiva, open YouTube Channel / Connect YouTube for a test workspace.
2. Click Connect YouTube (no Cloud Console steps for the end user).
3. Approve scopes with an operator Google account while Testing, or any account after Production.
4. Start the run; let the cadence worker enqueue and render (or Advance once to enroll the calendar). Confirm a job moves `queued` -> `rendering` -> `ready` with `.mp4` on disk, then upload.
5. Confirm the video appears in YouTube Studio as private / scheduled and plays.

## 9. Customer BYOK

If a workspace must use its own Google Cloud YouTube client, that is an Advanced BYOK path
(own Client ID on their project with the same redirect URIs). Do not load customer clients into
platform Ops Google OAuth.
