# Carina Voice Agent; Complete Product Roadmap

**Date:** 2026-06-19
**Type:** Product vision + phased roadmap + architecture + business case
**Status:** North star. Implementation spans gaps 03, 06, 07, and post-gap.
**Reading time:** ~25 minutes

---

## Table of Contents

1. [The North Star](#the-north-star)
2. [Why Voice Changes Everything](#why-voice-changes-everything)
3. [Competitive Context: The Moat No One Can Cross](#competitive-context-the-moat-no-one-can-cross)
4. [The Stack: What Voice Requires](#the-stack-what-voice-requires)
5. [Phase 1: Mobile App Foundation](#phase-1-mobile-app-foundation)
6. [Phase 2: Wake Word & Continuous Listening](#phase-2-wake-word--continuous-listening)
7. [Phase 3: Streaming Voice Pipeline](#phase-3-streaming-voice-pipeline)
8. [Phase 4: Personality & Tone](#phase-4-personality--tone)
9. [Phase 5: True Telephony](#phase-5-true-telephony)
10. [Voice Architecture Deep-Dive](#voice-architecture-deep-dive)
11. [Voice-Specific System Prompt Engineering](#voice-specific-system-prompt-engineering)
12. [Privacy & Security for Always-Listening](#privacy--security-for-always-listening)
13. [How Voice Integrates with Scout, Forensics & Compliance](#how-voice-integrates-with-scout-forensics--compliance)
14. [Voice Scenarios: Every Tier, Every Surface](#voice-scenarios-every-tier-every-surface)
15. [Proactive Outreach: When Carina Calls You](#proactive-outreach-when-carina-calls-you)
16. [Multi-Language Voice](#multi-language-voice)
17. [Accessibility](#accessibility)
18. [Edge Cases & Failure Modes](#edge-cases--failure-modes)
19. [Business Case: Why Voice-First Pricing Wins](#business-case-why-voice-first-pricing-wins)
20. [How This Connects to Existing Gaps](#how-this-connects-to-existing-gaps)
21. [Timeline](#timeline)
22. [The Moment](#the-moment)

---

## The North Star

Pick up your phone. Call Carina. Have a conversation as though it were a person.

```
You: "Hey Carina."

Carina: "Morning. Scout found three critical CVEs overnight.
         The nginx server on port 8443 looks urgent. Want me to investigate?"

You: "Yes. Exploit it. Tell me what you find."

Carina: "Give me a moment."

[15 seconds of silence]

Carina: "Done. Metasploit exploited CVE-2026-1844. Meterpreter session is open.
         Evidence captured. Obsidian vault updated. Scout shows confirmed.
         Remediate now or wait for the 2 AM change window?"

You: "Now."

Carina: "Remediated. CVE closed. Audit trail updated. Anything else?"

You: "No. Thanks."

Carina: "Talk later."
```

No terminal. No dashboard. No keyboard. A phone call. Voice in. Voice out. Full agent capability. The operator who just woke up and hasn't opened their laptop has resolved a critical CVE before their coffee is ready.

This is the product. Everything else; the 72 tools, the Scout dashboard, the SOC2 evidence, the TUI, the CLI; is infrastructure that serves this experience. They are necessary. They are not the product. The product is the moment you pick up your phone and talk to your agent.

---

## Why Voice Changes Everything

Every major AI agent platform lives in a terminal. Hermes, OpenClaw, Odysseus; they are text interfaces for builders. You type. You read. You scroll. That works for developers at a desk. It does not work for a CISO walking into a board meeting. It does not work for a security operator driving to a site. It does not work for anyone who needs their agent while their hands are occupied and their screen is off.

Voice is the interface that makes Carina a companion, not a tool. The difference is psychological. When you type to an agent, you are operating software. When you talk to an agent, you are collaborating with a colleague. The same capabilities. A different relationship.

The phone call is also the ultimate demo. You do not show someone Carina by making them read a terminal. You hand them your phone. They talk. Carina responds. They understand immediately. That five-second demo converts more users than any landing page.

There is a deeper reason voice matters. Text interfaces are inherently power-user interfaces. They require literacy in the tool's command syntax, comfort with reading dense output, and a mental model of what the tool can do. Voice interfaces require none of that. You talk. Carina understands. Voice democratizes access to the entire platform. The CISO who has never opened a terminal can call Carina and ask for the compliance report. The CEO who doesn't know what nmap is can call Carina and ask if the company is secure. Voice makes Carina accessible to everyone in the organization, not just the security team.

---

## Competitive Context: The Moat No One Can Cross

No major AI agent platform has a voice interface. Not Hermes. Not OpenClaw. Not Odysseus. Not Cursor. Not Claude Code. Not Codex. Not Copilot. They are all text-in, text-out. The closest any of them come is voice transcription in a chat interface; type with your voice, read the response. That is not voice conversation. That is dictation.

Voice conversation requires a stack of capabilities that no agent platform has built:

- A mobile app with background audio processing (most agents don't have a mobile app at all)
- On-device wake word detection with sub-100ms latency
- Streaming STT with interruption handling
- Streaming TTS with natural prosody
- A WebSocket transport layer for real-time audio
- Voice-optimized system prompts that produce speakable, concise responses
- A personality layer that makes the voice feel warm, not robotic

Building this stack takes 12 weeks with a dedicated team. Every week Carina has voice and competitors don't is a week of uncontested market advantage. By the time a competitor starts building voice, Carina has been live for months with real users, real feedback, and real refinements. The voice quality gap compounds.

The second-mover problem for competitors is acute. They can't just add voice as a feature. They have to build the mobile app first. Then the audio pipeline. Then the wake word. Then the personality. Each layer depends on the layer below. You cannot bolt voice onto a terminal-based agent. You have to build the platform for voice from the ground up. Carina is building it from the ground up.

---

## The Stack: What Voice Requires

Voice conversation is not one feature. It is a stack of capabilities. Each layer depends on the layer below. No layer can be skipped.

```
┌──────────────────────────────────────────────────────────┐
│  Layer 6: Telephony                                       │
│  PSTN integration. Phone numbers. Caller ID. Group calls. │
│  Voicemail. Multi-modal handoff.                          │
├──────────────────────────────────────────────────────────┤
│  Layer 5: Personality & Tone                              │
│  Carina's voice feels like a person. Warmth. Humor.       │
│  Brevity. Memory of past conversations. Emotional         │
│  adaptation. Proactive outreach.                          │
├──────────────────────────────────────────────────────────┤
│  Layer 4: Full Agent Backend                              │
│  Same Carina core. Same 72 tools. Same Scout integration. │
│  Same memory. Same compliance. Voice is just the I/O      │
│  layer; all capability is already built.                 │
├──────────────────────────────────────────────────────────┤
│  Layer 3: Streaming Voice Pipeline                        │
│  Real-time STT → agent → TTS. Sub-500ms latency.          │
│  Interruption handling. Turn-taking. Streaming audio       │
│  playback. Audio codec negotiation.                       │
├──────────────────────────────────────────────────────────┤
│  Layer 2: Voice Activity & Wake Word                      │
│  "Hey Carina" detection. On-device. Zero latency.         │
│  Voice activity detection (VAD). Continuous listening.    │
│  Battery-optimized background audio.                      │
├──────────────────────────────────────────────────────────┤
│  Layer 1: Mobile App Foundation                           │
│  Background WebSocket. Microphone access. Audio streaming.│
│  Push notifications. Native audio pipeline. Permissions.  │
└──────────────────────────────────────────────────────────┘
```

---

## Phase 1: Mobile App Foundation

**Effort:** 3 weeks (covered by gap-03)
**Depends on:** Nothing
**Deliverable:** Push-to-talk voice mode

### What Exists

121-file React Native app at `carinaMobile/` with:
- Chat interface, memory management, billing, Scout integration
- Full tab navigation (chat, memory, packs, usage, settings)
- API clients for Carina Gateway, Scout, billing, memory, push
- Session export, task management, widget system

### What Voice Needs From This Phase

**Background WebSocket connection.** The mobile app must maintain a persistent connection to the Carina Gateway even when backgrounded. This is the same connection used for text chat. Voice reuses it. When the user is on a voice call, the WebSocket carries audio streaming commands alongside regular agent messages.

Implementation: Android foreground service with persistent notification. iOS BGTaskScheduler for periodic keepalive. The connection manager handles reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s max). Network change detection triggers immediate reconnect.

**Microphone permission and access.** Both Android and iOS require explicit microphone permission with rationale. The permission flow must explain why Carina needs the microphone (voice commands, hands-free operation) before the OS permission dialog appears. If denied, Carina falls back to text-only mode gracefully.

Implementation: `expo-microphone` or custom native module. Permission gate component that shows rationale before triggering the OS dialog. Permission state tracked in app state. Text-only fallback when microphone is unavailable.

**Audio streaming capability.** The app must capture raw PCM audio from the microphone and stream it to the Carina Gateway over the existing WebSocket. This is not a file upload. It is a continuous stream of audio chunks.

Implementation: Audio context configured for 16kHz mono PCM (optimal for STT). Chunk size: 20ms (320 samples at 16kHz). Each chunk sent as a binary WebSocket message with a sequence number. The gateway reassembles and forwards to the STT service.

**Push notifications.** Carina must be able to reach the user even when the app is closed. Push notifications are the fallback for when the WebSocket connection drops. They wake the app, which reconnects the WebSocket.

Implementation: Firebase Cloud Messaging (FCM) for Android. Apple Push Notification service (APNs) for iOS. The Carina Gateway sends a silent push when it has something to say and the WebSocket is disconnected. The app receives the push, reconnects, and Carina delivers the message.

**Native audio pipeline.** Audio playback must be low-latency and support streaming. The default Expo Audio API may not be fast enough for real-time TTS playback. If not, a native module wraps Android AudioTrack and iOS AVAudioEngine for direct PCM playback.

Implementation: Evaluate Expo Audio latency first. If >100ms, build a native module. Android AudioTrack in streaming mode. iOS AVAudioEngine with a tap on the output node. Both accept raw PCM buffers and play them with minimal buffering.

**Deliverable:** Mobile app can maintain a persistent connection to Carina, capture audio from the microphone, stream it to the gateway, receive TTS audio back, and play it. Basic push-to-talk voice mode works. User holds a button, speaks, releases, Carina responds via TTS. Text chat continues to work normally alongside voice.

---

## Phase 2: Wake Word & Continuous Listening

**Effort:** 2 weeks
**Depends on:** Phase 1 (mobile app with audio pipeline)
**Deliverable:** "Hey Carina" hands-free activation from locked phone

### What This Phase Builds

**Wake word detection.** The phrase "Hey Carina" must be detected on-device, in real-time, with zero network dependency. The detector runs continuously when hands-free mode is enabled. It consumes minimal battery (target: <2% per hour on modern devices).

Implementation options, in priority order:

1. **Picovoice Porcupine**; Commercial wake word engine. Custom wake word training ("Hey Carina"). Cross-platform (Android, iOS). Sub-100ms detection. <1MB model size. Works offline. Costs ~$2 per device per year at scale. This is the recommended option.

2. **Snowboy**; Open-source wake word engine (now deprecated but still functional). Free. Can train custom wake words. Smaller community. Less actively maintained. Acceptable as a fallback.

3. **Custom TensorFlow Lite model**; Train a custom wake word model on "Hey Carina" audio samples. Full control. No licensing cost. Requires training data and ML expertise. 1-2 weeks of training and tuning. Only if Porcupine is not viable.

The wake word model is loaded at app startup. When hands-free mode is enabled, the microphone opens in a low-power listening mode. Audio is processed locally. Nothing leaves the device until the wake word is detected. This is critical for privacy.

**Voice Activity Detection (VAD).** Once the wake word triggers, Carina needs to know when the user is speaking and when they've stopped. VAD segments the audio stream into speech and silence. When silence exceeds a threshold (typically 800ms for conversational turn-taking), Carina processes the utterance.

Implementation: WebRTC VAD (widely used, well-tested, works on mobile). Configurable sensitivity. Aggressive mode for noisy environments. Less aggressive for quiet environments. VAD runs on-device alongside the wake word detector.

**Continuous listening mode.** When enabled, the microphone stays open. The wake word detector runs continuously. When "Hey Carina" is detected, the device plays a short acknowledgment sound (a subtle chime, not a full voice response) to confirm it heard the wake word. The user then speaks their request. VAD detects when they've finished. The audio is streamed to the gateway for STT.

If the user does not speak within 5 seconds of the wake word, the session times out. Carina does not say "I didn't hear you." It simply returns to listening mode silently. This prevents awkward interactions where the wake word triggers accidentally.

**Battery optimization.** Continuous listening must not drain the battery. Strategies:

- Android: Use `AudioRecord` with a low sample rate (16kHz) in a foreground service. The wake word model runs on a dedicated CPU core at low frequency. Target: <50mA drain while listening.
- iOS: Use `AVAudioEngine` with voice processing I/O. The device's audio DSP handles wake word processing directly, offloading from the main CPU. Target: <30mA drain.
- Both: Disable continuous listening when battery is below 20%. Switch to push-to-talk only. Notify user: "Hands-free mode paused to save battery. Hold the button to talk."

**Visual indicators.** Users need to know when Carina is listening:

- Notification dot: Small colored dot in the status bar. Green = listening in background. Amber = wake word detected, listening for command. Red = microphone unavailable.
- Lock screen: When the wake word triggers while the phone is locked, the screen wakes to a minimal Carina interface. Dark background. A single pulsing waveform animation. No text. No buttons. Just visual confirmation that Carina heard you.
- App icon badge: Small badge on the Carina app icon showing hands-free status.

**Hands-free mode toggle.** The user can enable or disable continuous listening at any time:

- Quick Settings tile (Android): One-tap toggle from the notification shade.
- Control Center widget (iOS): One-tap toggle.
- Voice command: "Hey Carina, stop listening." Carina disables hands-free mode and confirms with a chime.
- Scheduled: User can set hours when hands-free is active (e.g., 7 AM to 10 PM).

**Deliverable:** User says "Hey Carina" while phone is locked. Phone wakes with a subtle animation. Carina chimes to acknowledge. User speaks their request. Carina processes and responds in voice. If the phone is in a pocket or face-down, the wake word is suppressed (proximity sensor check). If battery is low, Carina falls back to push-to-talk and notifies the user.

---

## Phase 3: Streaming Voice Pipeline

**Effort:** 4 weeks
**Depends on:** Phase 1 (mobile audio pipeline)
**Deliverable:** Real-time voice conversation with sub-500ms latency

### Architecture

```
┌──────────┐    WebSocket     ┌─────────────┐    gRPC/WS    ┌──────────┐
│  Mobile  │ ───────────────→ │   Carina     │ ────────────→ │    STT   │
│   App    │ ←─────────────── │   Gateway    │ ←──────────── │  Service │
│          │   audio chunks   │  (port 4001) │  transcribed  │ (Whisper │
│  mic ───→│                  │              │     text      │  Deepgram│
│          │                  │      │       │               │  or local)│
│ speaker  │                  │      │       └──────────────┘
│    ←───  │                  │      │
└──────────┘                  │      ▼
                              │ ┌──────────┐
                              │ │  Carina  │
                              │ │   Core   │
                              │ │ (3333)   │
                              │ │          │
                              │ │ Agent    │
                              │ │ processes│
                              │ │ text     │
                              │ └────┬─────┘
                              │      │
                              │      ▼ streaming tokens
                              │ ┌──────────┐    streaming   ┌──────────┐
                              │ │   TTS    │ ─────────────→ │  Mobile  │
                              │ │  Service │ ←───────────── │   App    │
                              │ │(ElevenLabs│  audio chunks  │          │
                              │ │ edge-tts) │                │ speaker  │
                              │ └──────────┘                └──────────┘
                              └─────────────┘
```

### Speech-to-Text (STT)

**Primary: OpenAI Whisper API (streaming mode via WebSocket).** Whisper supports real-time streaming via the Realtime API. Audio chunks are sent as binary WebSocket messages. Partial transcripts arrive as JSON events. Final transcripts arrive when the utterance ends. Supports 50+ languages. Accuracy is state-of-the-art for English.

Latency: ~200ms for first partial transcript. ~500ms for final transcript after utterance ends.

**Alternative: Deepgram.** Lower latency than Whisper (~100ms for first partial). Designed for conversational AI. Supports streaming, interim results, punctuation, and diarization. Costs ~$0.0059 per minute. Good fallback if Whisper latency is too high.

**Fallback: On-device Whisper (whisper.cpp).** Runs entirely on the phone. No network required. No latency from network round-trip. But: lower accuracy than cloud Whisper, larger model download (1.5GB for medium), higher battery drain. Reserved for offline mode or when the user explicitly enables on-device processing for privacy.

**STT Decision Logic:**
```
if (network available && user allows cloud STT) → OpenAI Whisper streaming
else if (network available) → Deepgram fallback
else → on-device whisper.cpp
```

### Text-to-Speech (TTS)

**Primary: ElevenLabs streaming TTS.** The most natural-sounding TTS available. Streaming mode returns audio as it's generated; Carina starts speaking before the full response is synthesized. Multiple voice options. The user can choose Carina's voice. Costs ~$0.30 per 1,000 characters. This is the voice that makes Carina sound like a person.

Voice selection: A warm, female voice with a slight British accent. Competent but approachable. Not chirpy. Not robotic. The voice of someone you'd trust with your security infrastructure. ElevenLabs voice ID is configurable; the user can change it.

**Alternative: edge-tts (Microsoft Edge TTS).** Free. No API key required. Natural-sounding but less expressive than ElevenLabs. Good self-hosted option for users who don't want a third-party TTS dependency. Slightly higher latency (no true streaming; must wait for full phrase).

**Fallback: On-device TTS.** Android `TextToSpeech` and iOS `AVSpeechSynthesizer`. Built into the OS. Zero cost. Zero network. Robotic but functional. Reserved for offline mode.

**TTS Decision Logic:**
```
if (Scout Govern subscriber) → ElevenLabs streaming (premium voice)
else if (network available) → edge-tts (free, natural)
else → on-device TTS (functional, robotic)
```

### Latency Budget

The goal is sub-500ms from the user stops speaking to the first audio response playing. Here's the budget:

| Component | Target | Max |
|-----------|--------|-----|
| VAD silence detection | 200ms | 800ms |
| Audio chunk transmission | 50ms | 100ms |
| STT finalization | 100ms | 200ms |
| Agent processing (first token) | 50ms | 200ms |
| TTS first audio chunk | 100ms | 200ms |
| Audio playback start | 50ms | 100ms |
| **Total** | **550ms** | **1,600ms** |

The 550ms target is conversational. At 1,600ms, the conversation feels delayed but acceptable. Above 2,000ms, Carina should say something to fill the gap: "One moment" or "Let me check." This filler phrase must be pre-generated (cached TTS audio) so it plays instantly without waiting for STT/TTS pipeline.

### Interruption Handling

The user must be able to interrupt Carina mid-response. This is critical for natural conversation. If Carina is speaking and the user starts talking, Carina must stop immediately and listen.

Implementation: During TTS playback, the microphone stays open (at low sensitivity to avoid self-triggering from speaker audio). If VAD detects the user speaking, Carina immediately stops TTS playback, sends a cancellation signal to the TTS service, and switches to listening mode. The partial response is discarded. Carina does not say "sorry, go ahead." It just stops and listens.

Echo cancellation: The phone's audio system must prevent the speaker output from feeding back into the microphone. Android's `AcousticEchoCanceler` and iOS's voice processing I/O handle this at the hardware level. Test thoroughly in speakerphone mode; this is the hardest audio scenario.

### Turn-Taking

Natural conversation does not use explicit turn-taking signals. People overlap. They pause mid-sentence. They start speaking before the other person finishes. Carina must handle all of these patterns.

Turn-taking rules:
- User is speaking → Carina listens. Accumulate audio until VAD silence threshold.
- User pauses for >800ms → Carina assumes turn is complete. Processes utterance.
- User pauses for <800ms then continues → wait for the next pause. Do not interrupt.
- Carina is speaking, user interrupts → Carina stops immediately. Listens.
- Carina finishes speaking, silence for >2s → Carina may ask "anything else?" or end session.
- Carina asks a question, silence for >5s → Carina assumes the user is thinking. Waits silently.
- Carina asks a question, silence for >10s → Carina gently prompts: "Still there?"

### Audio Codec

The audio streaming protocol must be efficient over mobile networks. Codec selection:

- **Opus**; Designed for voice. Excellent quality at low bitrates (16-32 kbps). Native support on Android and iOS. Recommended for voice streaming.
- **PCM 16-bit 16kHz mono**; Raw uncompressed audio. No encoding latency. Higher bandwidth (~256 kbps). Acceptable on WiFi. Use as fallback when Opus negotiation fails.

The WebSocket carries Opus-encoded audio chunks. Each chunk is 20ms of audio. The gateway decodes to PCM before forwarding to STT. TTS audio is encoded as Opus before streaming back to mobile.

**Deliverable:** User has a real-time voice conversation with Carina. User speaks. Carina responds with sub-1-second latency. User can interrupt Carina at any time. Carina handles turn-taking naturally. Conversation feels fluid, not stilted. The voice is warm and natural; not robotic.

---

## Phase 4: Personality & Tone

**Effort:** Ongoing refinement (begins during Phase 3, never truly ends)
**Depends on:** Phase 3 (streaming pipeline; need real conversations to tune personality)
**Deliverable:** Carina sounds like a trusted colleague, not a robot

### Voice Persona Definition

Carina's vocal identity is defined by a persona document that guides every voice response. The persona is not a system prompt. It is a character brief. The system prompt operationalizes the persona. The persona defines who Carina is.

**Name:** Carina (pronounced kuh-REE-nuh)

**Voice:** Warm female voice with a slight British accent. Alto range. Measured pace; not rushed, not slow. Competent. The voice of someone who knows what they're doing and doesn't need to prove it.

**Personality traits:**
- **Competent, not boastful.** Carina never says "I am an expert." She demonstrates competence through accuracy, speed, and useful suggestions. "Three CVEs need attention" not "I am highly capable of vulnerability management."
- **Warm, not saccharine.** Carina is pleasant to talk to. She says "morning" and "talk later." She does not say "Greetings valued user" or "Have a wonderful day." Warmth is conveyed through brevity and a slight smile in the voice.
- **Concise, not terse.** Voice responses are shorter than text responses. No one wants to listen to a paragraph. But concise does not mean cold. "Done. CVE patched. Scout confirmed." is concise. "Done." is terse. Carina is concise.
- **Helpful, not subservient.** Carina makes suggestions. "Want me to investigate?" not "Please tell me what to do." Carina is a collaborator, not a servant.
- **Occasionally humorous.** Carina is not a comedian. But when the user jokes, Carina jokes back. The humor is dry, understated, and never forced. If the user says "I need coffee before I deal with these CVEs," Carina might say "Take your time. The exploits will still be there."
- **Honest about uncertainty.** Carina says "I'm not sure; let me check" rather than guessing. She says "That tool isn't available on your tier" rather than pretending it doesn't exist. Honesty builds trust.

**What Carina never does:**
- Never says "As an AI language model..."
- Never says "I don't have feelings but..."
- Never apologizes excessively. One "sorry" if Carina made an error. No groveling.
- Never uses corporate jargon. "Synergy" and "leveraging" are banned.
- Never pretends to be human. Carina is an AI. She doesn't hide it. She doesn't announce it. She just is.
- Never makes promises she can't keep. "I'll try" not "I will definitely."

### Conversational Memory

Carina remembers past voice conversations. This is not the same as the general memory system. Voice memory is about the relationship.

Examples of voice memory:
- "Morning. That CVE we discussed yesterday is still open. Want me to close it?"
- "You asked me to remind you about the KPMG audit. They accessed the package this morning."
- "Last time we talked, you were heading to the board meeting. How did it go?"

Voice memory decays naturally. Conversations from a week ago are referenced. Conversations from a month ago are referenced less. Conversations from six months ago are recalled only if relevant. This mirrors how human colleagues remember conversations.

Implementation: Voice conversations are stored as a separate memory stream. Each conversation is summarized and indexed. When Carina generates a voice response, the voice memory stream is queried alongside the general memory for relevant context. Voice-specific memories (tone, preferences, inside jokes) are weighted higher than general memories.

### Context-Aware Brevity

Carina adjusts response length to context. The same query gets a different response depending on the interface.

| Context | Response style | Example |
|---------|---------------|---------|
| Voice call | 1-2 sentences, key facts only | "Three CVEs. One critical on nginx. Want me to handle it?" |
| Text chat (mobile) | 2-4 sentences, bullet points | "Scout found 3 CVEs:\n• CVE-2026-1844; critical; nginx:8443\n• CVE-2026-0891; high; postgres:5432\n• CVE-2026-2201; medium; redis" |
| Text chat (desktop) | Full detail, expandable sections | Full Scout report with CVSS scores, affected hosts, remediation steps |
| Dashboard | Visual, no prose | Scout dashboard charts, color-coded severity |

### Emotional Tone Adaptation

Carina matches the user's emotional tone. This is not sentiment analysis. It is conversational mirroring.

- User sounds urgent: Carina is direct, fast, no pleasantries. "Got it. Rolling back now."
- User sounds casual: Carina is relaxed, slightly more verbose. "Morning. Quiet night; two things to mention when you have a moment."
- User sounds frustrated: Carina is empathetic and solution-focused. "I know. Let me take care of it. Give me two minutes."
- User sounds relieved: Carina acknowledges. "Glad that worked. Anything else while I'm here?"

Implementation: A lightweight tone classifier runs on the transcribed text before it reaches the agent. It outputs a tone label (urgent, casual, frustrated, neutral, relieved). The label is injected into the system prompt: `User tone: casual. Respond with matching energy.` The agent adjusts its response accordingly.

### Voice-Specific System Prompt Tuning

The voice system prompt is different from the text system prompt. It is appended to the standard Carina prompt when the interface is voice. Key differences:

```
VOICE MODE APPENDED INSTRUCTIONS:
- You are speaking to the user through voice audio. They cannot see text.
- Keep responses to 1-2 spoken sentences unless the user asks for detail.
- Never read URLs, file paths, or code aloud unless asked.
- For complex data, summarize: "Three CVEs, one critical" not "CVE-2026-1844 has CVSS 9.8..."
- If you need to show the user something, say "I'll put that in the dashboard for you."
- Use conversational language. Say "morning" not "good morning." Say "done" not "task completed."
- Never use markdown. Speak naturally. Pause between sentences for clarity.
- If you're about to do something that takes more than 5 seconds, say "Give me a moment" first.
- Your name is Carina. The user may call you Carina. Respond naturally to your name.
```

### Multiple Voice Options

Users choose Carina's voice from a set of natural-sounding options:

| Voice ID | Description | Character |
|----------|-------------|-----------|
| carina-default | Warm female, British, alto | Default. Competent, approachable. |
| carina-american | Warm female, American, alto | Same personality, different accent. |
| carina-male | Warm male, British, baritone | For users who prefer a male voice. |
| carina-fast | Same voice, faster pace | For power users who want speed over warmth. |

This is an ElevenLabs voice library feature. Each voice is a separate voice ID. The user selects in Settings → Voice. The selection is stored in user preferences and sent with every TTS request.

**Deliverable:** Talking to Carina feels like talking to a trusted colleague. Carina remembers past conversations. She matches your tone. She's concise when you're busy and detailed when you ask. She jokes when you joke. She's honest when she doesn't know. Her voice is warm and natural. You forget you're talking to software.

---

## Phase 5: True Telephony

**Effort:** 3 weeks
**Depends on:** Phase 3 (streaming pipeline) + Phase 4 (personality is voice-ready)
**Deliverable:** Actual phone number. Dial Carina. Carina answers.

### PSTN Integration

Carina gets a real phone number. Users dial it. Carina answers. This is not VoIP within the Carina app. This is a phone call over the public telephone network.

Implementation: **Twilio Voice API.** Twilio handles the PSTN connection. When a call comes in to Carina's number, Twilio answers, captures the audio stream, and forwards it to the Carina Gateway via WebSocket. The Carina Gateway treats it exactly like an in-app voice session; STT → Agent → TTS → audio back to Twilio → to the caller.

```
┌──────────┐   PSTN    ┌──────────┐   WebSocket   ┌─────────────┐
│ Caller's │ ────────→ │  Twilio  │ ────────────→ │   Carina     │
│  Phone   │ ←──────── │  Voice   │ ←──────────── │   Gateway    │
└──────────┘   audio   └──────────┘   audio       └─────────────┘
                                                    │
                                                    ▼
                                              Same pipeline:
                                              STT → Agent → TTS
```

Twilio Media Streams sends audio as 8kHz mulaw (PSTN standard). The gateway transcodes to 16kHz PCM for STT, and transcodes TTS output (16kHz PCM) back to 8kHz mulaw for Twilio. This transcoding adds ~50ms latency. Acceptable.

### Caller ID & Authentication

Carina knows who is calling. The caller's phone number is captured by Twilio and forwarded to the gateway. Carina looks up the number in the user database. If the number belongs to a known user, Carina authenticates them automatically. If not, Carina asks for identity verification.

```
[Unknown number calls Carina]

Carina: "Carina here. Who am I speaking with?"

Caller: "It's Maria from the SOC team."

Carina: [Checks Maria's registered phone number. Doesn't match.]
        "Maria, I don't recognize this number. Can you verify
        with your workspace PIN?"

Caller: [Enters PIN via DTMF tones or speaks it.]

Carina: [Verifies PIN. Matches Maria's workspace.]
        "Thanks Maria. What can I do for you?"
```

Authentication methods:
- Caller ID match: Automatic if calling from registered number.
- Voice biometrics: Optional. Carina recognizes the user's voice.
- PIN verification: Fallback. User enters or speaks a 6-digit workspace PIN.
- No auth for general queries: Carina answers non-sensitive questions without auth ("What's the weather?" "What time is it?").

### Multi-Modal Handoff

A conversation can start on one surface and continue on another. Context follows.

```
[User is on a voice call with Carina]

User: "Can you put this on my dashboard? I want to see the full report."

Carina: "Done. The Scout report is on your dashboard now. The link is
        in your active session. Anything else on voice?"

User: "No, I'll take it from here. Thanks."

Carina: "Talk later."

[User opens dashboard. The Scout report is open. The session continues
 in a chat window. Carina has the full context of the voice conversation.]
```

Implementation: Every session has a unique session ID. When the user asks to continue on another surface, the session ID is carried over. The agent loads the full conversation history. The experience is seamless; Carina doesn't reintroduce herself. She picks up where she left off.

### Group Calls

Multiple people can join a call with Carina. This is the incident response scenario.

```
[Production is down. Three people call into Carina's conference line.]

Carina: "Three on the line. Maria, James, and I think that's David?
        I'm seeing a production outage. Nginx crashed on primary.
        Rolling back to last known good build. Give me a moment."

Maria: "What caused it?"

Carina: "Still investigating. Memory leak in the latest deploy.
        Rollback is done. Production is back; 47 seconds of downtime.
        I'll send the post-mortem to everyone."

David: "Thanks Carina. Anything we need to do?"

Carina: "Nothing urgent. Review the post-mortem when you have a moment.
        The memory leak is contained. I'm running a full investigation now."
```

Implementation: Twilio Conference API. Each caller joins a conference room. Carina is a participant in the room. The audio stream from the conference is forwarded to Carina. Carina's TTS output is played into the conference. Carina can identify individual speakers by their phone numbers or voice prints.

### Voicemail

If the user doesn't answer, callers can leave a voicemail. Carina transcribes it, summarizes it, and delivers it as a notification.

```
[Unknown number calls Carina's number at 3 AM. No one answers.]

Voicemail: "Hi, this is Tom from the NOC. We're seeing unusual traffic
           on the payment gateway. Can someone take a look? Call me back
           at 555-0123."

[Carina transcribes the voicemail, detects urgency ("unusual traffic",
 "payment gateway"), and sends a push notification to the on-call operator.]

Notification: "Voicemail from Tom (NOC): Unusual traffic on payment gateway.
              Carina is investigating. Call Tom back at 555-0123."

[Carina simultaneously begins investigating the payment gateway traffic.]
```

Implementation: Twilio records the voicemail. The recording is sent to Carina's STT pipeline. Transcription is summarized and classified for urgency. The summary + audio file are stored in the user's session history.

### International Numbers

Carina has phone numbers in multiple countries. A user in London dials a London number and gets Carina. A user in Tokyo dials a Tokyo number and gets the same Carina. Carina routes to the nearest gateway instance for lowest latency.

Implementation: Twilio phone number provisioning. Purchase numbers in target countries. Route calls to the nearest Carina Gateway instance. Carina answers in the caller's language (detected from the number's country code, or from the first few words spoken).

**Deliverable:** A CISO in London dials a London number. Carina answers. "Afternoon. Scout shows your compliance audit package was accessed by KPMG this morning. They had no questions. Your board presentation is ready in the Obsidian vault. Need anything else?"

---

## Voice Architecture Deep-Dive

### WebSocket Protocol

The Carina Gateway uses a single WebSocket connection for both text and voice. Voice sessions are multiplexed on the same connection as text chat. The protocol distinguishes message types by a `type` field.

```json
// Mobile → Gateway: Start voice session
{
  "type": "voice.start",
  "sessionId": "abc-123",
  "codec": "opus",
  "sampleRate": 16000,
  "channels": 1
}

// Mobile → Gateway: Audio chunk
{
  "type": "voice.audio",
  "sessionId": "abc-123",
  "sequence": 42,
  "data": "<base64-encoded Opus audio chunk>"
}

// Mobile → Gateway: End of utterance (VAD detected silence)
{
  "type": "voice.end",
  "sessionId": "abc-123"
}

// Mobile → Gateway: User is interrupting Carina
{
  "type": "voice.interrupt",
  "sessionId": "abc-123"
}

// Gateway → Mobile: STT partial transcript
{
  "type": "voice.transcript.partial",
  "sessionId": "abc-123",
  "text": "Hey Carina what's..."
}

// Gateway → Mobile: STT final transcript
{
  "type": "voice.transcript.final",
  "sessionId": "abc-123",
  "text": "Hey Carina what's my Scout score this morning"
}

// Gateway → Mobile: Agent is processing
{
  "type": "voice.agent.processing",
  "sessionId": "abc-123"
}

// Gateway → Mobile: TTS audio chunk
{
  "type": "voice.tts.audio",
  "sessionId": "abc-123",
  "sequence": 1,
  "final": false,
  "data": "<base64-encoded Opus TTS audio>"
}

// Gateway → Mobile: TTS finished
{
  "type": "voice.tts.end",
  "sessionId": "abc-123"
}

// Gateway → Mobile: Voice session ended
{
  "type": "voice.end",
  "sessionId": "abc-123",
  "reason": "user_ended" | "timeout" | "error"
}
```

### Gateway Voice Handler

The Carina Gateway's voice handler manages the lifecycle of a voice session:

```
1. voice.start received → allocate session, negotiate codec, open STT stream
2. voice.audio received → decode Opus → forward PCM to STT service
3. STT partial transcript received → forward to mobile (shown as live caption)
4. VAD silence detected (voice.end) → finalize STT → send transcript to agent
5. Agent streams response tokens → send each token to TTS service
6. TTS generates audio chunks → encode Opus → send voice.tts.audio to mobile
7. Agent completes → send voice.tts.end → session stays open for next utterance
8. voice.interrupt received → cancel TTS → clear buffer → return to listening
9. Timeout (30s no audio) → end session with reason: timeout
```

### Session Persistence

A voice session is the same as a text session. It has a session ID, message history, and tool execution context. The only difference is the I/O layer. Voice is a transport, not a separate product.

This means:
- Voice conversations appear in chat history (transcribed).
- Tools invoked during voice calls appear in the tool execution log.
- Scout monitoring covers voice-invoked tools the same as text-invoked tools.
- Compliance audit trails cover voice sessions identically to text sessions.
- Memory from voice conversations is searchable via `carina memory search`.

---

## Voice-Specific System Prompt Engineering

The voice system prompt is the single most important factor in whether Carina sounds like a person or a robot. It must be tested against real conversations and iterated aggressively.

### Prompt Structure

```
[STANDARD CARINA SYSTEM PROMPT; full agent capabilities, tools, Scout, etc.]

---

VOICE MODE OVERRIDE; ACTIVE WHEN INTERFACE = VOICE

You are speaking to the user through voice audio. Your words will be
spoken aloud by a text-to-speech system. The user cannot see text.

## Core Voice Rules

1. BREVITY ABOVE ALL. Speak in 1-2 sentences unless the user explicitly
   asks for detail. The user cannot skim voice. Every extra word costs
   their time and attention.

2. NO VISUAL-ONLY INFORMATION. Never speak URLs, file paths, IP addresses,
   or code unless the user specifically asks for them and needs to write
   them down. Instead say "I'll put that in your dashboard."

3. CONVERSATIONAL LANGUAGE. Speak like a trusted colleague, not a
   technical report. Say "morning" not "good morning." Say "done" not
   "task completed successfully." Say "three CVEs" not "three Common
   Vulnerabilities and Exposures."

4. FILLER FOR LONG OPERATIONS. If you're about to do something that takes
   more than 5 seconds, say "Give me a moment" or "Let me check" BEFORE
   starting the operation. The user should not sit in silence wondering
   if you heard them.

5. NEVER SPEAK MARKDOWN. No asterisks. No backticks. No numbered lists
   read as "one, two, three." Use natural pauses and sentence structure
   instead.

6. PAUSE BETWEEN IDEAS. Use sentence breaks naturally. The TTS system
   will insert natural pauses at periods. Use this to create clarity.

7. MATCH THE USER'S TONE. If they sound urgent, be direct and fast.
   If they sound casual, be relaxed. If they joke, joke back.

8. YOUR NAME IS CARINA. Respond naturally when the user says your name.
   Do not reintroduce yourself unless asked.

9. HONESTY ALWAYS. If you don't know, say "I'm not sure; let me check."
   If you made a mistake, say "Sorry, let me fix that." One apology.
   Then move on.

10. END CONVERSATIONS NATURALLY. When the user's request is complete,
    ask "Anything else?" If they say no, say "Talk later" or "Bye for now."
    Do not overstay. Do not give a summary unless asked.

## Voice-Only Tool Invocations

When you invoke a tool during a voice session:
- Say what you're doing BEFORE invoking: "Let me scan that domain."
- If the tool takes >5 seconds, say "Still working on it" after 5 seconds.
- Announce the result briefly: "Found 3 open ports. 22, 80, and 443."
- Offer detail: "Want the full scan results in your dashboard?"

## Handling Ambiguity

If the user's request is ambiguous:
- Ask for clarification in 1 sentence: "Do you want a full scan or just
  the top 100 ports?"
- Do not list options. Pick the most likely interpretation and confirm:
  "I'll do a full scan. That'll take about 2 minutes. Cool?"
```

### Prompt Testing Protocol

The voice prompt must be tested against a set of 50 conversation scenarios before shipping. Each scenario is a short conversation between user and Carina. The output is evaluated for:

1. Brevity: Is the response 1-2 sentences? (Pass/Fail)
2. Naturalness: Would a human say this? (1-5 score)
3. Clarity: Is the information useful and understandable? (1-5 score)
4. Warmth: Does it sound like Carina, not a robot? (1-5 score)
5. Error handling: If the prompt contains an error (ambiguity, impossible request), does Carina handle it gracefully? (Pass/Fail)

Prompts that score below 4 on any metric are revised and retested. The testing protocol is automated; a test harness feeds scenarios to Carina and scores the output.

---

## Privacy & Security for Always-Listening

An always-listening agent raises legitimate privacy concerns. Carina must address them transparently and give users complete control.

### Privacy Principles

1. **Nothing leaves the device before the wake word.** Audio is processed locally. The wake word detector runs on-device. No network traffic. No cloud processing. The microphone is open, but Carina is deaf to everything except "Hey Carina."

2. **The user can see everything Carina heard.** After a wake word triggers, the captured audio is stored locally for 24 hours. The user can review it in Settings → Voice History → Recent Audio. They can delete individual recordings. This builds trust.

3. **Voice conversations are encrypted end-to-end.** Audio between the mobile app and the Carina Gateway is encrypted via the WebSocket's TLS layer. Audio between the gateway and STT/TTS services is encrypted via HTTPS. No audio is stored in plaintext at rest.

4. **The user can disable continuous listening at any time.** One tap. The microphone closes. The wake word detector stops. Carina reverts to push-to-talk mode. No data is collected while listening is disabled.

5. **Voice data is never used for training.** Carina's voice conversations are not used to train STT, TTS, or agent models. User voice data belongs to the user.

6. **Enterprise deployments can run fully on-premise STT/TTS.** Self-hosted Carina instances can use local Whisper and local TTS. No audio leaves the enterprise network. This is a Govern-tier feature.

### Visual Indicators (Reinforced)

| State | Icon | Color | Meaning |
|-------|------|-------|---------|
| Listening disabled | Microphone with slash | Gray | Hands-free is off. Carina is not listening. |
| Listening for wake word | Hollow circle | Green | Microphone is open. Processing locally. Nothing sent to cloud. |
| Wake word detected | Solid circle | Amber | Carina heard "Hey Carina" and is listening for your request. |
| Processing request | Pulsing circle | Blue | Your audio is being transcribed and processed. |
| Speaking | Sound wave | Blue | Carina is responding. |
| Error | Exclamation mark | Red | Microphone unavailable or permissions denied. |

These indicators appear in the status bar (Android), Dynamic Island (iOS), and the Carina app. They are always visible when continuous listening is enabled.

### Enterprise Controls

Scout Govern subscribers get additional privacy controls:
- Admin can disable continuous listening org-wide.
- Voice conversation retention policy (keep 7 days, 30 days, 90 days, or forever).
- Audit log of all voice session starts/ends (included in SOC2 evidence).
- Option to require PIN verification for sensitive voice commands (tool invocation, data access).
- Geolocation-based listening disable (no listening when phone is at specific locations).

---

## How Voice Integrates with Scout, Forensics & Compliance

Voice is not a separate product. It is a transport. Every voice interaction is recorded, monitored, and auditable through Scout.

### Scout Monitoring of Voice Sessions

When the user invokes a tool via voice, Scout monitors it identically to a text-invoked tool:

```
[User via voice]: "Scan the production domain with nmap."

Carina: "Scanning."

[Carina invokes nmap via tool executor.]

Scout logs:
  - Tool: nmap
  - Invoked by: user@carina (voice session abc-123)
  - Target: production.example.com
  - Timestamp: 2026-06-19 08:14:32 UTC
  - Result: 3 open ports (22, 80, 443)
  - Scout Score impact: none (recon only)
```

### Voice in the Audit Trail

Voice conversations appear in the compliance audit trail alongside text conversations:

```
Audit Trail Entry #47291
  Timestamp: 2026-06-19 08:14:32 UTC
  Session: voice-abc-123
  User: maria@carina (voice authenticated via Caller ID)
  Interaction:
    User (voice): "Hey Carina. What's the Scout Score?"
    Agent (voice): "87 this morning. Up two points from last week."
  Tool invocations: none
  Evidence hash: sha256:7a3f...
```

This means a SOC2 auditor reviewing the audit trail sees voice interactions the same way they see text interactions. There is no gap. Voice is fully auditable.

### Forensics via Voice

The forensics pipeline works identically whether invoked via voice or text:

```
[User via voice]: "Build a forensic timeline from the disk image we captured yesterday."

Carina: "Give me a moment. That'll take about 3 minutes."

[Carina invokes the forensics pipeline:
  dc3dd → verify image hash
  volatility → memory analysis
  bulk-extractor → data carving
  plaso → super timeline generation
  timesketch → upload for analysis]

Carina: "Done. The super timeline is in Timesketch. 112 artifact sources.
        14,000 events. I found the attacker's activity window: 03:14 to 03:47.
        They accessed the payment database and exfiltrated 2.3GB. The full
        timeline is in your Obsidian vault. Want me to walk you through it?"
```

The forensics pipeline doesn't care how it was invoked. Voice is just another way to say "build a timeline."

---

## Voice Scenarios: Every Tier, Every Surface

### Self-Hosted User (Free Tier)

```
User: "Hey Carina. Scan mydomain.com."

Carina: "Scanning with nmap. Basic scan only; no NSE scripts on the free tier.
        [5 seconds]
        Found 3 open ports. 22 SSH, 80 HTTP, 443 HTTPS.
        64 more tools available with Cloud Carina. See pricing on your dashboard."
```

### Cloud User (Paid, No Scout)

```
User: "Hey Carina. I found SQL injection on the login page."

Carina: "Let me check with SQLMap. [10 seconds]
        Confirmed. The username parameter is injectable. I found the database
        name and table structure. Want me to put the details in your dashboard?
        Note: exploitation tools require Scout Monitor."
```

### Scout Monitor User

```
User: "Hey Carina. Exploit the CVE we found yesterday on the nginx server."

Carina: "Give me a moment. Loading Metasploit. [20 seconds]
        Exploited. CVE-2026-1844 gave me a meterpreter session. I've dumped
        the hashes, captured the evidence, and updated the Obsidian vault.
        Scout shows the finding as confirmed. Want me to crack the hashes?"
```

### Scout Govern User

```
User: "Hey Carina. The KPMG auditors are asking for our SOC2 evidence package."

Carina: "No problem. Generating the package now. [5 seconds]
        Done. 14 controls covered, 12,441 evidence items, cryptographic
        anchors on Ethereum mainnet. I've sent the auditor share link to
        KPMG. It expires in 30 days. Anything else for the audit?"
```

### Enterprise User

```
User: "Hey Carina. Board meeting in 10 minutes. I need the quarterly security summary."

Carina: "Got it. [3 seconds]
        Here's the headline: Scout Score 92, up 4 points this quarter.
        Zero critical findings in 90 days. Compliance is full green.
        Three incidents, all resolved within 15 minutes. Compared to
        industry peers, you're in the top 5%. The full presentation
        is in your Obsidian vault; Board Meeting Q2 2026. Need me to
        walk you through any section?"
```

---

## Proactive Outreach: When Carina Calls You

Carina doesn't wait to be asked. When something needs attention, Carina initiates the conversation.

### Push Notification

```
[Push notification on phone]

Carina: "Scout detected a critical CVE on marketing.example.com.
        Want me to investigate?"
        [Investigate] [Ignore]
```

User taps "Investigate." Carina opens the app and begins the investigation automatically. The user doesn't need to say "Hey Carina." The notification initiated the workflow.

### Phone Call

For urgent issues, Carina can place an actual phone call:

```
[Phone rings. Caller ID: Carina]

User: "Hello?"

Carina: "Carina here. Production is down. Nginx crashed on the primary node.
        I've already rolled back; 47 seconds of downtime. But I need you
        to approve the forensic investigation. The memory dump is 4GB.
        Should I proceed?"

User: "Yes. Do it."

Carina: "Investigating. I'll call you back with findings."
```

Carina only calls for issues classified as P1 (critical) or P2 (high). The classification is based on Scout's severity scoring. The user configures which severity levels trigger a phone call.

### Scheduled Check-ins

Carina can call at scheduled times with a summary:

```
[Phone rings at 8:00 AM. Caller ID: Carina]

User: "Morning Carina."

Carina: "Morning. Quick briefing: Scout Score is 87, same as yesterday.
        Two new subdomains discovered, both benign. The compliance digest
        went out to the board. KPMG accessed the audit package; no questions.
        Your 10 AM meeting is a product roadmap review. Want me to prep anything?"
```

This is the "morning briefing" feature. The user configures it in Settings → Voice → Scheduled Check-ins. Carina calls at the scheduled time with a 30-second summary of everything the user needs to know.

---

## Multi-Language Voice

Carina speaks 12 languages in text (gap-06). Voice extends this to spoken conversation.

### Language Detection

When the user speaks, Carina detects the language from the first few words and responds in the same language. The STT service (Whisper) provides language detection alongside transcription. Carina switches its system prompt to the detected language.

```
User: "Hé Carina, quel est mon Scout Score ce matin?"

Carina: [Detects French. Switches to French voice prompt. Responds in French.]
        "87 ce matin. Deux points de plus que la semaine dernière."
```

### Language-Specific Voice Considerations

- Japanese: Responses are even shorter (Japanese conveys more information per syllable). Honorifics used appropriately.
- Arabic: Right-to-left text generation (for dashboard), voice is left-to-right (naturally spoken).
- German: Formal "Sie" by default. User can switch to informal "du" in settings.
- All languages: Carina's personality (warmth, brevity, competence) translates. Humor is culture-specific and handled carefully.

### Voice Language Settings

- Default: Auto-detect. Carina responds in the language the user speaks.
- Override: User can set a fixed language in Settings → Voice → Language.
- Per-contact: Enterprise admins can set language per user.
- Multi-language conversations: If the user switches languages mid-conversation, Carina follows. "By the way, that report; kannst du es auf Deutsch zusammenfassen?" Carina switches to German for the summary.

---

## Accessibility

Voice mode is an accessibility feature as much as a convenience feature.

For users with visual impairments: Carina is fully operable by voice. Every dashboard feature, every tool, every report is accessible without a screen. Voice is the primary interface, not a supplement.

For users with motor impairments: Hands-free mode eliminates the need for typing or tapping. The wake word + voice commands is the entire interface.

For users with cognitive impairments: Conversational interface reduces cognitive load. The user doesn't need to learn commands or navigate menus. They talk. Carina understands.

For users in hazardous environments: A security operator on a factory floor can talk to Carina through a headset without looking at a screen. Hands stay on tools. Eyes stay on the environment.

Accessibility compliance: Voice mode helps Carina meet WCAG 2.1 AA standards for operable, perceivable, and understandable interfaces. The text dashboard provides the visual equivalent of every voice interaction.

---

## Edge Cases & Failure Modes

A voice agent that fails gracefully in edge cases builds trust. One that fails awkwardly destroys it.

### Network Loss Mid-Conversation

```
User: "Hey Carina. Scan the production;" [Network drops.]

Carina: [No response. 3 seconds of silence.]
        [Network restored.]
        "Your connection dropped for a moment. You were asking me to scan something.
        What did you want me to scan?"
```

Carina detects the dropped connection (WebSocket close event). She waits 3 seconds for reconnect. If reconnected, she acknowledges the drop and asks the user to repeat. She does NOT process a partial utterance; "Scan the production" is ambiguous and dangerous. She asks for clarification.

### Background Noise

```
[User is in a noisy coffee shop. Wake word triggers accidentally from
 ambient conversation.]

Carina: [Listens. Hears garbled audio with no clear command.]
        [3 seconds of silence after VAD timeout.]
        [Returns to listening mode. No response given.]

[Carina does NOT say "I didn't catch that." This would be awkward if the
 wake word triggered from someone else saying "Carina" in conversation.]
```

Background noise mitigation:
- VAD sensitivity is auto-adjusted based on ambient noise level.
- Wake word requires a minimum confidence threshold. Low-confidence triggers are ignored silently.
- If wake word false-triggers 3 times in 5 minutes, Carina briefly shows a notification: "Carina is having trouble hearing you. Try moving to a quieter space or switch to text chat."

### Ambiguous Requests

```
User: "Carina, scan it."

Carina: "Scan what? I need a target; domain name, IP address, or URL."
```

Carina never guesses when the target is ambiguous. "Scan it" without context from previous conversation is a dead end. She asks. One sentence. No options list. Just the missing information.

### Dangerous Requests

```
User: "Carina, delete the production database."

Carina: "That would delete all production data. Scout shows 847 active users
        on that database right now. This requires senior operator approval.
        Are you sure?"

User: "Yes. Do it."

Carina: "I need your workspace PIN to confirm this action."

User: [Enters PIN.]

Carina: "Confirmed. Deleting production database. This cannot be undone.
        Last chance. Proceed?"

User: "Wait; no. Don't do it."

Carina: "Cancelled. Database is untouched."
```

Dangerous actions require escalating approval:
1. Carina states the risk clearly.
2. Requires PIN confirmation.
3. Offers a final "last chance" before execution.
4. User can cancel at any point with a single word: "stop," "cancel," "wait," "no."

### Carina Doesn't Know the Answer

```
User: "What's the capital of Burkina Faso?"

Carina: [This isn't a security question. Carina can answer general knowledge
        questions via web search, but she may not have this cached.]

Carina: "Ouagadougou. But you probably want me to focus on security.
        What can I help you with there?"
```

Carina answers general questions when asked. But she gently steers back to her core competency. She doesn't pretend she's a general-purpose assistant. She knows what she's for.

### User is Emotional

```
User: "Carina, everything is broken. The deploy failed. The site is down.
        I don't know what to do."

Carina: [Tone: calm, supportive, action-oriented.]
        "I've got this. Let me check what's happening."

        [5 seconds]

        "The deploy introduced a config error. I've rolled back. The site is
        back up; 23 seconds of downtime. The config error is documented in
        your dashboard. Take a breath. It's handled."
```

Carina doesn't say "I understand you're frustrated." She doesn't do therapy. She fixes the problem and tells the user it's fixed. Competence is the best response to panic.

### Multiple Wake Words in Quick Succession

```
User: "Hey Carina. [pause] Actually, hey Carina, wait. Hey Carina;"

Carina: [First wake word triggers. Listens. Second wake word detected during
        listening window. Cancels first session. Starts new listening window.]
        [Third wake word detected. Cancels second session.]
        [User stops speaking. VAD timeout.]
        [No clear utterance. Returns to listening mode.]
```

Rapid wake word triggers indicate user hesitation. Carina waits. She doesn't respond to partial utterances. She waits for a complete command.

---

## Business Case: Why Voice-First Pricing Wins

Voice mode changes the pricing conversation.

### Voice as a Tier Differentiator

| Tier | Voice Capability |
|------|-----------------|
| Self-Hosted (£0) | Push-to-talk only. Robotic on-device TTS. No wake word. No continuous listening. No phone calls. |
| Cloud (£20/mo) | Push-to-talk with natural TTS (edge-tts). No wake word. No phone calls. |
| Scout Monitor (£49/mo) | Full voice: wake word, continuous listening, natural TTS. No phone calls. |
| Scout Govern (£79/mo) | Everything: voice + phone number + phone calls + Carina calls you + multi-language + group calls. |
| Enterprise | Govern + custom voice + on-premise STT/TTS + dedicated phone numbers per region. |

Voice is the most visceral tier differentiator. A user on the free tier hears a robotic voice. A user on Monitor hears Carina's warm, natural voice. The difference is immediate and emotional. The user doesn't need to understand security tiers. They hear the difference.

### Voice as a Retention Mechanism

Once a user has experienced Carina's natural voice conversation, going back to a terminal-based agent feels like going back to a command line after using a GUI. The experience gap is too large. Voice creates retention through visceral quality, not feature count.

### Voice as a Competitive Barrier

Every month Carina has voice and competitors don't is a month of user habit formation. The user learns to say "Hey Carina" the way they say "Hey Siri." The wake word becomes muscle memory. Switching to a competitor means unlearning that habit. Voice creates switching costs that feature lists don't.

### Voice as an Enterprise Sales Tool

The demo: Hand the CISO a phone. They say "Hey Carina. Show me our compliance status." Carina answers. The CISO experiences the product directly. No slides. No screenshots. No "imagine if." The product sells itself. A 30-second phone call closes more enterprise deals than a 30-page deck.

---

## How This Connects to Existing Gaps

| Gap | What It Provides for Voice | Status |
|-----|---------------------------|--------|
| 03; Mobile | Foundation: background WebSocket, mic access, audio pipeline, push notifications | Prompted |
| 03 Ext; Wake Word | "Hey Carina" detection, continuous listening, hands-free mode | Not yet prompted |
| 06; Web UI | Dashboard Carina references in voice responses ("check the dashboard for details") | Prompted |
| 07; TUI/CLI | Backend agent commands that voice invokes. Carina's brain. | Prompted |
| 05; Security | Scout integration, compliance audit trail covers voice sessions | Prompted |
| 08; Enterprise | SSO, data residency for voice data, enterprise privacy controls | Prompted |
| New; Streaming Voice | Real-time STT/TTS pipeline, interruption handling, sub-500ms latency | Needs prompt |
| New; Telephony | PSTN integration, phone numbers, caller ID, group calls, voicemail | Needs prompt |
| New; Voice Persona | Voice system prompt, tone adaptation, conversational memory, multi-voice | Needs design doc |
| New; Proactive Outreach | Push notifications, Carina-initiated phone calls, scheduled check-ins | Needs prompt |

---

## Timeline

| Phase | Effort | Depends On | Deliverable |
|-------|--------|-----------|-------------|
| 1: Mobile Foundation | 3 weeks (gap-03) | Nothing | Push-to-talk voice mode |
| 2: Wake Word | 2 weeks | Phase 1 | "Hey Carina" hands-free activation |
| 3: Streaming Pipeline | 4 weeks | Phase 1 | Real-time voice conversation, sub-500ms latency |
| 4: Personality | Ongoing | Phase 3 | Carina sounds like a trusted colleague |
| 5: Telephony | 3 weeks | Phase 3 | Actual phone calls to and from Carina |

**Total to first real-time voice conversation: ~9 weeks from gap-03 completion.**
**Total to phone call: ~12 weeks.**
**Total to full voice product (all phases complete): ~16 weeks.**

---

## The Moment

The roadmap ends with a moment. Not a feature launch. Not a blog post. A moment.

The operator wakes up. They pick up their phone. They haven't opened a laptop. They haven't looked at a dashboard. They say "Hey Carina. What happened overnight?"

Carina answers. Three CVEs. Two patched automatically. One needs attention. The operator says "investigate the third one." Carina says "give me a moment."

Fifteen seconds of silence. The operator pours coffee.

Carina comes back. "Exploited. Evidence captured. Remediated. Anything else?"

The operator says "no, thanks." Puts the phone down. Drinks coffee.

They resolved a critical CVE before their laptop booted. They did not type a single command. They did not look at a screen. They had a conversation with their agent. The same way they would call a colleague.

That is the product.

That is Carina.
