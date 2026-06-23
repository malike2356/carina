# Sprint 2 - Category 12: Voice Agent


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## What Exists

- `carinaMobile/` - 121-file React Native app with WebSocket client
- `src/gateway/` - WebSocket gateway (handles text chat sessions)
- Streaming text responses over WebSocket (same channel voice will use)
- Phase 1 (mobile foundation) prompted in gap-03

## What Is Missing

- Mobile audio pipeline for voice (mic access, PCM capture, Opus streaming)
- Wake word detection ("Hey Carina" via Porcupine or Snowboy)
- Streaming STT/TTS pipeline (Whisper STT, ElevenLabs TTS, sub-500ms latency)
- Voice personality and tone system (voice-specific system prompt, tone adaptation)
- PSTN telephony (Twilio Voice API, phone numbers, caller ID, group calls, voicemail)
- Voice gateway protocol (WebSocket message types for voice sessions)
- Scout voice monitoring (audit trail entries for voice sessions)

## Prompts in This Category

- `01-mobile-foundation-audio.md` - Background WebSocket + mic + PCM streaming (Phase 1)
- `02-wake-word-vad.md` - Picovoice Porcupine integration + WebRTC VAD (Phase 2)
- `03-streaming-voice-pipeline.md` - Whisper STT + ElevenLabs TTS + gateway voice handler (Phase 3)
- `04-personality-tone.md` - Voice system prompt, tone adapter, conversational memory (Phase 4)
- `05-pstn-telephony.md` - Twilio Voice API, phone numbers, group calls, voicemail (Phase 5)
- `06-voice-gateway-protocol.md` - WebSocket message spec for voice sessions
- `07-scout-voice-monitoring.md` - Audit trail, Scout events, compliance for voice sessions

## Original Reference

`sprint-2/gap-15-workspace-project/CARINA_VOICE_AGENT_ROADMAP.md`
