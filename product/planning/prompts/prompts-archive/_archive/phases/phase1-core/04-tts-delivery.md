# Action: Text-to-Speech Delivery

## Status: DONE

## Implementation

- `src/utils/tts.ts` - generateSpeech, cleanForSpeech (Edge TTS + OpenAI fallback)
- `src/tools/text-to-speech.ts` - LLM-callable tool
- `src/gateway/telegram-audio.ts` - sendSpokenReply helper
- `src/gateway/telegram.ts` - /speak command and [speak] directive wired

## Usage

Telegram:
- `/speak What is on my schedule today?`
- `Summarise this deal [speak]`

Env:
```
TTS_PROVIDER=edge
TTS_VOICE=en-GB-SoniaNeural
```

System dependency: `pip3 install edge-tts`
