
**Status: COMPLETED 2026-07-26**

**What was built:**
- Property Channel workflow template (7 steps) + YouTube connector/OAuth/quota
- Script generator (9 niches, 365 calendar), media pipeline job progression
- Lead capture (detect/route/auto-respond) + analytics/weekly report
- App UI under `/aiva/property-channel/*` + setup docs and Vitest coverage

Use this as the implementation prompt.

  # Prompt: Implement Aiva YouTube Property Channel Automation

  You are working in `/opt/lampp/htdocs/verlox`. Follow all `AGENTS.md` instructions. Never use em dashes, en dashes, or emojis. Run `python3 scripts/fix-writing-style.py` before final handoff.

  ## Goal

  Build a complete automated YouTube channel workflow inside Aiva that lets a user create, populate, and run a faceless property channel without touching video editing software, scriptwriting, or manual uploading.

  The workflow must match this real-world validated pipeline:

  - Channel structure and niche research: automated from property portfolio data
  - One year of video scripts, headlines, descriptions: AI-generated per property niche
  - Video creation including thumbnails: Carina media pipeline
  - Upload and scheduled publishing: YouTube Data API v3
  - Lead capture from comments: auto-detection and CRM routing
  - Weekly analytics: views, subscribers, click-through rate, leads captured

  Current market problem: competitors charge £15 per video for AI-generated content but cannot solve the YouTube upload step. This workflow closes that gap and delivers a flat-monthly subscription product.

  ## Product decision

  This is an Aiva workflow template called "Property Channel."

  One Aiva provisions and manages the entire channel. The user picks a property niche and location. Aiva handles everything downstream.

  Channel identity is auto-generated:
  - Channel name from niche + location (e.g. "Manchester Buy-to-Let Insider")
  - Banner and logo from Carina image pipeline
  - About section populated with keyword-rich description

  Content cadence:
  - One video per day, 365 days generated in one batch
  - Videos scheduled daily at a user-configured time (default 18:30 local)
  - Each video: script, voiceover, visuals, thumbnail, title, description, tags, playlist assignment

  Lead capture:
  - Comments scanned for intent signals (questions, requests, contact details)
  - Detected leads tagged and routed to workspace CRM pipeline
  - Three routing destinations: sourcing funnel, joint venture calls, training pipeline

  Pricing model:
  - Included in Aiva Business tier
  - Covers one active channel per workspace
  - Additional channels as add-on

  ## Required implementation

  ### 1. Add YouTube channel provisioning to Aiva workflow engine

  Create a new Aiva workflow template in the workflow registry.

  Suggested path:
  `server/src/workflows/templates/property-channel/`

  Required files:
  - `template.ts`; workflow definition and step graph
  - `steps/channel-provision.ts`; YouTube channel creation or connection
  - `steps/niche-research.ts`; market analysis and content strategy
  - `steps/script-generation.ts`; 365 scripts, headlines, descriptions, tags
  - `steps/media-pipeline.ts`; video and thumbnail generation
  - `steps/youtube-upload.ts`; upload and schedule via YouTube API
  - `steps/comment-monitor.ts`; comment polling and lead detection
  - `steps/analytics-report.ts`; weekly performance dashboard

  The workflow engine must:
  - Accept inputs: niche (string), location (string), publishTime (HH:MM), channelId (optional)
  - If no channelId, provision a new YouTube channel via OAuth
  - Track progress per step with workspace-visible status
  - Support pause, resume, and cancel on the full pipeline
  - Be idempotent per step; re-running a completed step does not duplicate work

  ### 2. Implement YouTube Data API v3 integration

  Add a YouTube connector module.

  Suggested path:
  `server/src/connectors/youtube/`

  Required files:
  - `client.ts`; authenticated API client with token refresh
  - `channel.ts`; channel CRUD operations
  - `upload.ts`; video upload, thumbnail upload, scheduling
  - `comments.ts`; comment retrieval, reply, moderation
  - `analytics.ts`; channel analytics and reporting
  - `auth.ts`; OAuth 2.0 flow with token storage

  OAuth 2.0 flow:
  - Use Google OAuth 2.0 with YouTube Data API v3 scope
  - Store tokens encrypted in workspace credential vault
  - Support token refresh without user re-auth
  - Show connection status in workspace settings

  Required scopes:
  - `https://www.googleapis.com/auth/youtube.upload`
  - `https://www.googleapis.com/auth/youtube`
  - `https://www.googleapis.com/auth/youtube.readonly`
  - `https://www.googleapis.com/auth/yt-analytics.readonly`

  API operations needed:
  - `channels.list`; get or verify channel
  - `channels.insert`; create new channel
  - `videos.insert`; upload video with metadata
  - `thumbnails.set`; upload custom thumbnail
  - `playlists.insert`; create topic playlists
  - `playlistItems.insert`; add video to playlist
  - `commentThreads.list`; poll recent comments
  - `comments.insert`; reply to comments
  - `commentThreads.update`; moderate comments
  - YouTube Analytics API; channel reports

  Rate limit handling:
  - YouTube quota: 10,000 units per day default
  - Videos.insert costs 1,600 units
  - Batch uploads must spread across multiple days if needed
  - Implement quota-aware scheduler that respects daily limits
  - Show quota usage in workspace dashboard

  ### 3. Build the script generation pipeline

  Create a content engine that generates SEO-optimized video scripts for property niches.

  Suggested path:
  `server/src/content/script-generator/`

  Required files:
  - `generator.ts`; main script generation orchestrator
  - `prompts/property-niche.ts`; niche-specific prompt templates
  - `seo/keyword-research.ts`; keyword extraction and ranking
  - `templates/script-structure.ts`; video script format templates
  - `templates/metadata.ts`; title, description, and tag templates

  For each video, generate:
  - Script: 3-5 minute property video script with hook, body, call-to-action
  - Title: SEO-optimized, under 100 characters, includes primary keyword
  - Description: 200-500 words, keyword-rich, includes links and timestamps
  - Tags: 10-20 relevant YouTube tags, ranked by search volume
  - Thumbnail prompt: text description for Carina image generation

  Property niche categories supported:
  - Buy-to-let investment
  - House flipping and renovation
  - Commercial property
  - HMO and multi-let
  - Property sourcing
  - First-time buyer guides
  - Landlord tips and legislation
  - Property market analysis
  - Auction property walkthroughs

  Niche research step must:
  - Accept niche and location inputs
  - Research current YouTube trends in that niche
  - Identify high-performing content formats
  - Map competitor channel strategies
  - Return a 12-month content calendar with weekly themes

  ### 4. Implement media pipeline integration

  Connect the script output to Carina's media generation pipeline.

  Suggested path:
  `server/src/content/media-pipeline/`

  Required files:
  - `video-builder.ts`; orchestrates video assembly
  - `voiceover.ts`; text-to-speech integration
  - `visuals.ts`; image and B-roll generation
  - `thumbnail.ts`; thumbnail image generation
  - `compositor.ts`; video composition and rendering

  Video format:
  - Resolution: 1080p (1920x1080)
  - Aspect ratio: 16:9
  - Frame rate: 30fps
  - Duration: 3-5 minutes per video
  - Format: MP4, H.264 codec, AAC audio
  - Max file size: YouTube allows up to 256GB; target under 500MB per video

  Voiceover options:
  - Default: high-quality TTS from Carina voice engine
  - Optional: workspace voice profile upload
  - UK English accent for property niche targeting

  Visual generation:
  - Property images from workspace asset library or stock
  - Text overlays for key points
  - B-roll transitions between segments
  - Lower thirds with property details
  - End screen template with subscribe and next-video elements

  Thumbnails:
  - 1280x720 resolution
  - Under 2MB file size
  - Bold text overlay with video hook
  - Property image as background
  - Consistent branding template per channel

  ### 5. Build lead capture and routing

  Create a comment monitoring system that detects leads and routes them into Aiva CRM.

  Suggested path:
  `server/src/lead-capture/youtube/`

  Required files:
  - `comment-monitor.ts`; periodic comment polling
  - `lead-detector.ts`; intent classification
  - `lead-router.ts`; CRM destination routing
  - `auto-responder.ts`; automated comment replies

  Comment polling:
  - Poll YouTube commentThreads.list every 15 minutes for active channels
  - Track last polled timestamp per channel
  - Deduplicate by comment ID
  - Store all comments in workspace email/activity store

  Lead detection signals:
  - Contact information present (email, phone, website)
  - Question indicators ("how much", "interested in", "looking for")
  - Call-to-action engagement ("DM me", "send details", "get in touch")
  - Property inquiry language ("available", "price", "viewing")
  - Investor language ("ROI", "yield", "deal", "portfolio")

  Lead classification:
  - `hot_lead`; contact info present, clear buying intent
  - `warm_lead`; interested question, no contact info yet
  - `cold_lead`; general engagement, low intent
  - `spam`; promotional or irrelevant

  Routing destinations:
  - Sourcing funnel: leads looking for deals → workspace deal pipeline
  - Joint venture calls: investor-type leads → workspace meeting scheduler
  - Training pipeline: beginner questions → workspace education funnel

  Auto-responder:
  - Hot leads: "Thanks for reaching out. A member of the team will contact you shortly with more details."
  - Warm leads: "Great question. Check the link in the description for more information or drop us a DM."
  - Cold leads: Like and generic engagement only
  - Never auto-respond with contact details or pricing

  ### 6. Add analytics dashboard

  Build a workspace-visible analytics panel for the property channel.

  Suggested path:
  `server/src/analytics/youtube-channel/`

  Required files:
  - `reporter.ts`; data aggregation from YouTube Analytics API
  - `dashboard-api.ts`; REST endpoints for frontend
  - `weekly-report.ts`; automated weekly summary generation

  API endpoints:
  - `GET /api/aiva/property-channel/:channelId/analytics`; channel overview
  - `GET /api/aiva/property-channel/:channelId/analytics/videos`; per-video stats
  - `GET /api/aiva/property-channel/:channelId/analytics/leads`; lead capture report
  - `GET /api/aiva/property-channel/:channelId/analytics/weekly`; weekly report

  Dashboard metrics:
  - Subscriber count and growth rate
  - Total views and view trend (7-day, 30-day)
  - Average view duration and retention
  - Click-through rate (impressions to views)
  - Top 10 performing videos
  - Lead count by classification (hot, warm, cold)
  - Lead-to-subscriber conversion rate
  - Estimated revenue from lead pipeline
  - Quota usage and remaining

  Weekly report:
  - Auto-generated every Monday 09:00 workspace time
  - Delivered to workspace Email area
  - Includes: week-over-week comparison, top video, lead summary, recommendations
  - Action items for channel growth

  ### 7. Add frontend UI

  Add the Property Channel workflow UI to the Aiva workspace.

  Suggested paths:
  `app/src/app/(dashboard)/workspace/[id]/aiva/property-channel/`

  Required pages:
  - `page.tsx`; channel overview dashboard
  - `setup/page.tsx`; new channel setup wizard
  - `content/page.tsx`; content calendar and queue
  - `videos/page.tsx`; video library and status
  - `analytics/page.tsx`; analytics dashboard
  - `leads/page.tsx`; lead inbox and pipeline
  - `settings/page.tsx`; channel settings

  Setup wizard steps:
  1. Choose niche (dropdown with descriptions)
  2. Enter location (postcode, city, or region)
  3. Select publish schedule (time of day per video)
  4. Connect YouTube (OAuth flow)
  5. Review content plan (preview first 7 scripts)
  6. Confirm and launch

  Content calendar view:
  - Month-by-month grid
  - Each day shows: video title, status (generated, rendering, scheduled, published)
  - Click to preview script, thumbnail, and metadata
  - Edit and regenerate individual items
  - Bulk actions: regenerate month, pause publishing

  Lead inbox:
  - Filterable list: all, hot, warm, cold, spam
  - Each lead shows: comment text, classification, detected contact info, routing destination
  - Actions: reply, assign to team member, move to pipeline stage, mark as handled
  - Integration with existing workspace CRM views

  UI voice (per REUSE-RULES.md):
  - Direct, calm, British-leaning neutral
  - No emoji, no exclamation marks
  - Feature labels use Carina naming not competitor naming
  - "Property Channel" is the user-facing feature name

  ### 8. Add environment configuration

  Add to `.env.example` only, with no secrets:

  ```
  YOUTUBE_API_ENABLED=true
  YOUTUBE_CLIENT_ID=
  YOUTUBE_CLIENT_SECRET=
  YOUTUBE_REDIRECT_URI=https://admin.hireaiva.co.uk/api/aiva/youtube/oauth/callback
  YOUTUBE_QUOTA_LIMIT_PER_DAY=10000
  PROPERTY_CHANNEL_MAX_VIDEOS_PER_BATCH=365
  PROPERTY_CHANNEL_DEFAULT_PUBLISH_TIME=18:30
  PROPERTY_CHANNEL_COMMENT_POLL_INTERVAL_MINUTES=15
  ```

  ### 9. Add operator documentation

  Add a short operator doc explaining Google Cloud Console setup.

  Suggested path:
  `docs/features/property-channel-youtube-setup.md`

  Contents:
  - Google Cloud Console project creation
  - YouTube Data API v3 enablement
  - OAuth consent screen configuration
  - OAuth 2.0 client ID creation
  - Quota increase request process (10K default, can request up to 1M)
  - Environment variable mapping
  - Test channel setup steps
  - Troubleshooting common errors

  ### 10. Add tests

  Test coverage required:

  - YouTube OAuth flow completes and stores token
  - Token refresh works with expired credentials
  - Video upload succeeds with valid metadata
  - Thumbnail upload succeeds within size limits
  - Script generation produces valid output for all 9 niche types
  - SEO keywords are extracted and ranked
  - 365 scripts generated with unique content
  - Comment polling respects rate limits
  - Lead detection classifies correctly for all 4 categories
  - Lead router assigns correct pipeline destination
  - Auto-responder matches appropriate templates
  - Weekly report generates with correct metrics
  - Workflow steps are idempotent
  - Content calendar view renders all states
  - Setup wizard validates inputs at each step

  Run:
  ```
  pnpm exec vitest run
  pnpm exec tsc --noEmit
  python3 scripts/fix-writing-style.py
  ```

  ## Acceptance criteria

  This is done only when:

  - A workspace user can create a new Property Channel from the Aiva dashboard
  - Setup wizard completes and provisions a YouTube channel via OAuth
  - 365 video scripts, titles, descriptions, tags, and thumbnail prompts are generated
  - Media pipeline produces videos with voiceover, visuals, and thumbnails
  - Videos upload to YouTube and are scheduled at the configured daily time
  - Comments are polled every 15 minutes and leads are detected and classified
  - Hot and warm leads appear in the workspace lead inbox
  - Auto-responder replies to leads without leaking pricing or contact details
  - Weekly analytics report is generated and delivered to workspace Email
  - Analytics dashboard shows accurate subscriber, view, and lead metrics
  - YouTube API quota usage is tracked and displayed
  - OAuth tokens are stored encrypted and refreshed automatically
  - All steps in the workflow are idempotent
  - Frontend uses Carina voice (direct, calm, no emoji, no competitor names)
  - Full test suite passes
  - TypeScript passes
  - Writing style scan passes
  - No secrets or API keys committed

  ## Important implementation notes

  - YouTube quota is the primary constraint. Videos.insert costs 1,600 units of 10,000 daily default. Batch generation of 365 videos will take 59 days at default quota. Design the scheduler to spread uploads across the year as videos are needed, not all at once.
  - Request quota increase to 1,000,000 units in production Google Cloud Console as early as possible.
  - Media rendering is compute-heavy. Use background job queue for video generation, not blocking API calls. Each video may take 5-15 minutes to render.
  - Do not store raw YouTube OAuth tokens in the database. Encrypt at rest using workspace credential vault.
  - Comment monitoring must not exceed YouTube API rate limits. Batch commentThreads.list calls by channel.
  - This is a faceless channel product. Never generate presenter footage or face video. All visuals are property images, text overlays, B-roll, and graphics.
  - Lead detection must not false-positive on genuine engagement comments. Intent signals must be clear before classifying as a lead.
  - Thumbnail generation must stay under 2MB. Compress automatically if over limit.
  - Auto-responder must never impersonate a human. "A member of the team" is the correct tone.
  - The Property Channel feature name must be used consistently in UI. Do not call it "YouTube automation" or "faceless channel" in user-facing copy.
  - UK market focus: TTS voiceover should default to UK English. Property niche categories reflect UK market terminology (Buy-to-let, HMO, sourcing).
  - All generated content must pass a uniqueness check. Two videos should not have near-identical scripts or titles.
