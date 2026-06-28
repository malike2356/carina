# xeclone; Project: Build iLaud (Multimodal Clone)

**Status:** New project; specification phase
**Date:** 24 June 2026 (updated 25 June 2026)
**Project dir:** `02-backends/xeclone/`
**Product:** iLaud (working name); Laud's full AI clone
**Scope:** Text. Audio. Image. Video. Complete digital twin.

---

## xeclone = the project. iLaud = the clone.

xeclone is the project that builds and runs iLaud.

iLaud is Laud's full AI clone; a multimodal Aiva powered by Carina, governed by Scout, trained on Laud's entire digital self.

iLaud:
- **Writes like Laud**; LinkedIn posts, messages, emails in his voice and style
- **Sounds like Laud**; voice notes in his accent, cadence, and timbre
- **Looks like Laud**; still images and photos generated with his face
- **Appears like Laud**; talking-head video, presentations, short-form content
- **Knows what Laud knows**; full access to his projects, memory, relationships, history

iLaud is Laud's second self; his personal multimodal Aiva, built from four layers:

**Carina** → the platform. Orchestration, memory, tools, skills, channels.
**Aiva** → the persona framework. Named worker with role, tone, escalation, channel presence.
**Laud (digital)** → the data. Writing, voice recordings, face photos, videos, decisions, values.
**Scout** → governance. Every generation logged, every output auditable, kill switch always reachable.

---

## Core Capabilities (iLaud)

### 1. Text Voice; Writing
- Trained on Laud's 310 DeepSeek conversations, 26 WhatsApp chats, 23 LinkedIn posts
- Output matches: direct, no-fluff, Nigerian-Ijaw English, property + tech vocabulary
- Generates: LinkedIn posts, replies, emails, messages

### 2. Audio Voice; Speaking
- Voice clone trained on Laud's speech recordings
- Generates: voice notes, audio summaries, spoken responses
- Providers: ElevenLabs (cloud, fast start) → XTTS v2 (self-hosted, later)

### 3. Visual; Face & Image
- LoRA trained on 10-20 face photos (multiple angles, lighting, expressions)
- Generates: profile-style photos, post imagery with Laud's face
- Generator: Stable Diffusion XL / Flux + face LoRA

### 4. Video; Talking Head & Full Motion
- Trained on 2-5 min video of Laud speaking naturally to camera
- Generates: talking-head videos, short-form content, presentations
- Tools: HeyGen / SadTalker / Wav2Lip for lip-sync; FaceFusion for face replacement

### 5. Knowledge Graph
- Access to all Carina memory, Hermes memory, and OpenClaw memory
- Knows: projects, people, properties, history, values, 7 Pillars
- Source: persona files + 1,280-file digital footprint

### 6. Channel Presence
- LinkedIn: draft and schedule posts as Laud
- WhatsApp: respond as Laud with voice notes
- Telegram: integrated with Hermes; iLaud can message Laud directly
- Email: draft responses in Laud's voice
- Video: publish talking-head content to LinkedIn/YouTube

---

## Architecture

```
xeclone/                          # Project root
├── iLaud/                        # The clone configuration
│   ├── persona/                  # Voice, tone, style, values, knowledge
│   │   ├── voice.md              # How iLaud writes and speaks
│   │   ├── values.md             # 7 Pillars, decision framework, boundaries
│   │   └── knowledge.md          # People, projects, properties, history
│   ├── content/                  # Digital footprint; training data
│   │   ├── 1.dfp/                # AI conversations (DeepSeek, Claude, ChatGPT)
│   │   ├── 1.me.md               # Complete personal profile
│   │   ├── DATA_INVENTORY.md     # What's usable vs off-limits
│   │   └── txt/                  # Text exports
│   ├── voice/                    # Voice cloning
│   │   ├── samples/              # Laud's voice recordings (needed)
│   │   └── tts-config.ts         # ElevenLabs / XTTS config
│   ├── visual/                   # Face & image cloning
│   │   ├── photos/               # 10-20 face photos (needed)
│   │   └── lora-config.yaml      # SDXL / Flux face LoRA training config
│   └── video/                    # Video cloning
│       ├── samples/              # 2-5 min video recordings (needed)
│       └── pipeline-config.ts    # HeyGen / SadTalker / Wav2Lip config
├── bridge/                       # Carina + Aiva integration
│   └── carina-aiva-bridge.ts     # Connects iLaud to Carina tools, memory, skills
├── n8n/                          # n8n workflow definitions
│   └── iLaud-workflows.json      # Post scheduling, engagement alerts, etc.
├── research-how-clones-are-built.md  # Full research reference
└── README.md
```

---

## Build Phases

### Phase 1: Text Persona (now)
- iLaud generates posts in Laud's style from the digital footprint
- Prompt engineering with 10 real posts as examples
- Manual review → refine prompt
- Data: 310 DeepSeek conversations, 26 WhatsApp chats, 23 LinkedIn posts

### Phase 2: Scheduled Posting + Voice (next)
- n8n integration for auto-posting
- Content calendar + performance tracking
- **Collect voice samples:** 5 min of Laud speaking naturally
- Voice clone via ElevenLabs → iLaud voice notes
- Data needed: voice recordings → `iLaud/voice/samples/`

### Phase 3: Visual Clone (after Phase 2)
- **Collect face photos:** 10-20 photos, multiple angles, expressions, lighting
- Train face LoRA on SDXL or Flux
- iLaud generates post images with Laud's face
- Data needed: face photos → `iLaud/visual/photos/`

### Phase 4: Video Clone (after Phase 3)
- **Collect video:** 2-5 min of Laud speaking to camera
- Train HeyGen / SadTalker / Wav2Lip
- iLaud generates talking-head videos
- Data needed: video recordings → `iLaud/video/samples/`

### Phase 5: Autonomous Mode (future)
- iLaud posts, responds, generates images and video independently
- Scout governs every output
- Laud reviews high-stakes content only
- Performance feedback loop active

---

## Stack

iLaud is built on:
- **Carina**; agent platform (orchestration, memory, tools, skills, channels)
- **Aiva**; persona framework (named worker, role config, escalation, channel binding)
- **Scout**; governance (audit trail, kill switch, compliance, every generation logged)
- **n8n**; workflow automation (scheduling, triggers, cross-platform delivery)
- **Laud's digital self**; training data (posts, messages, voice, photos, videos, decisions, values)

| Modality | Phase | Tool | Data Needed |
|----------|-------|------|-------------|
| Text | 1 | LLM + persona prompt | Done (1,280 files) |
| Audio | 2 | ElevenLabs / XTTS v2 | 5 min voice recording |
| Image | 3 | SDXL/Flux + face LoRA | 10-20 face photos |
| Video | 4 | HeyGen / SadTalker / Wav2Lip | 2-5 min video |

---

## Guardrails

- Every output reviewed by Laud before publishing (Phase 1-3)
- iLaud never publishes without approval until Phase 5
- Scout logs every generation; text, audio, image, video
- Visual outputs watermarked as AI-generated until Phase 5
- iLaud discloses AI generation where appropriate
- Kill switch: Scout can pause iLaud instantly
- Deepfake ethics: never impersonate Laud in private communications without his knowledge
- Face data: stored locally, never uploaded to cloud services unless explicitly approved
