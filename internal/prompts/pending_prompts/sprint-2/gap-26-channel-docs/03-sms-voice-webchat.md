# Gap 26 - Prompt 03: SMS, Voice Call & WebChat Channel Docs

**Gap:** 26 Documentation: Channel Guides
**Prompt number:** 03 of 04
**Name:** Write docs for SMS, Voice Call, and deep WebChat documentation
**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 1 h
**Depends on:** Nothing

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Goal

Write 3 additional channel pages not covered in prompts 01-02.

### 1. `docs/user/gateways/sms.md`

SMS channel for sending/receiving text messages via Twilio or Vonage.

```markdown
# SMS Gateway

## Prerequisites
- A Twilio account (or Vonage)
- A phone number with SMS capability

## Setup (Twilio)
1. Sign up at twilio.com, get a phone number
2. Get your Account SID and Auth Token from the console
3. Add the channel:
   carina channel add sms --provider twilio
4. Enter your credentials when prompted

## Configuration
| Variable | Default |
|----------|---------|
| CARINA_SMS_PROVIDER | twilio |
| CARINA_SMS_ACCOUNT_SID | (required) |
| CARINA_SMS_AUTH_TOKEN | (required) |
| CARINA_SMS_PHONE_NUMBER | (required) |

## Limitations
- SMS is 160 characters per segment
- MMS (images) depends on carrier support
- Rate limits per Twilio/Vonage plan

## Security
- Auth token stored encrypted
- Inbound SMS validated via Twilio webhook signature
```

### 2. `docs/user/gateways/voice-call.md`

Voice call channel for phone-based interaction.

```markdown
# Voice Call Gateway

## Overview
Carina can answer phone calls and respond by voice. Inbound calls
route through Twilio's voice API; Carina converts speech to text,
processes the message, and speaks the response back.

## Prerequisites
- A Twilio account with a voice-capable phone number
- Carina TTS provider configured (see Voice and Talk guide)

## Setup
1. Buy a Twilio phone number with voice capability
2. Configure the webhook URL:
   https://your-server:3333/gateway/voice/twilio
3. Add the channel:
   carina channel add voice --provider twilio

## Behaviour
- Inbound call → Carina answers → "Carina here. How can I help?"
- Caller speaks → speech-to-text → Carina processes → text-to-speech reply
- Call ends when caller hangs up or says "goodbye"

## Security
- Webhook requests validated with Twilio signature
- Call recordings disabled by default (configurable)
```

### 3. `docs/user/gateways/web.md` (expand existing)

The existing `web.md` page is thin. Expand it with:

- Embedding the WebChat widget on any site
- Customisation: colours, logo, welcome message
- Paired-device vs session-based auth
- WebChat behind nginx with TLS
- WebChat security: CSP headers, CORS, rate limiting

---

## Sidebar update

Add SMS and Voice Call under "Gateways". WebChat already exists but the
page content must be expanded.

---

## Existing Carina files to reference

- `internal/servers/core.carinaai.uk/src/tools/text-to-speech.ts`
- `internal/servers/core.carinaai.uk/src/tools/transcription.ts`
- `internal/servers/core.carinaai.uk/src/gateway/web-chat-turn.ts`
- `internal/servers/core.carinaai.uk/src/gateway/load-web-package.ts`
