# Prompt 04: Voice multi-provider + phone

Status: PENDING  
Series: Carina-Keprix parity inbound  
Severity: MEDIUM  
Depends on: 00  
Writing style: plain ASCII only (no em/en dashes, no emoji).

## Goal

Upgrade beyond Edge TTS + Whisper: provider matrix, optional Twilio telephony hooks using `.access` credentials patterns.

## Must-haves

1. Provider interface + two STT/TTS options configured via env.
2. Feature flags defaulting to current behaviour.
3. Docs; no secrets committed.

## Acceptance

- [ ] Switching provider via env changes code path under test (mocked HTTP OK).
