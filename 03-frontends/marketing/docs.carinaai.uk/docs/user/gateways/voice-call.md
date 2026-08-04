# Voice call gateway

Experimental voice channel: STT in, TTS out, bridged to the same agent session model as text gateways.

## Prerequisites

- Telephony provider (Twilio Voice, Vonage, or self-hosted SIP bridge)
- STT and TTS credentials (OpenAI, Deepgram, Edge TTS, etc.)

## Setup

```
VOICE_PROVIDER=twilio
TWILIO_VOICE_ACCOUNT_SID=...
TWILIO_VOICE_AUTH_TOKEN=...
VOICE_WEBHOOK_PATH=/voice/inbound
TTS_PROVIDER=openai
STT_PROVIDER=openai
```

Configure the provider voice URL to your gateway webhook.

## Behaviour

- Inbound call creates or resumes a voice-scoped session
- User speech is transcribed, passed to `CarinaAgent.turn`, reply is synthesized
- DTMF shortcuts may map to `/clear` or hangup depending on adapter

## Troubleshooting

| Symptom | Fix |
|---|---|
| Silent call | Check STT credentials and audio codec negotiation |
| Robotic TTS | Switch TTS provider or voice id in `.env` |

## Security

Voice endpoints are high abuse risk. Require provider signature validation and geographic allowlists where possible.

Not recommended on a public gateway without [Scout](/docs/user/security/labyrinth-scout) policy and rate limits.
