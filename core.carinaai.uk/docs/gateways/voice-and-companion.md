# Voice and companion surfaces

Carina supports voice input and text-to-speech across web, mobile companion, and Telegram without hidden configuration.

## Web chat

**Voice input:** Click the microphone in the composer. Chrome and Edge use live dictation; other browsers record audio and send it to `/api/transcribe`.

**Listen on replies:** Hover an assistant message and click **Listen**. The gateway calls `/api/tts` and plays the reply aloud.

**Settings:** Settings shows browser voice support status.

## Text-to-speech configuration

Default provider is Edge TTS (local CLI):

```bash
pip3 install edge-tts
```

In `~/.carina/.env`:

```
TTS_PROVIDER=edge
TTS_VOICE=en-GB-SoniaNeural
```

OpenAI TTS fallback:

```
TTS_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

The agent can also call the `text-to-speech` tool during conversations.

## Telegram voice replies

Send `/speak your question`, append `[speak]`, or add phrases like **respond in voice** / **as audio** to any message. Carina replies with a voice note when TTS is configured (`pip3 install edge-tts` on the gateway host).

## Mobile companion

### Paired PWA (`/mobile`)

1. On desktop: `carina pair` (shows QR or token)
2. On phone: open `/mobile` or scan the QR link
3. Paste the token and pair
4. Use the microphone button to dictate messages

The paired PWA reuses your gateway session via device bearer auth.

### Native app (`carinaMobile/`)

The Expo companion adds:

- On-device speech recognition (development build required)
- Push notifications, biometrics, offline queue
- Same gateway auth and session model as the PWA

Build: see `carinaMobile/DEPLOY.md`.

## Visual workspace (not live canvas)

Carina does not ship an OpenClaw-style live canvas surface. Visual work lives in the workspace hub:

| Page | Purpose |
|---|---|
| `/workspace` | Hub for all workspace apps |
| `/documents` | Writing and editing |
| `/images` | Gallery and image generation |
| `/research` | Deep research reports |
| `/compare` | Side-by-side model comparison |

Reach these from the **Workspace** button in chat or `/workspace`.

## Companion pairing checklist

1. Gateway running: `carina gateway start`
2. Desktop pairing: `carina pair`
3. Phone opens `/mobile?token=...` or native app with base URL configured
4. Voice works after microphone permission is granted

## Related docs

- [Channel setup](./channel-setup.md)
- [Remote gateway access](./remote-access.md)
- [CLI gateway](./cli.md)
